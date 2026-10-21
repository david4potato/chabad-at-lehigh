-- Final audit fixes: passwordless auth users, RSVP edits (approved guests,
-- over capacity, after the deadline, waitlist place), event-change triggers,
-- menu locks, guest dietary notes, staff cancellations, demo data removal and
-- audit actor references.
begin;
select plan(43);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('a', tests.create_user('fix-a@lehigh.edu')),
  ('b', tests.create_user('fix-b@lehigh.edu')),
  ('c', tests.create_user('fix-c@lehigh.edu')),
  ('d', tests.create_user('fix-d@lehigh.edu')),
  ('organizer', tests.create_user('fix-organizer@example.com')),
  ('kitchen', tests.create_user('fix-kitchen@example.com')),
  ('admin', tests.create_user('fix-admin@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'kitchen'), 'kitchen_staff');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

insert into public.events (slug, title, status, starts_at, capacity, approval_mode, max_guests_per_rsvp, rsvp_deadline, rsvp_enabled, has_meal, is_demo) values
  ('fx-guests', 'Guests need approval', 'published', now() + interval '3 days', 10, 'guests_need_approval', 2, null, true, false, false),
  ('fx-over', 'Over capacity', 'published', now() + interval '3 days', 3, 'auto', 1, null, true, false, false),
  ('fx-deadline', 'Deadline passed', 'published', now() + interval '3 days', null, 'auto', 0, now() - interval '1 hour', true, false, false),
  ('fx-closed', 'RSVPs closed', 'published', now() + interval '3 days', null, 'auto', 0, null, false, false, false),
  ('fx-approval', 'Everyone needs approval', 'published', now() + interval '3 days', 1, 'all_need_approval', 0, null, true, false, false),
  ('fx-raise', 'Capacity raised', 'published', now() + interval '3 days', 1, 'auto', 0, null, true, false, false),
  ('fx-cancel', 'Cancelled later', 'published', now() + interval '3 days', null, 'auto', 0, null, true, false, false),
  ('fx-past', 'Already over', 'published', now() - interval '2 days', null, 'auto', 0, null, true, false, false),
  ('fx-staff', 'Staff cancel', 'published', now() + interval '3 days', 1, 'auto', 0, null, true, false, false),
  ('fx-dinner', 'Fix test dinner', 'published', now() + interval '2 days', null, 'auto', 1, null, true, true, false),
  ('fx-demo', 'Demo test event', 'published', now() + interval '3 days', null, 'auto', 0, null, true, false, true);
insert into ids select slug, id from public.events where slug like 'fx-%';

-- ---------------------------------------------------------------------------
-- Sign-in is passwordless: passwords are never stored
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'fix-password@example.com',
        '$2a$10$abcdefghijklmnopqrstuuOoCQkgpaVw6yQpd6l4D8GxI7Qd2Su6', '{"provider":"email","providers":["email"]}', '{}', now(), now());
select is((select encrypted_password::text from auth.users where email = 'fix-password@example.com'), '',
  'a password sent at sign-up is not stored');
update auth.users set encrypted_password = 'another-password-hash' where email = 'fix-password@example.com';
select is((select encrypted_password::text from auth.users where email = 'fix-password@example.com'), '',
  'a password set later is not stored either');

-- ---------------------------------------------------------------------------
-- Approved guests: adding more needs the organizer
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
select public.set_rsvp((select id from ids where name = 'fx-guests'), 'going', 1);
select tests.as_user((select id from ids where name = 'organizer'));
select public.staff_decide_guests(
  (select id from public.rsvps where event_id = (select id from ids where name = 'fx-guests') and user_id = (select id from ids where name = 'a')),
  'approve');

select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  format('select public.set_rsvp(%L, ''going'', 2)', (select id from ids where name = 'fx-guests')),
  'P0001', 'guest_increase_needs_organizer', 'adding guests after they were approved needs the organizer');
select ok(
  (select status = 'going' and guest_count = 1 and guest_status = 'approved'
   from public.rsvps where event_id = (select id from ids where name = 'fx-guests')),
  'the approved guest is kept after a refused increase');
