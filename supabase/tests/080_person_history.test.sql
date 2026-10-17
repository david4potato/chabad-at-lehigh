-- One person's activity for admins (Dashboard -> People & roles):
-- get_person_history and get_people_activity. Who may call them, what counts
-- as attended (past, published, going, the check-in rule), Shabbat and help
-- counts, the recent / upcoming / shifts lists and their order and caps.
begin;
select plan(43);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('p', tests.create_user('hist-p@lehigh.edu')),
  ('q', tests.create_user('hist-q@lehigh.edu')),
  ('r', tests.create_user('hist-r@lehigh.edu')),
  ('s', tests.create_user('hist-s@lehigh.edu')),
  ('many', tests.create_user('hist-many@lehigh.edu')),
  ('organizer', tests.create_user('hist-organizer@example.com')),
  ('admin', tests.create_user('hist-admin@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

insert into public.events (slug, title, category, status, starts_at, rsvp_enabled, is_demo) values
  -- Past
  ('ph-draft', 'Person history draft', 'social', 'draft', now() - interval '12 days', true, false),
  ('ph-cancelled', 'Person history cancelled', 'social', 'cancelled', now() - interval '11 days', true, false),
  ('ph-social-1', 'Person history social', 'social', 'published', now() - interval '10 days', true, false),
  ('ph-shabbat-1', 'Person history Shabbat one', 'shabbat_dinner', 'published', now() - interval '9 days', true, false),
  ('ph-shabbat-2', 'Person history Shabbat two', 'shabbat_dinner', 'published', now() - interval '8 days', true, false),
  ('ph-checkin-in', 'Person history check-in', 'social', 'published', now() - interval '6 days', true, false),
  ('ph-checkin-out', 'Person history check-in two', 'social', 'published', now() - interval '5 days', true, false),
  ('ph-not-going', 'Person history not going', 'social', 'published', now() - interval '4 days', true, false),
  ('ph-past-waitlist', 'Person history past waitlist', 'social', 'published', now() - interval '3 days', true, false),
  ('ph-latest', 'Person history latest', 'social', 'published', now() - interval '1 day', true, false),
  -- Upcoming
  ('ph-up-going', 'Person history up going', 'social', 'published', now() + interval '1 day', true, false),
  ('ph-up-waitlist', 'Person history up waitlist', 'shabbat_dinner', 'published', now() + interval '2 days', true, false),
  ('ph-up-pending', 'Person history up pending', 'social', 'published', now() + interval '3 days', true, false),
  ('ph-up-not-going', 'Person history up not going', 'social', 'published', now() + interval '4 days', true, false),
  ('ph-up-declined', 'Person history up declined', 'social', 'published', now() + interval '5 days', true, false),
  ('ph-up-cancelled', 'Person history up cancelled', 'social', 'cancelled', now() + interval '6 days', true, false),
  ('ph-up-draft', 'Person history up draft', 'social', 'draft', now() + interval '7 days', true, false);

-- 17 past events for "many" (ph-many-01 is the newest), to check the cap of 15.
insert into public.events (slug, title, category, status, starts_at, rsvp_enabled, is_demo)
select 'ph-many-' || lpad(n::text, 2, '0'), 'Person history many ' || lpad(n::text, 2, '0'),
       'social', 'published', now() - make_interval(days => 30 + n), true, false
from generate_series(1, 17) n;

insert into ids select slug, id from public.events where slug like 'ph-%';

-- p: attended social-1, shabbat-1, shabbat-2 and checkin-in (checked in).
-- Not counted: draft and cancelled events, checkin-out (check-in used there,
-- p not checked in), not_going, a past waitlist and a past pending.
insert into public.rsvps (event_id, user_id, status, checked_in_at)
select e.id, u.id, v.status::public.rsvp_status, v.checked_in_at
from (values
  ('ph-draft', 'p', 'going', null::timestamptz),
  ('ph-cancelled', 'p', 'going', null),
  ('ph-social-1', 'p', 'going', null),
  ('ph-shabbat-1', 'p', 'going', null),
  ('ph-shabbat-1', 'q', 'going', null),
  ('ph-shabbat-2', 'p', 'going', null),
  ('ph-checkin-in', 'p', 'going', now() - interval '6 days'),
  ('ph-checkin-out', 'p', 'going', null),
  ('ph-checkin-out', 's', 'going', now() - interval '5 days'),
  ('ph-not-going', 'p', 'not_going', null),
  ('ph-not-going', 'r', 'not_going', null),
  ('ph-past-waitlist', 'p', 'waitlist', null),
  ('ph-latest', 'p', 'pending', null),
  ('ph-latest', 'q', 'going', null),
  ('ph-up-going', 'p', 'going', null),
  ('ph-up-going', 'r', 'going', null),
  ('ph-up-waitlist', 'p', 'waitlist', null),
  ('ph-up-pending', 'p', 'pending', null),
  ('ph-up-not-going', 'p', 'not_going', null),
  ('ph-up-declined', 'p', 'declined', null),
  ('ph-up-cancelled', 'p', 'going', null),
  ('ph-up-draft', 'p', 'going', null)
) v(event, person, status, checked_in_at)
join ids e on e.name = v.event
join ids u on u.name = v.person;

insert into public.rsvps (event_id, user_id, status)
select e.id, (select id from ids where name = 'many'), 'going'
from ids e where e.name like 'ph-many-%';

-- Shifts. Sign-ups for past or draft shifts are closed, so insert them
-- directly with triggers off (rolled back).
insert into public.volunteer_shifts (title, status, starts_at, slots, event_id) values
  ('ph-shift-up', 'open', now() + interval '2 days', 4, null),
  ('ph-shift-up-draft', 'draft', now() + interval '3 days', 4, null),
  ('ph-shift-past', 'open', now() - interval '3 days', 4, null),
  ('ph-shift-draft', 'draft', now() - interval '4 days', 4, null),
  ('ph-shift-cancelled-event', 'open', now() - interval '7 days', 4, (select id from ids where name = 'ph-cancelled')),
  ('ph-shift-past-event', 'open', now() - interval '9 days', 4, (select id from ids where name = 'ph-shabbat-1')),
  ('ph-shift-closed', 'closed', now() - interval '11 days', 4, null);
insert into public.volunteer_shifts (title, status, starts_at, slots, event_id)
select 'ph-many-shift-' || lpad(n::text, 2, '0'), 'open', now() - make_interval(days => 30 + n), 4, null
from generate_series(1, 12) n;

set local session_replication_role = replica;
insert into public.volunteer_signups (shift_id, user_id)
select s.id, (select id from ids where name = 'p')
from public.volunteer_shifts s where s.title like 'ph-shift-%';
insert into public.volunteer_signups (shift_id, user_id)
select s.id, (select id from ids where name = 'many')
from public.volunteer_shifts s where s.title like 'ph-many-shift-%';
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- Who can call them
-- ---------------------------------------------------------------------------
select tests.as_anon();
select throws_ok(
  format('select public.get_person_history(%L::uuid)', (select id from ids where name = 'p')),
  '42501', null, 'visitors cannot read a person''s history');
select throws_ok(
  format('select * from public.get_people_activity(array[%L]::uuid[])', (select id from ids where name = 'p')),
  '42501', null, 'visitors cannot read people''s activity');

select tests.as_user((select id from ids where name = 'p'));
select throws_ok(
  format('select public.get_person_history(%L::uuid)', (select id from ids where name = 'p')),
  'P0001', 'forbidden', 'students cannot read a history, not even their own');
select throws_ok(
  format('select * from public.get_people_activity(array[%L]::uuid[])', (select id from ids where name = 'p')),
  'P0001', 'forbidden', 'students cannot read people''s activity');

select tests.as_user((select id from ids where name = 'organizer'));
select throws_ok(
  format('select public.get_person_history(%L::uuid)', (select id from ids where name = 'p')),
  'P0001', 'forbidden', 'organizers cannot read a person''s history');
select throws_ok(
  format('select * from public.get_people_activity(array[%L]::uuid[])', (select id from ids where name = 'p')),
  'P0001', 'forbidden', 'organizers cannot read people''s activity');

-- ---------------------------------------------------------------------------
-- Results as an admin (kept in temp tables so the checks below read easily)
-- ---------------------------------------------------------------------------
reset role;
create temp table hist (name text primary key, h jsonb) on commit drop;
create temp table act (name text, user_id uuid, events integer, last_at timestamptz) on commit drop;
grant select, insert on hist, act to authenticated;

select tests.as_user((select id from ids where name = 'admin'));
select lives_ok(
  $$insert into hist select name, public.get_person_history(id) from ids where name in ('p', 'q', 'r', 's', 'many')$$,
  'an admin can read a person''s history');
insert into hist values ('unknown', public.get_person_history(gen_random_uuid()));
select lives_ok(
  $$insert into act
    select i.name, a.* from public.get_people_activity(
      (select array_agg(id) from ids where name in ('p', 'q', 'r', 's', 'many'))) a
    join ids i on i.id = a.user_id$$,
  'an admin can read people''s activity');
reset role;

-- ---------------------------------------------------------------------------
-- get_person_history
-- ---------------------------------------------------------------------------
select is((select (h ->> 'events')::int from hist where name = 'p'), 4,
  'events counts past published events you were going to; draft, cancelled, not going, waitlist and pending do not');
select is((select (h ->> 'shabbat_dinners')::int from hist where name = 'p'), 2,
  'Shabbat dinners are counted separately');
select is((select (h ->> 'helped')::int from hist where name = 'p'), 3,
  'helped counts past open and closed shifts, not a draft shift, a shift at a cancelled event or an upcoming shift');
select is((select (h ->> 'since')::timestamptz from hist where name = 'p'), now() - interval '10 days',
  '"since" is the first event attended, not an earlier draft or cancelled one');
select is((select (h ->> 'last_at')::timestamptz from hist where name = 'p'), now() - interval '6 days',
  '"last_at" is the last event attended, not a later one you were not counted at');
select is(
  (select array_agg(x ->> 'slug' order by o) from hist, jsonb_array_elements(h -> 'recent') with ordinality t(x, o)
   where name = 'p'),
  array['ph-checkin-in', 'ph-shabbat-2', 'ph-shabbat-1', 'ph-social-1'],
  'recent lists attended events newest first');
select ok(
  (select not (h -> 'recent' @> '[{"slug": "ph-checkin-out"}]') from hist where name = 'p'),
  'an event that used check-in where you were not checked in is left out');
select is(
  (select h -> 'recent' -> 1 from hist where name = 'p'),
  jsonb_build_object('title', 'Person history Shabbat two', 'slug', 'ph-shabbat-2',
                     'starts_at', now() - interval '8 days', 'category', 'shabbat_dinner'),
  'each recent item has title, slug, start time and category');
select is(
  (select array_agg(x ->> 'slug' order by o) from hist, jsonb_array_elements(h -> 'upcoming') with ordinality t(x, o)
   where name = 'p'),
  array['ph-up-going', 'ph-up-waitlist', 'ph-up-pending'],
  'upcoming lists going, waitlist and pending, soonest first; not going, declined, cancelled and draft events are left out');
select is(
  (select array_agg(x ->> 'status' order by o) from hist, jsonb_array_elements(h -> 'upcoming') with ordinality t(x, o)
   where name = 'p'),
  array['going', 'waitlist', 'pending'],
  'each upcoming item shows the RSVP status');
select is(
  (select h -> 'upcoming' -> 0 from hist where name = 'p'),
  jsonb_build_object('title', 'Person history up going', 'slug', 'ph-up-going',
                     'starts_at', now() + interval '1 day', 'status', 'going'),
  'each upcoming item has title, slug, start time and status');
select is(
  (select array_agg(x ->> 'title' order by o) from hist, jsonb_array_elements(h -> 'shifts') with ordinality t(x, o)
   where name = 'p'),
  array['ph-shift-up', 'ph-shift-past', 'ph-shift-past-event', 'ph-shift-closed'],
  'shifts lists upcoming and past shifts newest first, without draft shifts or shifts at a cancelled event');
select is(
  (select h -> 'shifts' -> 1 from hist where name = 'p'),
  jsonb_build_object('title', 'ph-shift-past', 'starts_at', now() - interval '3 days'),
  'each shift has a title and start time');

select is((select (h ->> 'events')::int from hist where name = 's'), 1,
  'someone checked in at an event that used check-in has it counted');
select is((select h -> 'recent' -> 0 ->> 'slug' from hist where name = 's'), 'ph-checkin-out',
  'the checked-in event is in their recent list');
select is((select (h ->> 'events')::int from hist where name = 'q'), 2,
  'another person''s numbers are their own');
select is((select (h ->> 'last_at')::timestamptz from hist where name = 'q'), now() - interval '1 day',
  'their last event is their own latest one');

select ok(
  (select (h ->> 'events')::int = 0 and (h ->> 'shabbat_dinners')::int = 0 and (h ->> 'helped')::int = 0
          and h ->> 'since' is null and h ->> 'last_at' is null
          and h -> 'recent' = '[]'::jsonb and h -> 'shifts' = '[]'::jsonb
   from hist where name = 'r'),
  'someone who has not attended anything yet has zero counts, no dates and empty lists');
select is(
  (select h -> 'upcoming' -> 0 ->> 'slug' from hist where name = 'r'),
  'ph-up-going', 'their upcoming plans still show');
select ok(
  (select (h ->> 'events')::int = 0 and h -> 'recent' = '[]'::jsonb and h -> 'upcoming' = '[]'::jsonb
          and h -> 'shifts' = '[]'::jsonb
   from hist where name = 'unknown'),
  'an unknown person id returns empty history');

select is((select (h ->> 'events')::int from hist where name = 'many'), 17,
  'events counts every attended event, past the size of the recent list');
select is((select jsonb_array_length(h -> 'recent') from hist where name = 'many'), 15,
  'recent is capped at 15');
select is(
  (select array_agg(x ->> 'slug' order by o) from hist, jsonb_array_elements(h -> 'recent') with ordinality t(x, o)
   where name = 'many'),
  (select array_agg('ph-many-' || lpad(n::text, 2, '0') order by n) from generate_series(1, 15) n),
  'the 15 in recent are the newest, newest first');
select is((select (h ->> 'helped')::int from hist where name = 'many'), 12,
  'helped counts every past shift, past the size of the shifts list');
select is((select jsonb_array_length(h -> 'shifts') from hist where name = 'many'), 10,
  'shifts is capped at 10');
select is(
  (select array_agg(x ->> 'title' order by o) from hist, jsonb_array_elements(h -> 'shifts') with ordinality t(x, o)
   where name = 'many'),
  (select array_agg('ph-many-shift-' || lpad(n::text, 2, '0') order by n) from generate_series(1, 10) n),
  'the 10 in shifts are the newest, newest first');

-- ---------------------------------------------------------------------------
-- get_people_activity
-- ---------------------------------------------------------------------------
select is((select array_agg(name order by name) from act), array['many', 'p', 'q', 's'],
  'activity has one row per person who attended something; someone who has not is left out');
select is((select events from act where name = 'p'), 4,
  'activity counts events with the same rules as the history');
select is((select last_at from act where name = 'p'), now() - interval '6 days',
  'activity shows the last event attended');
select is((select events from act where name = 'q'), 2, 'activity counts each person''s own events');
select is((select last_at from act where name = 'q'), now() - interval '1 day',
  'activity shows each person''s own last event');
select is((select events from act where name = 's'), 1,
  'activity counts an event where the person was checked in');
select is((select events from act where name = 'many'), 17, 'activity counts every attended event');

select tests.as_user((select id from ids where name = 'admin'));
select is(
  (select array_agg(user_id) from public.get_people_activity(array[(select id from ids where name = 'q')])),
  array[(select id from ids where name = 'q')],
  'activity only covers the people asked about');
select is(
  (select count(*)::int from public.get_people_activity(array[]::uuid[])),
  0, 'asking about no one returns nothing');
reset role;

select * from finish();
rollback;
