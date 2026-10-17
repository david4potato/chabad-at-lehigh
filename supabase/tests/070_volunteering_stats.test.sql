-- Volunteering (sign up to cook, set up or clean up) and simple stats:
-- sign-up rules and privacy, public spot counts, organizer access, event
-- changes reaching volunteers, get_my_stats and get_staff_stats.
begin;
select plan(51);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('a', tests.create_user('vol-a@lehigh.edu')),
  ('b', tests.create_user('vol-b@lehigh.edu')),
  ('c', tests.create_user('vol-c@lehigh.edu')),
  ('d', tests.create_user('vol-d@lehigh.edu')),
  ('organizer', tests.create_user('vol-organizer@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');

-- Stats below look at the last hour. Keep other data (demo seed, leftovers
-- from other runs) out of that window so the numbers are exact. Rolled back.
update public.events set status = 'draft'
where status = 'published' and starts_at >= now() - interval '1 hour' and starts_at < now();
delete from public.volunteer_shifts where starts_at >= now() - interval '1 hour' and starts_at < now();

insert into public.events (slug, title, category, status, starts_at, rsvp_enabled, is_demo) values
  -- Upcoming events with shifts
  ('vs-up', 'Volunteer test dinner', 'shabbat_dinner', 'published', now() + interval '3 days', true, false),
  ('vs-other', 'Volunteer test other', 'social', 'published', now() + interval '4 days', true, false),
  -- Past events inside the stats window (the last hour)
  ('vs-social', 'Volunteer test social', 'social', 'published', now() - interval '50 minutes', true, false),
  ('vs-shabbat-1', 'Volunteer test Shabbat one', 'shabbat_dinner', 'published', now() - interval '40 minutes', true, false),
  ('vs-shabbat-2', 'Volunteer test Shabbat two', 'shabbat_dinner', 'published', now() - interval '30 minutes', true, false),
  ('vs-checkin', 'Volunteer test check-in', 'social', 'published', now() - interval '20 minutes', true, false),
  ('vs-past-cancelled', 'Volunteer test cancelled', 'social', 'cancelled', now() - interval '10 minutes', true, false),
  -- Past event before the window
  ('vs-old', 'Volunteer test old', 'social', 'published', now() - interval '30 days', true, false);
-- Stats count events that have ended.
update public.events set ends_at = starts_at + interval '5 minutes'
where slug in ('vs-social', 'vs-shabbat-1', 'vs-shabbat-2', 'vs-checkin', 'vs-past-cancelled');
insert into ids select slug, id from public.events where slug like 'vs-%';

insert into public.volunteer_shifts (title, status, starts_at, slots, event_id) values
  ('vstest-open', 'open', now() + interval '2 days', 4, null),
  ('vstest-full', 'open', now() + interval '2 days', 1, null),
  ('vstest-draft', 'draft', now() + interval '2 days', 4, null),
  ('vstest-closed', 'closed', now() + interval '2 days', 4, null),
  ('vstest-started', 'open', now() - interval '2 hours', 4, null),
  ('vstest-past', 'open', now() + interval '1 day', 4, null),
  ('vstest-up', 'open', now() + interval '2 days', 4, (select id from ids where name = 'vs-up')),
  ('vstest-other', 'open', now() + interval '3 days', 4, (select id from ids where name = 'vs-other'));
insert into ids select title, id from public.volunteer_shifts where title like 'vstest-%';

-- ---------------------------------------------------------------------------
-- Signing up
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
select lives_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-open''',
  'a student can sign up for an open shift that has not started');
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-full';

select tests.as_user((select id from ids where name = 'b'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-open';

select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-open''',
  '23505', null, 'signing up twice for the same shift fails');
select is(
  (select count(*)::int from public.volunteer_signups where shift_id = (select id from ids where name = 'vstest-open')),
  1, 'a student sees only their own sign-up on a shift others joined too');
select ok(
  not exists (select 1 from public.volunteer_signups where user_id <> (select id from ids where name = 'a')),
  'a student sees no one else''s sign-ups');