select ok(
  (select guest_count = 1 and guest_status = 'approved' and note = 'Running late'
   from public.set_rsvp((select id from ids where name = 'fx-guests'), 'going', 1, null, 'Running late')),
  'editing the note keeps the approved guest');

-- ---------------------------------------------------------------------------
-- Confirmed attendees can edit while the event is over capacity
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
select public.set_rsvp((select id from ids where name = 'fx-over'), 'going', 1);
select tests.as_user((select id from ids where name = 'b'));
select public.set_rsvp((select id from ids where name = 'fx-over'), 'going');
reset role;
-- 3 seats taken, capacity lowered to 2.
update public.events set capacity = 2 where id = (select id from ids where name = 'fx-over');

select tests.as_user((select id from ids where name = 'b'));
select ok(
  (select status = 'going' and note = 'Bringing dessert'
   from public.set_rsvp((select id from ids where name = 'fx-over'), 'going', 0, null, 'Bringing dessert')),
  'a confirmed attendee can edit their note while the event is over capacity');
select tests.as_user((select id from ids where name = 'a'));
select ok(
  (select status = 'going' and guest_count = 0 from public.set_rsvp((select id from ids where name = 'fx-over'), 'going', 0)),
  'a confirmed attendee can remove a guest while the event is over capacity');
select throws_ok(
  format('select public.set_rsvp(%L, ''going'', 1)', (select id from ids where name = 'fx-over')),
  'P0001', 'not_enough_capacity', 'adding the guest back is refused while there is no room');

-- ---------------------------------------------------------------------------
-- Cancelling stays possible after the deadline or when RSVPs are closed
-- ---------------------------------------------------------------------------
reset role;
insert into public.rsvps (event_id, user_id, status) values
  ((select id from ids where name = 'fx-deadline'), (select id from ids where name = 'a'), 'going'),
  ((select id from ids where name = 'fx-closed'), (select id from ids where name = 'a'), 'going');

select tests.as_user((select id from ids where name = 'a'));
select is((public.set_rsvp((select id from ids where name = 'fx-deadline'), 'not_going')).status, 'not_going'::public.rsvp_status,
  'people can cancel after the RSVP deadline');
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 'fx-deadline')),
  'P0001', 'rsvp_deadline_passed', 'but cannot RSVP going after the deadline');
select is((public.set_rsvp((select id from ids where name = 'fx-closed'), 'not_going')).status, 'not_going'::public.rsvp_status,
  'people can cancel when RSVPs are closed');
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 'fx-closed')),
  'P0001', 'rsvp_closed', 'but cannot RSVP going when RSVPs are closed');

-- ---------------------------------------------------------------------------
-- Approved but waitlisted (everyone needs approval): editing keeps the place
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
select public.set_rsvp((select id from ids where name = 'fx-approval'), 'going');
select tests.as_user((select id from ids where name = 'b'));
select public.set_rsvp((select id from ids where name = 'fx-approval'), 'going');
select tests.as_user((select id from ids where name = 'organizer'));
select public.staff_decide_rsvp(
  (select id from public.rsvps where event_id = (select id from ids where name = 'fx-approval') and user_id = (select id from ids where name = 'a')),
  'approve');
select is(
  (public.staff_decide_rsvp(
    (select id from public.rsvps where event_id = (select id from ids where name = 'fx-approval') and user_id = (select id from ids where name = 'b')),
    'approve')).status,
  'waitlist'::public.rsvp_status, 'approving someone when the event is full puts them on the waitlist');
reset role;
-- Move their place back in time so a reset to now() would show.
update public.rsvps set waitlisted_at = now() - interval '1 hour'
where event_id = (select id from ids where name = 'fx-approval') and user_id = (select id from ids where name = 'b');

select tests.as_user((select id from ids where name = 'b'));
select ok(
  (select status = 'waitlist' and waitlisted_at = now() - interval '1 hour' and note = 'Vegetarian please'
   from public.set_rsvp((select id from ids where name = 'fx-approval'), 'going', 0, null, 'Vegetarian please')),
  'an approved person on the waitlist keeps their place when they edit their RSVP');

