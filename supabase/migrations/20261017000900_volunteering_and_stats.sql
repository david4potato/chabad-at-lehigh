-- =============================================================================
-- Volunteering (sign up to cook, set up or clean up) and a few simple stats.
-- Tables and security rules for volunteer_shifts / volunteer_signups are in
-- 20261017000400_community.sql.
-- =============================================================================

create index volunteer_shifts_starts_at_idx on public.volunteer_shifts (starts_at);
create index volunteer_shifts_event_idx on public.volunteer_shifts (event_id);
create index volunteer_signups_user_idx on public.volunteer_signups (user_id);

-- Sign-ups: open shifts only, before they start, while spots remain
-- (serialized per shift with a row lock).
create or replace function private.enforce_signup_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_status text;
  v_starts timestamptz;
  v_event_status public.event_status;
  v_taken integer;
begin
  perform private.enforce_rate_limit('signup:' || coalesce(auth.uid()::text, 'anon'), 20, interval '10 minutes');
  if tg_table_name = 'volunteer_signups' then
    select s.slots, s.status, s.starts_at, e.status into v_limit, v_status, v_starts, v_event_status
    from public.volunteer_shifts s left join public.events e on e.id = s.event_id
    where s.id = new.shift_id for update of s;
    -- Already signed up: let the primary key say so (the app treats that as success).
    if exists (select 1 from public.volunteer_signups where shift_id = new.shift_id and user_id = new.user_id) then
      return new;
    end if;
    select count(*) into v_taken from public.volunteer_signups where shift_id = new.shift_id;
  else
    select capacity, status into v_limit, v_status from public.learning_programs where id = new.program_id for update;
    select count(*) into v_taken from public.learning_signups where program_id = new.program_id;
  end if;
  if v_status is distinct from 'open' or v_starts < now()
     or (v_event_status is not null and v_event_status <> 'published') then
    raise exception 'signup_closed';
  end if;
  if v_limit is not null and v_taken >= v_limit then
    raise exception 'signup_full';
  end if;
  return new;
end;
$$;

