-- Volunteering fixes from review: who can see a shift tied to an event, sign-ups
-- closed when the event isn't published, signing up twice on a full shift,
-- staff_remove_signup, notices when an upcoming shift moves or is deleted, and
-- the stats rules (an event counts once it has ended, the check-in rule needs at
-- least half the people going checked in, Avg. at Shabbat skips empty dinners).
begin;
select plan(43);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('a', tests.create_user('rf-a@lehigh.edu')),
  ('b', tests.create_user('rf-b@lehigh.edu')),
  ('c', tests.create_user('rf-c@lehigh.edu')),
  ('organizer', tests.create_user('rf-organizer@example.com')),
  ('admin', tests.create_user('rf-admin@example.com')),
  -- Stats only
  ('p', tests.create_user('rf-p@lehigh.edu')),
  ('g1', tests.create_user('rf-g1@lehigh.edu')),
  ('g2', tests.create_user('rf-g2@lehigh.edu')),
  ('g3', tests.create_user('rf-g3@lehigh.edu')),
  ('h1', tests.create_user('rf-h1@lehigh.edu')),
  ('h2', tests.create_user('rf-h2@lehigh.edu')),
  ('h3', tests.create_user('rf-h3@lehigh.edu')),
  ('k1', tests.create_user('rf-k1@lehigh.edu')),
  ('k2', tests.create_user('rf-k2@lehigh.edu')),
  ('k3', tests.create_user('rf-k3@lehigh.edu')),
  ('k4', tests.create_user('rf-k4@lehigh.edu'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

-- The staff stats below look at the last 6 hours. Keep other data (demo seed,
-- leftovers from other runs) out of that window so the numbers are exact. Rolled back.
update public.events set status = 'draft'
where status = 'published' and starts_at >= now() - interval '6 hours' and starts_at < now();

insert into public.events (slug, title, category, status, visibility, starts_at, ends_at, rsvp_enabled, is_demo) values
  -- Upcoming events with shifts
  ('rf-draft', 'Review fix draft', 'social', 'draft', 'public', now() + interval '3 days', null, true, false),
  ('rf-cancelled', 'Review fix cancelled', 'social', 'cancelled', 'public', now() + interval '3 days', null, true, false),
  ('rf-members', 'Review fix members only', 'social', 'published', 'members', now() + interval '3 days', null, true, false),
  ('rf-public', 'Review fix public', 'social', 'published', 'public', now() + interval '3 days', null, true, false),
  ('rf-doomed', 'Review fix deleted event', 'social', 'published', 'public', now() + interval '5 days', null, true, false),
  -- Stats (inside the 6-hour window)
  ('rf-in-progress', 'Review fix Shabbat in progress', 'shabbat_dinner', 'published', 'public',
   now() - interval '1 hour', null, true, false),
  ('rf-running-late', 'Review fix running late', 'social', 'published', 'public',
   now() - interval '2 hours', now() + interval '30 minutes', true, false),
  ('rf-ended-default', 'Review fix ended by default', 'social', 'published', 'public',
   now() - interval '4 hours', null, true, false),
  ('rf-one-checked-in', 'Review fix Shabbat one checked in', 'shabbat_dinner', 'published', 'public',
   now() - interval '5 hours', now() - interval '4 hours', true, false),
  ('rf-two-checked-in', 'Review fix two checked in', 'social', 'published', 'public',
   now() - interval '5 hours', now() - interval '4 hours', true, false),
  ('rf-half-checked-in', 'Review fix half checked in', 'social', 'published', 'public',
   now() - interval '5 hours', now() - interval '4 hours', true, false),
  ('rf-empty-shabbat', 'Review fix empty Shabbat', 'shabbat_dinner', 'published', 'public',
   now() - interval '3 hours 30 minutes', now() - interval '3 hours', true, false);
insert into ids select slug, id from public.events where slug like 'rf-%';

insert into public.volunteer_shifts (title, status, starts_at, ends_at, slots, event_id) values
  ('rftest-draft-event', 'open', now() + interval '2 days', null, 4, (select id from ids where name = 'rf-draft')),
  ('rftest-cancelled-event', 'open', now() + interval '2 days', null, 4, (select id from ids where name = 'rf-cancelled')),
  ('rftest-members', 'open', now() + interval '2 days', null, 4, (select id from ids where name = 'rf-members')),
  ('rftest-public', 'open', now() + interval '2 days', null, 4, (select id from ids where name = 'rf-public')),
  ('rftest-full', 'open', now() + interval '2 days', null, 1, null),
  ('rftest-remove', 'open', now() + interval '2 days', null, 4, null),
  ('rftest-move', 'open', now() + interval '2 days', null, 4, null),
  ('rftest-delete', 'open', now() + interval '2 days', null, 4, null),
  ('rftest-past', 'open', now() - interval '2 days', null, 4, null),
  ('rftest-doomed', 'open', now() + interval '4 days', null, 4, (select id from ids where name = 'rf-doomed')),
  -- Stats
  ('rftest-running', 'open', now() - interval '1 hour', now() + interval '1 hour', 4, null),
  ('rftest-done', 'open', now() - interval '3 hours', now() - interval '2 hours', 4, null);
insert into ids select title, id from public.volunteer_shifts where title like 'rftest-%';

-- ---------------------------------------------------------------------------
-- Who can see a shift tied to an event
-- ---------------------------------------------------------------------------
select tests.as_anon();
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-draft-event')),
  0, 'visitors cannot see an open shift tied to a draft event');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-cancelled-event')),
  0, 'visitors cannot see an open shift tied to a cancelled event');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-members')),
  0, 'visitors cannot see a shift at a members-only event');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-public')),
  1, 'visitors can see a shift at a published public event');