-- ---------------------------------------------------------------------------
-- Raising capacity confirms people from the waitlist, oldest first
-- ---------------------------------------------------------------------------
reset role;
insert into public.rsvps (event_id, user_id, status, waitlisted_at) values
  ((select id from ids where name = 'fx-raise'), (select id from ids where name = 'a'), 'going', null),
  ((select id from ids where name = 'fx-raise'), (select id from ids where name = 'c'), 'waitlist', now() - interval '1 hour'),
  ((select id from ids where name = 'fx-raise'), (select id from ids where name = 'b'), 'waitlist', now() - interval '2 hours');

select tests.as_user((select id from ids where name = 'organizer'));
select is(tests.rows_affected(format('update public.events set capacity = 2 where id = %L', (select id from ids where name = 'fx-raise'))), 1,
  'an organizer can raise the capacity');
reset role;
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 'fx-raise') and user_id = (select id from ids where name = 'b')),
  'going'::public.rsvp_status, 'raising capacity confirms the person who has waited longest');
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 'fx-raise') and user_id = (select id from ids where name = 'c')),
  'waitlist'::public.rsvp_status, 'the next person stays on the waitlist while the event is full');
select ok(
  exists (select 1 from public.notifications where user_id = (select id from ids where name = 'b')
          and event_id = (select id from ids where name = 'fx-raise') and kind = 'rsvp_promoted'),
  'the promoted person gets a notification');

select tests.as_user((select id from ids where name = 'organizer'));
update public.events set capacity = null where id = (select id from ids where name = 'fx-raise');
reset role;
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 'fx-raise') and user_id = (select id from ids where name = 'c')),
  'going'::public.rsvp_status, 'removing the capacity limit confirms everyone left on the waitlist');

-- ---------------------------------------------------------------------------
-- Moving or cancelling an event notifies everyone who RSVP'd (urgent)
-- ---------------------------------------------------------------------------
insert into public.rsvps (event_id, user_id, status, waitlisted_at) values
  ((select id from ids where name = 'fx-cancel'), (select id from ids where name = 'a'), 'going', null),
  ((select id from ids where name = 'fx-cancel'), (select id from ids where name = 'b'), 'waitlist', now()),
  ((select id from ids where name = 'fx-cancel'), (select id from ids where name = 'c'), 'pending', null),
  ((select id from ids where name = 'fx-cancel'), (select id from ids where name = 'd'), 'not_going', null),
  ((select id from ids where name = 'fx-past'), (select id from ids where name = 'a'), 'going', null);

select tests.as_user((select id from ids where name = 'organizer'));
update public.events set location_name = 'Lehigh campus lawn' where id = (select id from ids where name = 'fx-cancel');
reset role;
select is(
  (select count(distinct n.user_id)::int from public.notifications n
   join ids i on i.id = n.user_id and i.name in ('a', 'b', 'c')
   where n.event_id = (select id from ids where name = 'fx-cancel') and n.kind = 'event_changed' and n.is_urgent),
  3, 'moving an event sends an urgent notice to people going, waitlisted or waiting for approval');

select tests.as_user((select id from ids where name = 'organizer'));
update public.events set status = 'cancelled' where id = (select id from ids where name = 'fx-cancel');
update public.events set status = 'cancelled' where id = (select id from ids where name = 'fx-past');
reset role;
select is(
  (select count(distinct n.user_id)::int from public.notifications n
   join ids i on i.id = n.user_id and i.name in ('a', 'b', 'c')
   where n.event_id = (select id from ids where name = 'fx-cancel') and n.kind = 'event_cancelled' and n.is_urgent),
  3, 'cancelling an event sends an urgent notice to people going, waitlisted or waiting for approval');
select ok(
  not exists (select 1 from public.notifications where user_id = (select id from ids where name = 'd')
              and event_id = (select id from ids where name = 'fx-cancel')),
  'people who said they are not going are not notified');
select ok(
  not exists (select 1 from public.notifications where event_id = (select id from ids where name = 'fx-past')),
  'changes to an event that is already over notify nobody');