-- Spots taken per shift (no names), for the public Help out page.
create or replace function public.get_volunteer_counts(p_shift_ids uuid[])
returns table (shift_id uuid, taken integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, (select count(*)::integer from public.volunteer_signups v where v.shift_id = s.id)
  from public.volunteer_shifts s
  where s.id = any (p_shift_ids)
    and (public.can_manage_events() or (
      s.status <> 'draft'
      and (s.event_id is null or exists (
        select 1 from public.events e
        where e.id = s.event_id and e.status = 'published' and (e.visibility = 'public' or auth.uid() is not null)
      ))
    ));
$$;

-- Organizers take someone off a shift (e.g. they can't come or didn't show).
create or replace function public.staff_remove_signup(p_shift_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.volunteer_shifts;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;
  select * into v_shift from public.volunteer_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'shift_not_found';
  end if;
  delete from public.volunteer_signups where shift_id = p_shift_id and user_id = p_user_id;
  if not found then
    raise exception 'signup_not_found';
  end if;
  perform private.notify_user(p_user_id, v_shift.event_id, 'shift_removed',
    'You''re off a volunteer shift',
    'An organizer took you off "' || v_shift.title || '". Questions? Contact the organizer.', '/volunteer', false);
  perform private.log_audit('volunteer.signup_removed', 'volunteer_shifts', p_shift_id::text,
    jsonb_build_object('user_id', p_user_id));
end;
$$;

-- Tell people signed up when an upcoming shift's time changes or it's deleted.
create or replace function private.notify_shift_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.volunteer_shifts := case when tg_op = 'DELETE' then old else new end;
  v_title text;
  v_body text;
begin
  if old.starts_at < now() then
    return v_shift;
  end if;
  if tg_op = 'DELETE' then
    -- Skip when the whole event is being deleted (its rows are already gone).
    if old.event_id is not null and not exists (select 1 from public.events where id = old.event_id) then
      return old;
    end if;
    v_title := 'Shift cancelled: ' || old.title;
    v_body := '"' || old.title || '" was cancelled. Thanks for offering to help.';
  elsif new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    v_title := 'Shift time changed: ' || new.title;
    v_body := '"' || new.title || '" is now '
      || to_char(new.starts_at at time zone 'America/New_York', 'FMDay, FMMonth FMDD "at" FMHH12:MI AM') || '.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, is_urgent)
  select v.user_id, 'shift_changed', left(v_title, 200), left(v_body, 2000), '/volunteer', true
  from public.volunteer_signups v where v.shift_id = v_shift.id;
  return v_shift;
end;
$$;

-- BEFORE DELETE: sign-ups still exist (they cascade away after the shift row).
create trigger volunteer_shifts_notify_delete
  before delete on public.volunteer_shifts
  for each row execute function private.notify_shift_change();
create trigger volunteer_shifts_notify_update
  after update of starts_at, ends_at on public.volunteer_shifts
  for each row execute function private.notify_shift_change();

-- -----------------------------------------------------------------------------
-- Stats. "Attended" = confirmed (going) for a published event that has ended;
-- if organizers checked in at least half the people going, only those checked
-- in count (a few check-ins shouldn't erase everyone else).
-- -----------------------------------------------------------------------------
create or replace function private.attended_events()
returns table (user_id uuid, event_id uuid, category public.event_category, starts_at timestamptz,
               title text, slug text, guests integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, e.id, e.category, e.starts_at, e.title, e.slug,
         case when r.guest_status = 'approved' then r.guest_count else 0 end
  from public.rsvps r
  join public.events e on e.id = r.event_id
  where r.status = 'going'
    and e.status = 'published'
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') < now()
    and (r.checked_in_at is not null
         or (select count(*) filter (where c.checked_in_at is not null) * 2 < count(*)
             from public.rsvps c where c.event_id = e.id and c.status = 'going'));
$$;

-- A past shift "happened" unless it was a draft or its event was cancelled.
create or replace function private.shift_happened(p_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteer_shifts s
    left join public.events e on e.id = s.event_id
    where s.id = p_shift_id and s.status <> 'draft' and (s.event_id is null or e.status = 'published')
  );
$$;

-- Your own numbers (Profile).
create or replace function public.get_my_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select a.* from private.attended_events() a where a.user_id = auth.uid()
  )
  select jsonb_build_object(
    'events', (select count(*) from mine),
    'shabbat_dinners', (select count(*) from mine where category = 'shabbat_dinner'),
    'helped', (
      select count(*) from public.volunteer_signups v
      join public.volunteer_shifts s on s.id = v.shift_id
      where v.user_id = auth.uid() and coalesce(s.ends_at, s.starts_at) < now() and private.shift_happened(s.id)
    ),
    'since', (select min(starts_at) from mine),
    'last', (
      select jsonb_build_object('title', title, 'slug', slug, 'starts_at', starts_at)
      from mine order by starts_at desc limit 1
    )
  );
$$;

-- A few numbers for organizers since a date (Dashboard → Overview). No names.
create or replace function public.get_staff_stats(p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;

  with held as (
    select e.id, e.category from public.events e
    where e.status = 'published' and e.starts_at >= p_since
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') < now()
  ),
  att as (
    select a.* from private.attended_events() a where a.starts_at >= p_since
  ),
  firsts as (
    select a.user_id, min(a.starts_at) as first_at from private.attended_events() a group by a.user_id
  )
  select jsonb_build_object(
    'events_held', (select count(*) from held),
    'shabbat_dinners', (select count(*) from held where category = 'shabbat_dinner'),
    'people', (select count(distinct user_id) from att),
    'new_people', (select count(*) from firsts where first_at >= p_since),
    'avg_shabbat', (
      select coalesce(round(avg(n)), 0) from (
        select h.id, count(a.user_id) + coalesce(sum(a.guests), 0) as n
        from held h left join att a on a.event_id = h.id
        where h.category = 'shabbat_dinner'
        group by h.id
        having count(a.user_id) > 0
      ) s
    ),
    'volunteer_signups', (
      select count(*) from public.volunteer_signups v
      join public.volunteer_shifts s on s.id = v.shift_id
      where s.starts_at >= p_since and coalesce(s.ends_at, s.starts_at) < now() and private.shift_happened(s.id)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- One person's activity, for admins (Dashboard → People & roles → a person).
create or replace function public.get_person_history(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  with att as (
    select a.* from private.attended_events() a where a.user_id = p_user_id
  )
  select jsonb_build_object(
    'events', (select count(*) from att),
    'shabbat_dinners', (select count(*) from att where category = 'shabbat_dinner'),
    'helped', (
      select count(*) from public.volunteer_signups v
      join public.volunteer_shifts s on s.id = v.shift_id
      where v.user_id = p_user_id and coalesce(s.ends_at, s.starts_at) < now() and private.shift_happened(s.id)
    ),
    'since', (select min(starts_at) from att),
    'last_at', (select max(starts_at) from att),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('title', x.title, 'slug', x.slug, 'starts_at', x.starts_at, 'category', x.category)
                       order by x.starts_at desc)
      from (select * from att order by starts_at desc limit 15) x
    ), '[]'::jsonb),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object('title', e.title, 'slug', e.slug, 'starts_at', e.starts_at, 'status', r.status)
                       order by e.starts_at)
      from public.rsvps r join public.events e on e.id = r.event_id
      where r.user_id = p_user_id and e.status = 'published' and e.starts_at >= now()
        and r.status in ('going', 'waitlist', 'pending')
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('title', x.title, 'starts_at', x.starts_at) order by x.starts_at desc)
      from (
        select s.title, s.starts_at from public.volunteer_signups v
        join public.volunteer_shifts s on s.id = v.shift_id
        where v.user_id = p_user_id and private.shift_happened(s.id)
        order by s.starts_at desc limit 10
      ) x
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Events attended per person, for the People & roles list (admins).
create or replace function public.get_people_activity(p_user_ids uuid[])
returns table (user_id uuid, events integer, last_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select a.user_id, count(*)::integer, max(a.starts_at)
  from private.attended_events() a
  where a.user_id = any (p_user_ids)
  group by a.user_id;
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.get_volunteer_counts(uuid[]) from public;
revoke execute on function public.get_my_stats() from public, anon;
revoke execute on function public.get_staff_stats(timestamptz) from public, anon;
revoke execute on function public.get_person_history(uuid) from public, anon;
revoke execute on function public.staff_remove_signup(uuid, uuid) from public, anon;
revoke execute on function public.get_people_activity(uuid[]) from public, anon;
grant execute on function public.get_volunteer_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_person_history(uuid) to authenticated;
grant execute on function public.staff_remove_signup(uuid, uuid) to authenticated;
grant execute on function public.get_people_activity(uuid[]) to authenticated;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_staff_stats(timestamptz) to authenticated;