select is(
  (select array_agg(i.name order by i.name)
   from public.get_volunteer_counts(array(select id from ids where name in
     ('rftest-draft-event', 'rftest-cancelled-event', 'rftest-members', 'rftest-public'))) c
   join ids i on i.id = c.shift_id),
  array['rftest-public'], 'visitors get counts only for shifts they can see');

select tests.as_user((select id from ids where name = 'a'));
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-draft-event')),
  0, 'students cannot see an open shift tied to a draft event');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-cancelled-event')),
  0, 'students cannot see an open shift tied to a cancelled event');
select is(
  (select count(*)::int from public.volunteer_shifts where id = (select id from ids where name = 'rftest-members')),
  1, 'students can see a shift at a members-only event');
select is(
  (select array_agg(i.name order by i.name)
   from public.get_volunteer_counts(array(select id from ids where name in
     ('rftest-draft-event', 'rftest-cancelled-event', 'rftest-members', 'rftest-public'))) c
   join ids i on i.id = c.shift_id),
  array['rftest-members', 'rftest-public'], 'students get counts only for shifts they can see');

select tests.as_user((select id from ids where name = 'organizer'));
select is(
  (select count(*)::int from public.volunteer_shifts where id in (select id from ids where name in
     ('rftest-draft-event', 'rftest-cancelled-event', 'rftest-members', 'rftest-public'))),
  4, 'organizers see shifts at draft, cancelled and members-only events');
select is(
  (select count(*)::int from public.get_volunteer_counts(array(select id from ids where name in
     ('rftest-draft-event', 'rftest-cancelled-event', 'rftest-members', 'rftest-public')))),
  4, 'organizers get counts for all of them');

-- ---------------------------------------------------------------------------
-- Sign-ups close when the event isn't published
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'b'));
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''rftest-draft-event''',
  'P0001', 'signup_closed', 'a shift whose event is a draft refuses sign-ups');
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''rftest-cancelled-event''',
  'P0001', 'signup_closed', 'a shift whose event was cancelled refuses sign-ups');
select lives_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''rftest-members''',
  'a student can sign up for a shift at a members-only event');

-- ---------------------------------------------------------------------------
-- Signing up again on a full shift you already hold
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'rftest-full';
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''rftest-full''',
  '23505', null, 'signing up again for a full shift you hold says "already signed up", not "full"');
select tests.as_user((select id from ids where name = 'b'));
select throws_ok(
  'insert into public.volunteer_signups (shift_id) select id from ids where name = ''rftest-full''',
  'P0001', 'signup_full', 'someone else still hears the shift is full');