-- ---------------------------------------------------------------------------
-- Menus: items cannot move between versions; every dish needs ingredients
-- ---------------------------------------------------------------------------
insert into public.ingredients (name) values ('Fix test rice');
insert into public.dishes (name, category) values ('Fix test rice bowl', 'main'), ('Fix test mystery dish', 'main');
insert into ids select 'rice_bowl', id from public.dishes where name = 'Fix test rice bowl';
insert into ids select 'mystery', id from public.dishes where name = 'Fix test mystery dish';
insert into public.dish_ingredients (dish_id, ingredient_id)
  select (select id from ids where name = 'rice_bowl'), id from public.ingredients where name = 'Fix test rice';

select tests.as_user((select id from ids where name = 'kitchen'));
select public.create_menu_draft((select id from ids where name = 'fx-dinner'));
reset role;
insert into ids select 'v1', id from public.menu_versions where event_id = (select id from ids where name = 'fx-dinner');
insert into public.menu_items (menu_version_id, dish_id)
  values ((select id from ids where name = 'v1'), (select id from ids where name = 'rice_bowl'));
select tests.as_user((select id from ids where name = 'kitchen'));
select public.publish_menu((select id from ids where name = 'v1'), '', true);
select public.create_menu_draft((select id from ids where name = 'fx-dinner'));
reset role;
insert into ids select 'v2', id from public.menu_versions where event_id = (select id from ids where name = 'fx-dinner') and version = 2;

select tests.as_user((select id from ids where name = 'kitchen'));
select throws_ok(
  format('update public.menu_items set menu_version_id = %L where menu_version_id = %L',
    (select id from ids where name = 'v2'), (select id from ids where name = 'v1')),
  '42501', null, 'staff cannot change which menu version an item belongs to');
select lives_ok(
  format('update public.menu_items set preparation_notes = ''Cooked in a shared pot'' where menu_version_id = %L',
    (select id from ids where name = 'v2')),
  'staff can still edit preparation notes on a draft');
reset role;
select throws_ok(
  format('update public.menu_items set menu_version_id = %L where menu_version_id = %L',
    (select id from ids where name = 'v2'), (select id from ids where name = 'v1')),
  'P0001', 'menu_locked', 'a published menu item cannot be moved into a draft');
select is((select count(*)::int from public.menu_items where menu_version_id = (select id from ids where name = 'v1')), 1,
  'the published menu keeps its dish');

select tests.as_user((select id from ids where name = 'kitchen'));
insert into public.menu_items (menu_version_id, dish_id)
  values ((select id from ids where name = 'v2'), (select id from ids where name = 'mystery'));
select throws_ok(
  format('select public.publish_menu(%L, ''Added a dish'', true)', (select id from ids where name = 'v2')),
  'P0001', 'dish_missing_ingredients', 'a menu with a dish that has no ingredients cannot be published');
reset role;
insert into public.dish_ingredients (dish_id, ingredient_id)
  select (select id from ids where name = 'mystery'), id from public.ingredients where name = 'Fix test rice';
select tests.as_user((select id from ids where name = 'kitchen'));
select is((public.publish_menu((select id from ids where name = 'v2'), 'Added a dish', true)).status, 'published'::public.menu_status,
  'once every dish has ingredients the menu can be published');

-- ---------------------------------------------------------------------------
-- Guest dietary notes reach the kitchen even when the RSVPer doesn't share
-- ---------------------------------------------------------------------------
reset role;
insert into public.rsvps (event_id, user_id, status, guest_count, guest_status)
  values ((select id from ids where name = 'fx-dinner'), (select id from ids where name = 'd'), 'going', 1, 'approved');
insert into public.dietary_profiles (user_id, notes_for_kitchen, share_with_kitchen)
  values ((select id from ids where name = 'd'), 'Private note', false);
insert into public.event_meal_preferences (event_id, user_id, preference, guest_dietary_notes)
  values ((select id from ids where name = 'fx-dinner'), (select id from ids where name = 'd'), 'No fish please', 'My guest has a peanut allergy');