select tests.as_user((select id from ids where name = 'b'));
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-full''',
  'P0001', 'signup_full', 'a full shift refuses new sign-ups');
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-draft''',
  'P0001', 'signup_closed', 'a draft shift refuses sign-ups');
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-closed''',
  'P0001', 'signup_closed', 'a closed shift refuses sign-ups');
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-started''',
  'P0001', 'signup_closed', 'a shift that already started refuses sign-ups');

select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  format('insert into public.volunteer_signups (shift_id, user_id) values (%L, %L)',
    (select id from ids where name = 'vstest-open'), (select id from ids where name = 'c')),
  '42501', null, 'a student cannot sign someone else up');
select is(
  tests.rows_affected(format('delete from public.volunteer_signups where shift_id = %L and user_id = %L',
    (select id from ids where name = 'vstest-open'), (select id from ids where name = 'b'))),
  0, 'a student cannot remove someone else''s sign-up');
select is(
  tests.rows_affected(format('delete from public.volunteer_signups where shift_id = %L',
    (select id from ids where name = 'vstest-full'))),
  1, 'a student can cancel their own sign-up');

select tests.as_user((select id from ids where name = 'b'));
select lives_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''vstest-full''',
  'a cancelled sign-up frees the spot for someone else');

reset role;
select ok(
  exists (select 1 from public.volunteer_signups
          where shift_id = (select id from ids where name = 'vstest-open') and user_id = (select id from ids where name = 'b')),
  'the other person''s sign-up is still there');

-- ---------------------------------------------------------------------------
-- Public spot counts (no names) and what students can see
-- ---------------------------------------------------------------------------
select tests.as_anon();
select is(
  (select taken from public.get_volunteer_counts(array[(select id from ids where name = 'vstest-open')])),
  2, 'visitors see how many spots are taken on an open shift');
select is(
  (select count(*)::int from public.get_volunteer_counts(array[
    (select id from ids where name = 'vstest-open'),
    (select id from ids where name = 'vstest-closed'),
    (select id from ids where name = 'vstest-draft')])),
  2, 'counts cover open and closed shifts');
select ok(
  not exists (select 1 from public.get_volunteer_counts(array[(select id from ids where name = 'vstest-draft')])),
  'counts leave out draft shifts');
select throws_ok('select * from public.volunteer_signups', '42501', null,
  'visitors cannot read sign-ups');

select tests.as_user((select id from ids where name = 'a'));
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'vstest-draft')),
  0, 'students cannot see draft shifts');
select ok(
  not exists (select 1 from public.get_volunteer_counts(array[(select id from ids where name = 'vstest-draft')])),
  'students get no count for a draft shift');

-- ---------------------------------------------------------------------------
-- Organizers manage shifts and see who signed up; students cannot
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'organizer'));
select lives_ok(
  'insert into public.volunteer_shifts (title, status, starts_at, slots) values (''vstest-organizer'', ''draft'', now() + interval ''5 days'', 2)',
  'an organizer can create a shift');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'vstest-draft')),
  1, 'organizers can see draft shifts');
reset role;
insert into ids select title, id from public.volunteer_shifts where title = 'vstest-organizer';

select tests.as_user((select id from ids where name = 'organizer'));
select is(
  tests.rows_affected(format('update public.volunteer_shifts set status = ''open'', slots = 3 where id = %L',
    (select id from ids where name = 'vstest-organizer'))),
  1, 'an organizer can update a shift');
select is(
  (select count(*)::int from public.volunteer_signups where shift_id = (select id from ids where name = 'vstest-open')),
  2, 'organizers see everyone signed up for a shift');
select is(
  (select array_agg(p.full_name order by p.full_name) from public.volunteer_signups v
   join public.profiles p on p.id = v.user_id
   where v.shift_id = (select id from ids where name = 'vstest-open')),
  array['vol-a', 'vol-b'], 'organizers can see the names of people who signed up');

select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  'insert into public.volunteer_shifts (title, status, starts_at, slots) values (''vstest-student'', ''open'', now() + interval ''5 days'', 2)',
  '42501', null, 'students cannot create shifts');
select is(
  tests.rows_affected(format('update public.volunteer_shifts set slots = 500 where id = %L',
    (select id from ids where name = 'vstest-open'))),
  0, 'students cannot change shifts');
select is(
  tests.rows_affected(format('delete from public.volunteer_shifts where id = %L',
    (select id from ids where name = 'vstest-open'))),
  0, 'students cannot delete shifts');

-- ---------------------------------------------------------------------------
-- Moving or cancelling an event tells the people signed up for its shifts
-- ---------------------------------------------------------------------------
reset role;
insert into public.rsvps (event_id, user_id, status) values
  ((select id from ids where name = 'vs-up'), (select id from ids where name = 'a'), 'going'),
  ((select id from ids where name = 'vs-up'), (select id from ids where name = 'c'), 'going'),
  ((select id from ids where name = 'vs-other'), (select id from ids where name = 'd'), 'going');

-- a RSVP'd and helps, b only helps, c only RSVP'd, d helps at another event.
select tests.as_user((select id from ids where name = 'a'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-up';
select tests.as_user((select id from ids where name = 'b'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-up';
select tests.as_user((select id from ids where name = 'd'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-other';

select tests.as_user((select id from ids where name = 'organizer'));
update public.events set location_name = 'Volunteer test new room' where id = (select id from ids where name = 'vs-up');
reset role;
select ok(
  exists (select 1 from public.notifications where user_id = (select id from ids where name = 'b')
          and event_id = (select id from ids where name = 'vs-up') and kind = 'event_changed' and is_urgent),
  'moving an event sends an urgent notice to someone who only signed up to help');
select is(
  (select count(*)::int from public.notifications where user_id = (select id from ids where name = 'a')
   and event_id = (select id from ids where name = 'vs-up') and kind = 'event_changed'),
  1, 'someone who RSVP''d and signed up to help gets one notice about the move');

select tests.as_user((select id from ids where name = 'organizer'));
update public.events set status = 'cancelled' where id = (select id from ids where name = 'vs-up');
reset role;
select is(
  (select array_agg(i.name order by i.name) from public.notifications n
   join ids i on i.id = n.user_id
   where n.event_id = (select id from ids where name = 'vs-up') and n.kind = 'event_cancelled' and n.is_urgent),
  array['a', 'b', 'c'], 'cancelling an event sends one urgent notice each to people who RSVP''d or signed up to help');
select ok(
  not exists (select 1 from public.notifications where user_id = (select id from ids where name = 'd')
              and event_id = (select id from ids where name = 'vs-up')),
  'people helping at a different event are not told');

-- ---------------------------------------------------------------------------
-- Past attendance and help for the stats
-- ---------------------------------------------------------------------------
-- b helps on a shift that then moves into the past (sign-ups need a future shift).
select tests.as_user((select id from ids where name = 'b'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'vstest-past';
reset role;
update public.volunteer_shifts set starts_at = now() - interval '35 minutes'
where id = (select id from ids where name = 'vstest-past');

insert into public.rsvps (event_id, user_id, status, guest_count, guest_status, checked_in_at) values
  ((select id from ids where name = 'vs-social'), (select id from ids where name = 'a'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-social'), (select id from ids where name = 'b'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-social'), (select id from ids where name = 'd'), 'not_going', 0, 'none', null),
  ((select id from ids where name = 'vs-shabbat-1'), (select id from ids where name = 'a'), 'going', 2, 'approved', null),
  ((select id from ids where name = 'vs-shabbat-1'), (select id from ids where name = 'c'), 'going', 1, 'pending', null),
  ((select id from ids where name = 'vs-shabbat-2'), (select id from ids where name = 'b'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-shabbat-2'), (select id from ids where name = 'c'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-checkin'), (select id from ids where name = 'a'), 'going', 0, 'none', now() - interval '15 minutes'),
  ((select id from ids where name = 'vs-checkin'), (select id from ids where name = 'b'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-past-cancelled'), (select id from ids where name = 'b'), 'going', 0, 'none', null),
  ((select id from ids where name = 'vs-old'), (select id from ids where name = 'c'), 'going', 0, 'none', null);

-- ---------------------------------------------------------------------------
-- get_my_stats
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'b'));
select is((public.get_my_stats() ->> 'events')::int, 2,
  'past events count once; a cancelled event and one where others were checked in but you weren''t do not');
select is((public.get_my_stats() ->> 'shabbat_dinners')::int, 1, 'Shabbat dinners are counted separately');
select is((public.get_my_stats() ->> 'helped')::int, 1, 'a past shift you signed up for counts as helping');

-- A past shift on a cancelled event doesn't count (insert directly; sign-ups for past shifts are closed).
reset role;
set local session_replication_role = replica;
insert into public.volunteer_shifts (event_id, title, starts_at, slots, status)
values ((select id from ids where name = 'vs-past-cancelled'), 'vstest-cancelled-event', now() - interval '3 hours', 2, 'open');
insert into public.volunteer_signups (shift_id, user_id)
select id, (select id from ids where name = 'b') from public.volunteer_shifts where title = 'vstest-cancelled-event';
set local session_replication_role = origin;
select tests.as_user((select id from ids where name = 'b'));
select is((public.get_my_stats() ->> 'helped')::int, 1, 'a shift at a cancelled event does not count as helping');
select is(public.get_my_stats() -> 'last' ->> 'slug', 'vs-shabbat-2', 'the last event attended is the most recent one');
select is((public.get_my_stats() ->> 'since')::timestamptz, now() - interval '50 minutes',
  '"since" is the first event attended');

select tests.as_user((select id from ids where name = 'a'));
select is((public.get_my_stats() ->> 'events')::int, 3, 'an event counts when you were checked in');
select is((public.get_my_stats() ->> 'helped')::int, 0, 'upcoming shifts do not count as helping yet');
select is(public.get_my_stats() -> 'last' ->> 'slug', 'vs-checkin', 'the checked-in event is the last one attended');

select tests.as_user((select id from ids where name = 'd'));
select ok(
  (select (s ->> 'events')::int = 0 and (s ->> 'helped')::int = 0 and s ->> 'last' is null and s ->> 'since' is null
   from public.get_my_stats() s),
  'someone with only upcoming plans and a "not going" has no stats yet');

select tests.as_anon();
select throws_ok('select public.get_my_stats()', '42501', null, 'visitors cannot ask for personal stats');

-- ---------------------------------------------------------------------------
-- get_staff_stats (last hour)
-- ---------------------------------------------------------------------------
select tests.as_anon();
select throws_ok('select public.get_staff_stats(now() - interval ''1 hour'')', '42501', null,
  'visitors cannot see staff stats');
select tests.as_user((select id from ids where name = 'a'));
select throws_ok('select public.get_staff_stats(now() - interval ''1 hour'')', 'P0001', 'forbidden',
  'students cannot see staff stats');

select tests.as_user((select id from ids where name = 'organizer'));
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'events_held')::int, 4,
  'events held counts past published events in the range');
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'shabbat_dinners')::int, 2,
  'Shabbat dinners held are counted separately');
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'people')::int, 3,
  'people counts each attendee once');
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'new_people')::int, 2,
  'new people leaves out someone who first came before the range');
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'avg_shabbat')::numeric, 3::numeric,
  'average at Shabbat includes approved guests but not pending ones');
select is((public.get_staff_stats(now() - interval '1 hour') ->> 'volunteer_signups')::int, 1,
  'volunteer sign-ups count shifts that took place in the range');
select is((public.get_staff_stats(now() + interval '1 hour') ->> 'events_held')::int, 0,
  'a range that starts in the future has nothing held yet');

select * from finish();
rollback;