-- ---------------------------------------------------------------------------
-- staff_remove_signup
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'rftest-remove';
select tests.as_user((select id from ids where name = 'b'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'rftest-remove';

select tests.as_anon();
select throws_ok(
  format('select public.staff_remove_signup(%L, %L)',
    (select id from ids where name = 'rftest-remove'), (select id from ids where name = 'a')),
  '42501', null, 'visitors cannot take someone off a shift');

select tests.as_user((select id from ids where name = 'b'));
select throws_ok(
  format('select public.staff_remove_signup(%L, %L)',
    (select id from ids where name = 'rftest-remove'), (select id from ids where name = 'a')),
  'P0001', 'forbidden', 'students cannot take someone off a shift');

select tests.as_user((select id from ids where name = 'organizer'));
select lives_ok(
  format('select public.staff_remove_signup(%L, %L)',
    (select id from ids where name = 'rftest-remove'), (select id from ids where name = 'a')),
  'an organizer can take someone off a shift');

reset role;
select is(
  (select array_agg(i.name order by i.name) from public.volunteer_signups v
   join ids i on i.id = v.user_id
   where v.shift_id = (select id from ids where name = 'rftest-remove')),
  array['b'], 'only that person''s sign-up is removed');
select is(
  (select count(*)::int from public.notifications
   where user_id = (select id from ids where name = 'a') and kind = 'shift_removed'
     and link = '/volunteer' and body like '%rftest-remove%'),
  1, 'the person taken off gets a notice');
select ok(
  not exists (select 1 from public.notifications
              where user_id = (select id from ids where name = 'b') and kind = 'shift_removed'),
  'the others on the shift are not told');
select ok(
  exists (select 1 from public.audit_events
          where action = 'volunteer.signup_removed' and entity_type = 'volunteer_shifts'
            and entity_id = (select id from ids where name = 'rftest-remove')::text
            and details ->> 'user_id' = (select id from ids where name = 'a')::text
            and actor_id = (select id from ids where name = 'organizer')),
  'taking someone off a shift is audited with who did it and who was removed');

select tests.as_user((select id from ids where name = 'organizer'));
select throws_ok(
  format('select public.staff_remove_signup(%L, %L)',
    (select id from ids where name = 'rftest-remove'), (select id from ids where name = 'a')),
  'P0001', 'signup_not_found', 'taking off someone who is not signed up says so');
select throws_ok(
  format('select public.staff_remove_signup(%L, %L)',
    gen_random_uuid(), (select id from ids where name = 'b')),
  'P0001', 'shift_not_found', 'an unknown shift says so');

-- ---------------------------------------------------------------------------
-- Moving or deleting an upcoming shift tells the people signed up
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
insert into public.volunteer_signups (shift_id) select id from ids
where name in ('rftest-move', 'rftest-delete', 'rftest-doomed');
select tests.as_user((select id from ids where name = 'b'));
insert into public.volunteer_signups (shift_id) select id from ids where name = 'rftest-move';
-- Sign-ups for past shifts are closed, so insert directly with triggers off (rolled back).
reset role;
set local session_replication_role = replica;
insert into public.volunteer_signups (shift_id, user_id)
select s.id, u.id
from (values ('rftest-past', 'a'), ('rftest-running', 'p'), ('rftest-done', 'p')) v(shift, person)
join ids s on s.name = v.shift
join ids u on u.name = v.person;
set local session_replication_role = origin;

select tests.as_user((select id from ids where name = 'organizer'));
update public.volunteer_shifts set starts_at = starts_at + interval '1 hour'
where id = (select id from ids where name = 'rftest-move');
reset role;
select is(
  (select array_agg(i.name order by i.name) from public.notifications n
   join ids i on i.id = n.user_id
   where n.kind = 'shift_changed' and n.is_urgent and n.title = 'Shift time changed: rftest-move'),
  array['a', 'b'], 'moving an upcoming shift sends one urgent notice to each person signed up, and no one else');

select tests.as_user((select id from ids where name = 'organizer'));
update public.volunteer_shifts set slots = 5, description = 'Bring an apron.'
where id = (select id from ids where name = 'rftest-move');
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = (select id from ids where name = 'a') and kind = 'shift_changed' and title like '%rftest-move'),
  1, 'changing only the spots or description does not send a notice');

select tests.as_user((select id from ids where name = 'organizer'));
update public.volunteer_shifts set ends_at = starts_at + interval '2 hours'
where id = (select id from ids where name = 'rftest-move');
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = (select id from ids where name = 'a') and kind = 'shift_changed' and title like '%rftest-move'),
  2, 'changing the end time sends a notice too');

select tests.as_user((select id from ids where name = 'organizer'));
delete from public.volunteer_shifts where id = (select id from ids where name = 'rftest-delete');
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = (select id from ids where name = 'a') and kind = 'shift_changed' and is_urgent
     and title = 'Shift cancelled: rftest-delete'),
  1, 'deleting an upcoming shift sends an urgent notice to the people signed up');

select tests.as_user((select id from ids where name = 'organizer'));
select is(
  tests.rows_affected(format('delete from public.volunteer_shifts where id = %L', (select id from ids where name = 'rftest-past'))),
  1, 'an organizer can delete a past shift people signed up for');
