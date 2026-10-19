-- =============================================================================
-- Efficiency: six indexes and two function tweaks. Each one was measured on the
-- synthetic data in supabase/perf (5,000 people, three years of events). The
-- before and after numbers are in docs/SCALING.md ("Measured on 19 Oct 2026").
-- Nothing here changes what any query returns.
-- =============================================================================

-- private.attended_events() (get_my_stats, get_staff_stats, get_person_history, get_people_activity) reads only this index.
create index rsvps_going_event_idx on public.rsvps (event_id)
  include (user_id, checked_in_at, guest_count, guest_status) where status = 'going';

-- staff_invite_to_event() and admin_grant_role() find each person by email.
create index profiles_email_idx on public.profiles (email);

-- Deleting an event deletes its notifications (ON DELETE CASCADE).
create index notifications_event_idx on public.notifications (event_id) where event_id is not null;

-- Deleting an account clears it from the audit log (ON DELETE SET NULL).
create index audit_events_actor_idx on public.audit_events (actor_id) where actor_id is not null;

-- Deleting an account clears it from RSVPs that person checked in (ON DELETE SET NULL).
create index rsvps_checked_in_by_idx on public.rsvps (checked_in_by) where checked_in_by is not null;

-- Deleting an account clears it from RSVPs that person approved or declined (ON DELETE SET NULL).
create index rsvps_decided_by_idx on public.rsvps (decided_by) where decided_by is not null;

-- -----------------------------------------------------------------------------
-- Counts on event lists and the Help out page: check the viewer's role and
-- sign-in once per call (an InitPlan) instead of once per row. Same results.
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
      (e.status in ('published', 'cancelled') and (e.visibility = 'public' or (select auth.uid()) is not null))
      or (select public.is_staff())
    );
$$;

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
    and ((select public.can_manage_events()) or (
      s.status <> 'draft'
      and (s.event_id is null or exists (
        select 1 from public.events e
        where e.id = s.event_id and e.status = 'published' and (e.visibility = 'public' or (select auth.uid()) is not null)
      ))
    ));
$$;