select tests.as_user((select id from ids where name = 'kitchen'));
select ok(
  (select not shared and meal_preference is null and notes_for_kitchen is null
     and guest_dietary_notes = 'My guest has a peanut allergy'
   from public.event_dietary_report((select id from ids where name = 'fx-dinner'))
   where user_id = (select id from ids where name = 'd')),
  'the kitchen sees guest notes, but not the person''s own details, when they turned off sharing');
-- Kitchen staff get the full summary; organizers get no breakdown while fewer than 5 people share.
select tests.as_user((select id from ids where name = 'kitchen'));
select is((public.event_dietary_summary((select id from ids where name = 'fx-dinner')) ->> 'with_guest_notes')::int, 1,
  'the anonymous summary counts guest notes from everyone');

-- ---------------------------------------------------------------------------
-- Staff cancel an RSVP for someone
-- ---------------------------------------------------------------------------
reset role;
insert into public.rsvps (event_id, user_id, status, waitlisted_at) values
  ((select id from ids where name = 'fx-staff'), (select id from ids where name = 'a'), 'going', null),
  ((select id from ids where name = 'fx-staff'), (select id from ids where name = 'b'), 'waitlist', now());
insert into ids select 'staff_rsvp', id from public.rsvps
  where event_id = (select id from ids where name = 'fx-staff') and user_id = (select id from ids where name = 'a');

select tests.as_anon();
select throws_ok(format('select public.staff_cancel_rsvp(%L)', (select id from ids where name = 'staff_rsvp')),
  '42501', null, 'anonymous visitors cannot cancel RSVPs');
select tests.as_user((select id from ids where name = 'c'));
select throws_ok(format('select public.staff_cancel_rsvp(%L)', (select id from ids where name = 'staff_rsvp')),
  'P0001', 'forbidden', 'students cannot cancel someone else''s RSVP');
select tests.as_user((select id from ids where name = 'organizer'));
select ok(
  (select status = 'not_going' and guest_count = 0 and waitlisted_at is null
   from public.staff_cancel_rsvp((select id from ids where name = 'staff_rsvp'))),
  'an organizer can cancel an RSVP for someone');
reset role;
select ok(
  exists (select 1 from public.notifications where user_id = (select id from ids where name = 'a')
          and event_id = (select id from ids where name = 'fx-staff') and kind = 'rsvp_cancelled'),
  'the person is told their RSVP was cancelled');
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 'fx-staff') and user_id = (select id from ids where name = 'b')),
  'going'::public.rsvp_status, 'the freed seat goes to the next person on the waitlist');
select tests.as_user((select id from ids where name = 'organizer'));
select throws_ok(format('select public.staff_cancel_rsvp(%L)', (select id from ids where name = 'staff_rsvp')),
  'P0001', 'invalid_state', 'an RSVP that is already cancelled cannot be cancelled again');

reset role;
select ok(
  (select actor_id = (select id from ids where name = 'organizer') and actor_ref = (select id from ids where name = 'organizer')
   from public.audit_events where action = 'rsvp.staff_cancel' and entity_id = (select id from ids where name = 'staff_rsvp')::text),
  'the audit log records who cancelled the RSVP');

-- ---------------------------------------------------------------------------
-- Removing demo data (admins only)
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'organizer'));
select throws_ok('select public.admin_remove_demo_data()', 'P0001', 'forbidden', 'organizers cannot remove demo data');
select tests.as_user((select id from ids where name = 'admin'));
select lives_ok('select public.admin_remove_demo_data()', 'an admin can remove demo data');
reset role;
select is((select count(*)::int from public.events where is_demo), 0, 'every demo event is removed');
select is((select count(*)::int from public.events where slug = 'fx-dinner'), 1, 'real events (with published menus) are kept');

-- ---------------------------------------------------------------------------
-- Audit entries stay attributable after the actor deletes their account
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'organizer'));
select public.delete_my_account();
reset role;
select ok(
  (select actor_id is null and actor_ref = (select id from ids where name = 'organizer')
   from public.audit_events where action = 'rsvp.staff_cancel' and entity_id = (select id from ids where name = 'staff_rsvp')::text),
  'after the organizer deletes their account, the audit entry keeps a bare reference to them');

select * from finish();
rollback;
