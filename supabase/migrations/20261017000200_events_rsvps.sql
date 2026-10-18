-- =============================================================================
-- Events, RSVPs (capacity, waitlist, approvals, guests, check-in), notifications
-- =============================================================================

create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.event_category as enum ('shabbat_dinner', 'holiday', 'learning', 'social', 'volunteer', 'other');
create type public.event_visibility as enum ('public', 'members');
-- auto: everyone is confirmed while space remains.
-- guests_need_approval: plus-ones and community guests need organizer approval.
-- all_need_approval: every RSVP needs organizer approval.
create type public.approval_mode as enum ('auto', 'guests_need_approval', 'all_need_approval');
create type public.rsvp_status as enum ('going', 'not_going', 'waitlist', 'pending', 'declined');
create type public.guest_status as enum ('none', 'pending', 'approved', 'declined');

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 140),
  summary text check (char_length(summary) <= 280),
  description text check (char_length(description) <= 5000),
  category public.event_category not null default 'other',
  status public.event_status not null default 'draft',
  visibility public.event_visibility not null default 'public',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text check (char_length(location_name) <= 140),
  location_address text check (char_length(location_address) <= 280),
  capacity integer check (capacity is null or capacity between 1 and 5000),
  rsvp_enabled boolean not null default true,
  rsvp_deadline timestamptz,
  approval_mode public.approval_mode not null default 'auto',
  max_guests_per_rsvp integer not null default 0 check (max_guests_per_rsvp between 0 and 10),
  has_meal boolean not null default false,
  menu_voting_open boolean not null default false,
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 254),
  contact_phone text check (char_length(contact_phone) <= 40),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index events_starts_at_idx on public.events (starts_at);
create index events_status_starts_at_idx on public.events (status, starts_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create trigger events_audit
  after insert or update or delete on public.events
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- RSVPs (one row per person per event; plus-ones are a count on that row)
-- -----------------------------------------------------------------------------
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null,
  guest_count integer not null default 0 check (guest_count between 0 and 10),
  guest_names text check (char_length(guest_names) <= 300),
  guest_status public.guest_status not null default 'none',
  note text check (char_length(note) <= 500),
  waitlisted_at timestamptz,
  status_changed_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  check ((guest_count = 0) = (guest_status = 'none'))
);

create index rsvps_user_idx on public.rsvps (user_id);
create index rsvps_event_status_idx on public.rsvps (event_id, status);

create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Notifications (in-app). Written only by SECURITY DEFINER functions.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 2000),
  link text check (link is null or (link like '/%' and char_length(link) <= 300)),
  is_urgent boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function private.notify_user(
  p_user_id uuid,
  p_event_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_urgent boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, event_id, kind, title, body, link, is_urgent)
  values (p_user_id, p_event_id, p_kind, left(p_title, 200), left(p_body, 2000), p_link, coalesce(p_urgent, false));
$$;

-- -----------------------------------------------------------------------------
-- Capacity helpers
-- -----------------------------------------------------------------------------
-- Seats a single RSVP occupies: the person (if confirmed) plus approved guests.
create or replace function private.rsvp_seats(
  p_status public.rsvp_status,
  p_guest_count integer,
  p_guest_status public.guest_status
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'going'
      then 1 + case when p_guest_status = 'approved' then p_guest_count else 0 end
    else 0
  end;
$$;

create or replace function private.event_seats_taken(p_event_id uuid, p_exclude_rsvp uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.rsvp_seats(r.status, r.guest_count, r.guest_status)), 0)::integer
  from public.rsvps r
  where r.event_id = p_event_id
    and (p_exclude_rsvp is null or r.id <> p_exclude_rsvp);
$$;