reset role;
select ok(
  not exists (select 1 from public.notifications where title like '%rftest-past%'),
  'deleting a past shift sends no notice');

select tests.as_user((select id from ids where name = 'admin'));
select is(
  tests.rows_affected(format('delete from public.events where id = %L', (select id from ids where name = 'rf-doomed'))),
  1, 'an admin can delete an event whose shift has sign-ups');
reset role;
select ok(
  not exists (select 1 from public.volunteer_shifts where id = (select id from ids where name = 'rftest-doomed')),
  'the event''s shifts go with it');
select ok(
  not exists (select 1 from public.notifications where title like '%rftest-doomed%'),
  'deleting the whole event does not send shift notices');

-- ---------------------------------------------------------------------------
-- Stats
-- ---------------------------------------------------------------------------
-- p: two events still going on (one without an end time, one that runs late)
-- and one that ended (3-hour default). g: 1 of 3 checked in. h: 2 of 3 checked
-- in, plus two "not going" who don't count toward the half. k: 2 of 4 (half).
insert into public.rsvps (event_id, user_id, status, checked_in_at)
select e.id, u.id, v.status::public.rsvp_status, v.checked_in_at
from (values
  ('rf-in-progress', 'p', 'going', null::timestamptz),
  ('rf-running-late', 'p', 'going', null),
  ('rf-ended-default', 'p', 'going', null),
  ('rf-one-checked-in', 'g1', 'going', now() - interval '5 hours'),
  ('rf-one-checked-in', 'g2', 'going', null),
  ('rf-one-checked-in', 'g3', 'going', null),
  ('rf-two-checked-in', 'h1', 'going', now() - interval '5 hours'),
  ('rf-two-checked-in', 'h2', 'going', now() - interval '5 hours'),
  ('rf-two-checked-in', 'h3', 'going', null),
  ('rf-two-checked-in', 'b', 'not_going', null),
  ('rf-two-checked-in', 'c', 'not_going', null),
  ('rf-half-checked-in', 'k1', 'going', now() - interval '5 hours'),
  ('rf-half-checked-in', 'k2', 'going', now() - interval '5 hours'),
  ('rf-half-checked-in', 'k3', 'going', null),
  ('rf-half-checked-in', 'k4', 'going', null)
) v(event, person, status, checked_in_at)
join ids e on e.name = v.event
join ids u on u.name = v.person;

select tests.as_user((select id from ids where name = 'p'));
select is((public.get_my_stats() ->> 'events')::int, 1,
  'events still in progress (with or without an end time) do not count yet; one past the 3-hour default does');
select is(public.get_my_stats() -> 'last' ->> 'slug', 'rf-ended-default',
  'the last event attended is the one that ended, not one still going on');
select is((public.get_my_stats() ->> 'helped')::int, 1,
  'a shift still under way does not count as helping; one that ended does');

select tests.as_user((select id from ids where name = 'admin'));
select is(
  (select array_agg(i.name order by i.name)
   from public.get_people_activity(array(select id from ids where name in ('g1', 'g2', 'g3'))) a
   join ids i on i.id = a.user_id),
  array['g1', 'g2', 'g3'], 'with 1 of 3 going checked in, all three count');
select is(
  (select array_agg(i.name order by i.name)
   from public.get_people_activity(array(select id from ids where name in ('h1', 'h2', 'h3'))) a
   join ids i on i.id = a.user_id),
  array['h1', 'h2'], 'with 2 of 3 going checked in, only those 2 count ("not going" RSVPs are left out of the half)');
select is(
  (select array_agg(i.name order by i.name)
   from public.get_people_activity(array(select id from ids where name in ('k1', 'k2', 'k3', 'k4'))) a
   join ids i on i.id = a.user_id),
  array['k1', 'k2'], 'with exactly half checked in, only those checked in count');

select tests.as_user((select id from ids where name = 'organizer'));
select is((public.get_staff_stats(now() - interval '6 hours') ->> 'events_held')::int, 5,
  'events still in progress are not counted as held');
select is((public.get_staff_stats(now() - interval '6 hours') ->> 'people')::int, 8,
  'people follows the same attended rules');
select is((public.get_staff_stats(now() - interval '6 hours') ->> 'avg_shabbat')::numeric, 3::numeric,
  'Avg. at Shabbat leaves out a dinner nobody attended and one still in progress');
reset role;

select * from finish();
rollback;