-- Promote waitlisted RSVPs (oldest first) into any free seats. The caller must
-- already hold a lock on the event row. Returns the number promoted.
create or replace function private.promote_waitlist(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_taken integer;
  v_need integer;
  v_promoted integer := 0;
  r public.rsvps;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status <> 'published'
     or coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') < now() then
    return 0;
  end if;

  v_taken := private.event_seats_taken(p_event_id);

  for r in
    select * from public.rsvps
    where event_id = p_event_id and status = 'waitlist'
    order by waitlisted_at nulls last, created_at
    for update
  loop
    v_need := private.rsvp_seats('going', r.guest_count, r.guest_status);
    if v_event.capacity is null or v_taken + v_need <= v_event.capacity then
      update public.rsvps
        set status = 'going', waitlisted_at = null, status_changed_at = now()
        where id = r.id;
      v_taken := v_taken + v_need;
      v_promoted := v_promoted + 1;
      perform private.notify_user(
        r.user_id, p_event_id, 'rsvp_promoted',
        'You''re off the waitlist!',
        'A spot opened up for ' || v_event.title || '. You''re confirmed — see you there!',
        '/events/' || v_event.slug, false);
    end if;
  end loop;

  return v_promoted;
end;
$$;

-- -----------------------------------------------------------------------------
-- RSVP: the only way attendees create/change RSVPs (atomic, capacity-safe)
-- -----------------------------------------------------------------------------
create or replace function public.set_rsvp(
  p_event_id uuid,
  p_response text,
  p_guest_count integer default 0,
  p_guest_names text default null,
  p_note text default null
)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_existing public.rsvps;
  v_has_existing boolean;
  v_result public.rsvps;
  v_is_member boolean;
  v_needs_approval boolean;
  v_guest_count integer := coalesce(p_guest_count, 0);
  v_guest_names text := nullif(trim(coalesce(p_guest_names, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_guest_status public.guest_status;
  v_status public.rsvp_status;
  v_taken integer;
  v_need integer;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;
  if p_response is null or p_response not in ('going', 'not_going') then
    raise exception 'invalid_response';
  end if;
  if char_length(coalesce(v_guest_names, '')) > 300 or char_length(coalesce(v_note, '')) > 500 then
    raise exception 'text_too_long';
  end if;

  perform private.enforce_rate_limit('rsvp:' || v_uid::text, 30, interval '10 minutes');

  -- Lock the event row so concurrent RSVPs can't oversell capacity.
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'event_not_found';
  end if;
  if coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') < now() then
    raise exception 'event_ended';
  end if;

  select * into v_existing from public.rsvps
  where event_id = p_event_id and user_id = v_uid
  for update;
  v_has_existing := found;

  if v_has_existing and v_existing.status = 'declined' then
    raise exception 'rsvp_declined';
  end if;

  -- ---------------- Not going ----------------
  if p_response = 'not_going' then
    insert into public.rsvps as r (event_id, user_id, status, guest_count, guest_names, guest_status, note, status_changed_at)
    values (p_event_id, v_uid, 'not_going', 0, null, 'none', v_note, now())
    on conflict (event_id, user_id) do update set
      status = 'not_going',
      guest_count = 0,
      guest_names = null,
      guest_status = 'none',
      note = excluded.note,
      waitlisted_at = null,
      status_changed_at = case when r.status <> 'not_going' then now() else r.status_changed_at end;

    perform private.promote_waitlist(p_event_id);
    select * into v_result from public.rsvps where event_id = p_event_id and user_id = v_uid;
    return v_result;
  end if;

  -- ---------------- Going ----------------
  -- (Cancelling stays possible after the deadline or when RSVPs are closed.)
  if not v_event.rsvp_enabled then
    raise exception 'rsvp_closed';
  end if;
  if v_event.rsvp_deadline is not null and now() > v_event.rsvp_deadline then
    raise exception 'rsvp_deadline_passed';
  end if;
  if v_guest_count < 0 or v_guest_count > v_event.max_guests_per_rsvp then
    raise exception 'too_many_guests';
  end if;
  -- Approved guests share one approval; adding more would send the whole party
  -- back for approval and give their seats away.
  if v_event.approval_mode <> 'auto' and v_has_existing and v_existing.guest_status = 'approved'
     and v_guest_count > v_existing.guest_count then
    raise exception 'guest_increase_needs_organizer';
  end if;
  if v_guest_count = 0 then
    v_guest_names := null;
  end if;

  v_is_member := public.has_any_role(array['student', 'organizer', 'kitchen_staff', 'admin']::public.app_role[]);
  v_needs_approval := v_event.approval_mode = 'all_need_approval'
    or (v_event.approval_mode = 'guests_need_approval' and not v_is_member);

  if v_guest_count = 0 then
    v_guest_status := 'none';
  elsif v_event.approval_mode = 'auto' then
    v_guest_status := 'approved';
  elsif v_has_existing and v_existing.guest_status = 'approved' and v_guest_count <= v_existing.guest_count then
    v_guest_status := 'approved';
  else
    v_guest_status := 'pending';
  end if;

  v_need := private.rsvp_seats('going', v_guest_count, v_guest_status);
  v_taken := private.event_seats_taken(p_event_id, case when v_has_existing then v_existing.id end);

  if v_has_existing and v_existing.status = 'going' then
    -- Already confirmed: keep the seat. Only a change that needs more seats
    -- must fit (edits that free seats work even when over capacity).
    if v_event.capacity is not null
       and v_need > private.rsvp_seats(v_existing.status, v_existing.guest_count, v_existing.guest_status)
       and v_taken + v_need > v_event.capacity then
      raise exception 'not_enough_capacity';
    end if;
    v_status := 'going';
  elsif v_needs_approval and v_has_existing and v_existing.status = 'waitlist' then
    -- Already approved and waiting for a seat: keep their place in line.
    v_status := 'waitlist';
  elsif v_needs_approval then
    v_status := 'pending';
  elsif v_event.capacity is null or v_taken + v_need <= v_event.capacity then
    v_status := 'going';
  else
    v_status := 'waitlist';
  end if;

  insert into public.rsvps as r (
    event_id, user_id, status, guest_count, guest_names, guest_status, note, waitlisted_at, status_changed_at
  )
  values (
    p_event_id, v_uid, v_status, v_guest_count, v_guest_names, v_guest_status, v_note,
    case when v_status = 'waitlist' then now() end, now()
  )
  on conflict (event_id, user_id) do update set
    status = excluded.status,
    guest_count = excluded.guest_count,
    guest_names = excluded.guest_names,
    guest_status = excluded.guest_status,
    note = excluded.note,
    waitlisted_at = case
      when excluded.status = 'waitlist' and r.status = 'waitlist' then r.waitlisted_at
      when excluded.status = 'waitlist' then now()
      else null
    end,
    status_changed_at = case when r.status <> excluded.status then now() else r.status_changed_at end;

  -- Reducing guests can free seats for people on the waitlist.
  perform private.promote_waitlist(p_event_id);

  select * into v_result from public.rsvps where event_id = p_event_id and user_id = v_uid;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Staff: approve / decline RSVPs and guests, check-in
-- -----------------------------------------------------------------------------
create or replace function public.staff_decide_rsvp(
  p_rsvp_id uuid,
  p_decision text,
  p_override_capacity boolean default false
)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_event public.events;
  v_need integer;
  v_taken integer;
  v_result public.rsvps;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;
  if p_decision not in ('approve', 'decline') then
    raise exception 'invalid_decision';
  end if;

  select e.* into v_event from public.events e
  join public.rsvps r on r.event_id = e.id
  where r.id = p_rsvp_id
  for update of e;
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp_id for update;

  if p_decision = 'approve' then
    if v_rsvp.status = 'not_going' then
      raise exception 'invalid_state';
    end if;
    if v_rsvp.status = 'going' then
      return v_rsvp;
    end if;
    v_need := private.rsvp_seats('going', v_rsvp.guest_count, v_rsvp.guest_status);
    v_taken := private.event_seats_taken(v_event.id, v_rsvp.id);
    if p_override_capacity or v_event.capacity is null or v_taken + v_need <= v_event.capacity then
      update public.rsvps set
        status = 'going', waitlisted_at = null, status_changed_at = now(),
        decided_by = auth.uid(), decided_at = now()
      where id = p_rsvp_id
      returning * into v_result;
      perform private.notify_user(v_rsvp.user_id, v_event.id, 'rsvp_approved',
        'Your RSVP is confirmed',
        'An organizer confirmed your spot for ' || v_event.title || '.',
        '/events/' || v_event.slug, false);
    else
      update public.rsvps set
        status = 'waitlist', waitlisted_at = coalesce(waitlisted_at, now()), status_changed_at = now(),
        decided_by = auth.uid(), decided_at = now()
      where id = p_rsvp_id
      returning * into v_result;
      perform private.notify_user(v_rsvp.user_id, v_event.id, 'rsvp_waitlisted',
        'You''re on the waitlist',
        v_event.title || ' is full right now. We''ll confirm you automatically if a spot opens.',
        '/events/' || v_event.slug, false);
    end if;
  else
    update public.rsvps set
      status = 'declined',
      guest_status = case when guest_count > 0 then 'declined'::public.guest_status else 'none'::public.guest_status end,
      waitlisted_at = null, status_changed_at = now(),
      decided_by = auth.uid(), decided_at = now()
    where id = p_rsvp_id
    returning * into v_result;
    perform private.notify_user(v_rsvp.user_id, v_event.id, 'rsvp_declined',
      'About your RSVP',
      'An organizer was not able to confirm your RSVP for ' || v_event.title || '. Please reach out to the organizer with any questions.',
      '/events/' || v_event.slug, false);
    perform private.promote_waitlist(v_event.id);
  end if;

  perform private.log_audit('rsvp.' || p_decision, 'rsvps', p_rsvp_id::text,
    jsonb_build_object('event_id', v_event.id, 'status', v_result.status, 'override', p_override_capacity));
  return v_result;
end;
$$;

create or replace function public.staff_decide_guests(
  p_rsvp_id uuid,
  p_decision text,
  p_override_capacity boolean default false
)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_event public.events;
  v_taken integer;
  v_result public.rsvps;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;
  if p_decision not in ('approve', 'decline') then
    raise exception 'invalid_decision';
  end if;

  select e.* into v_event from public.events e
  join public.rsvps r on r.event_id = e.id
  where r.id = p_rsvp_id
  for update of e;
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp_id for update;
  if v_rsvp.guest_count = 0 then
    raise exception 'no_guests';
  end if;

  if p_decision = 'approve' then
    if v_rsvp.status = 'going' and not p_override_capacity and v_event.capacity is not null then
      v_taken := private.event_seats_taken(v_event.id, v_rsvp.id);
      if v_taken + 1 + v_rsvp.guest_count > v_event.capacity then
        raise exception 'not_enough_capacity';
      end if;
    end if;
    update public.rsvps set guest_status = 'approved', decided_by = auth.uid(), decided_at = now()
    where id = p_rsvp_id returning * into v_result;
    perform private.notify_user(v_rsvp.user_id, v_event.id, 'guests_approved',
      'Your guests are approved',
      'Your ' || v_rsvp.guest_count || ' guest(s) for ' || v_event.title || ' are confirmed.',
      '/events/' || v_event.slug, false);
  else
    update public.rsvps set guest_status = 'declined', decided_by = auth.uid(), decided_at = now()
    where id = p_rsvp_id returning * into v_result;
    perform private.notify_user(v_rsvp.user_id, v_event.id, 'guests_declined',
      'About your guests',
      'An organizer was not able to confirm your guest(s) for ' || v_event.title || '. Your own RSVP is unchanged.',
      '/events/' || v_event.slug, false);
    perform private.promote_waitlist(v_event.id);
  end if;

  perform private.log_audit('rsvp.guests_' || p_decision, 'rsvps', p_rsvp_id::text,
    jsonb_build_object('event_id', v_event.id, 'guest_count', v_rsvp.guest_count, 'override', p_override_capacity));
  return v_result;
end;
$$;

create or replace function public.staff_set_check_in(p_rsvp_id uuid, p_checked_in boolean)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.rsvps;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;
  update public.rsvps set
    checked_in_at = case when p_checked_in then coalesce(checked_in_at, now()) else null end,
    checked_in_by = case when p_checked_in then auth.uid() else null end
  where id = p_rsvp_id
  returning * into v_result;
  if not found then
    raise exception 'rsvp_not_found';
  end if;
  return v_result;
end;
$$;

-- Staff cancel an RSVP on someone's behalf (e.g. they texted that they can't come).
create or replace function public.staff_cancel_rsvp(p_rsvp_id uuid)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_rsvp public.rsvps;
  v_result public.rsvps;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;

  select e.* into v_event from public.events e
  join public.rsvps r on r.event_id = e.id
  where r.id = p_rsvp_id
  for update of e;
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  if coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') < now() then
    raise exception 'event_ended';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp_id for update;
  if v_rsvp.status not in ('going', 'waitlist', 'pending') then
    raise exception 'invalid_state';
  end if;

  update public.rsvps set
    status = 'not_going', guest_count = 0, guest_names = null, guest_status = 'none',
    waitlisted_at = null, checked_in_at = null, checked_in_by = null,
    status_changed_at = now(), decided_by = auth.uid(), decided_at = now()
  where id = p_rsvp_id
  returning * into v_result;

  perform private.notify_user(v_rsvp.user_id, v_event.id, 'rsvp_cancelled',
    'Your RSVP was cancelled',
    'An organizer marked you as not going to ' || v_event.title || '. If that''s a mistake, '
      || case when v_event.rsvp_enabled and (v_event.rsvp_deadline is null or now() <= v_event.rsvp_deadline)
              then 'you can RSVP again on the event page.' else 'please contact the organizer.' end,
    '/events/' || v_event.slug, false);
  perform private.promote_waitlist(v_event.id);
  perform private.log_audit('rsvp.staff_cancel', 'rsvps', p_rsvp_id::text, jsonb_build_object('event_id', v_event.id));
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Event changes: fill seats freed by a capacity change, and tell everyone who
-- RSVP'd or signed up to help (urgent, in-app) when an event is cancelled,
-- rescheduled, moved or back on after a cancellation.
-- -----------------------------------------------------------------------------
create or replace function private.after_event_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_when text := to_char(new.starts_at at time zone 'America/New_York', 'FMDay, FMMonth FMDD "at" FMHH12:MI AM');
  v_kind text;
  v_title text;
  v_body text;
begin
  if new.status = 'published' and (new.capacity is distinct from old.capacity or old.status <> 'published') then
    perform private.promote_waitlist(new.id);
  end if;

  -- Edits to events that are already over don't notify anyone.
  if coalesce(old.ends_at, old.starts_at + interval '3 hours') < now() then
    return null;
  end if;

  if old.status = 'published' and new.status = 'cancelled' then
    v_kind := 'event_cancelled';
    v_title := 'Cancelled: ' || new.title;
    v_body := new.title || ' on ' || v_when || ' has been cancelled. Please contact the organizer with any questions.';
  elsif old.status = 'cancelled' and new.status = 'published' then
    v_kind := 'event_reinstated';
    v_title := 'Back on: ' || new.title;
    v_body := new.title || ' on ' || v_when || ' is back on. See the event page for details.';
  elsif old.status = 'published' and new.status = 'published'
        and (new.starts_at is distinct from old.starts_at
             or new.location_name is distinct from old.location_name
             or new.location_address is distinct from old.location_address) then
    v_kind := 'event_changed';
    v_title := 'Updated: ' || new.title;
    v_body := new.title || ' is now ' || v_when || coalesce(' at ' || nullif(new.location_name, ''), '')
      || '. See the event page for details.';
  else
    return null;
  end if;

  -- Everyone who RSVP'd, plus anyone signed up to help at this event.
  insert into public.notifications (user_id, event_id, kind, title, body, link, is_urgent)
  select u.user_id, new.id, v_kind, left(v_title, 200), left(v_body, 2000), '/events/' || new.slug, true
  from (
    select r.user_id from public.rsvps r
    where r.event_id = new.id and r.status in ('going', 'waitlist', 'pending')
    union
    select v.user_id from public.volunteer_signups v
    join public.volunteer_shifts s on s.id = v.shift_id
    where s.event_id = new.id
  ) u;
  return null;
end;
$$;

create trigger events_after_update
  after update of status, capacity, starts_at, location_name, location_address on public.events
  for each row execute function private.after_event_update();

-- -----------------------------------------------------------------------------
-- Aggregate counts (safe to show publicly; no names)
-- -----------------------------------------------------------------------------
create or replace function public.get_event_counts(p_event_ids uuid[])
returns table (
  event_id uuid,
  going integer,
  guests integer,
  seats_taken integer,
  waitlist integer,
  pending integer,
  checked_in integer
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Per-event aggregate so each event uses the rsvps (event_id, status) index
  -- instead of scanning every RSVP ever made. Seats = going + approved guests.
  select e.id, c.going, c.guests, c.going + c.guests, c.waitlist, c.pending, c.checked_in
  from public.events e
  cross join lateral (
    select
      count(*) filter (where r.status = 'going')::integer as going,
      coalesce(sum(r.guest_count) filter (where r.status = 'going' and r.guest_status = 'approved'), 0)::integer as guests,
      count(*) filter (where r.status = 'waitlist')::integer as waitlist,
      count(*) filter (where r.status = 'pending' or r.guest_status = 'pending')::integer as pending,
      count(*) filter (where r.checked_in_at is not null)::integer as checked_in
    from public.rsvps r
    where r.event_id = e.id
  ) c
  where e.id = any (p_event_ids)
    and (
      (e.status in ('published', 'cancelled') and (e.visibility = 'public' or auth.uid() is not null))
      or public.is_staff()
    );
$$;

-- -----------------------------------------------------------------------------
-- Notifications: mark as read
-- -----------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS + privileges
-- -----------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.notifications enable row level security;

revoke all on public.events, public.rsvps, public.notifications from anon, authenticated;

-- events
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

create policy "events: read published" on public.events
  for select to anon, authenticated
  using (
    status in ('published', 'cancelled')
    and (visibility = 'public' or (select auth.uid()) is not null)
  );
create policy "events: staff read all" on public.events
  for select to authenticated using ((select public.is_staff()));
create policy "events: organizers insert" on public.events
  for insert to authenticated with check ((select public.can_manage_events()));
create policy "events: organizers update" on public.events
  for update to authenticated
  using ((select public.can_manage_events()))
  with check ((select public.can_manage_events()));
create policy "events: admins delete" on public.events
  for delete to authenticated using ((select public.is_admin()));

-- rsvps: read your own; organizers read all. All writes go through functions.
grant select on public.rsvps to authenticated;
create policy "rsvps: read own" on public.rsvps
  for select to authenticated using (user_id = (select auth.uid()));
create policy "rsvps: organizers read" on public.rsvps
  for select to authenticated using ((select public.can_manage_events()));

-- notifications: your own only.
grant select, delete on public.notifications to authenticated;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.set_rsvp(uuid, text, integer, text, text) from public, anon;
revoke execute on function public.staff_decide_rsvp(uuid, text, boolean) from public, anon;
revoke execute on function public.staff_decide_guests(uuid, text, boolean) from public, anon;
revoke execute on function public.staff_set_check_in(uuid, boolean) from public, anon;
revoke execute on function public.staff_cancel_rsvp(uuid) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.set_rsvp(uuid, text, integer, text, text) to authenticated;
grant execute on function public.staff_decide_rsvp(uuid, text, boolean) to authenticated;
grant execute on function public.staff_decide_guests(uuid, text, boolean) to authenticated;
grant execute on function public.staff_set_check_in(uuid, boolean) to authenticated;
grant execute on function public.staff_cancel_rsvp(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.get_event_counts(uuid[]) to anon, authenticated;
