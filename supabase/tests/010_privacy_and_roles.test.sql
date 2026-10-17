-- Dietary privacy, role management and the audit log.
begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- Setup (as postgres)
-- ---------------------------------------------------------------------------
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('student_a', tests.create_user('priv-a@lehigh.edu')),
  ('student_b', tests.create_user('priv-b@lehigh.edu')),
  ('guest', tests.create_user('priv-guest@example.com')),
  ('organizer', tests.create_user('priv-organizer@example.com')),
  ('kitchen', tests.create_user('priv-kitchen@example.com')),
  ('admin', tests.create_user('priv-admin@example.com'));

select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'kitchen'), 'kitchen_staff');
select tests.add_role((select id from ids where name = 'admin'), 'admin');
-- Make our admin the only admin for the "last admin" test (rolled back afterwards).
delete from public.user_roles where role = 'admin' and user_id <> (select id from ids where name = 'admin');

insert into public.events (slug, title, status, starts_at, has_meal)
values ('priv-dinner', 'Privacy test dinner', 'published', now() + interval '2 days', true);
insert into ids values ('event', (select id from public.events where slug = 'priv-dinner'));

insert into public.rsvps (event_id, user_id, status) values
  ((select id from ids where name = 'event'), (select id from ids where name = 'student_a'), 'going'),
  ((select id from ids where name = 'event'), (select id from ids where name = 'student_b'), 'going');

insert into public.dietary_profiles (user_id, diets, notes_for_kitchen, share_with_kitchen) values
  ((select id from ids where name = 'student_a'), '{vegetarian}', 'Severe sesame allergy', true),
  ((select id from ids where name = 'student_b'), '{}', 'Private note', false);
insert into public.user_allergens (user_id, allergen_code, severity) values
  ((select id from ids where name = 'student_a'), 'sesame_seed', 'severe'),
  ((select id from ids where name = 'student_b'), 'peanuts', 'allergy');
insert into public.event_meal_preferences (event_id, user_id, preference) values
  ((select id from ids where name = 'event'), (select id from ids where name = 'student_b'), 'No fish please');

-- ---------------------------------------------------------------------------
-- Default roles
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from public.user_roles where user_id = (select id from ids where name = 'student_a') and role = 'student'),
  '@lehigh.edu sign-ups get the student role');
select ok(
  exists (select 1 from public.user_roles where user_id = (select id from ids where name = 'guest') and role = 'community_guest'),
  'other sign-ups get the community_guest role');

-- ---------------------------------------------------------------------------
-- Dietary data is owner-only
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'student_a'));
select is((select count(*)::int from public.dietary_profiles), 1, 'a student sees only their own dietary profile');
select is((select count(*)::int from public.user_allergens where user_id = (select id from ids where name = 'student_b')), 0,
  'a student cannot read another student''s allergens');
select is((select count(*)::int from public.event_meal_preferences), 0, 'a student cannot read others'' meal preferences');
select is((select count(*)::int from public.profiles), 1, 'a student sees only their own profile');
select throws_ok(
  format('select public.event_dietary_summary(%L)', (select id from ids where name = 'event')),
  'P0001', 'forbidden', 'a student cannot get the dietary summary');

select tests.as_anon();
select throws_ok('select count(*) from public.dietary_profiles', '42501', null, 'anonymous visitors cannot read dietary profiles');
select throws_ok('select count(*) from public.user_allergens', '42501', null, 'anonymous visitors cannot read allergens');

-- Organizer: anonymous counts only
select tests.as_user((select id from ids where name = 'organizer'));
select is((select count(*)::int from public.user_allergens), 0, 'an organizer cannot read allergens directly');
select throws_ok(
  format('select * from public.event_dietary_report(%L)', (select id from ids where name = 'event')),
  'P0001', 'forbidden', 'an organizer cannot open the named dietary report');
select is(
  (public.event_dietary_summary((select id from ids where name = 'event')) ->> 'attendees')::int, 2,
  'an organizer gets the anonymous dietary summary');
select is(
  (public.event_dietary_summary((select id from ids where name = 'event')) ->> 'not_shared')::int, 1,
  'the summary counts people who chose not to share');
select ok((select count(*) from public.profiles) >= 6, 'organizers can read profiles to manage RSVPs');

-- Kitchen staff: named report, respecting consent, audited
select tests.as_user((select id from ids where name = 'kitchen'));
select is(
  (select count(*)::int from public.event_dietary_report((select id from ids where name = 'event'))), 2,
  'kitchen staff see everyone attending in the named report');
select ok(
  (select allergens @> '[{"code":"sesame_seed","severity":"severe"}]'::jsonb
   from public.event_dietary_report((select id from ids where name = 'event'))
   where user_id = (select id from ids where name = 'student_a')),
  'the report includes allergens and severity for people who share');
select ok(
  (select not shared and allergens is null and notes_for_kitchen is null and meal_preference is null
   from public.event_dietary_report((select id from ids where name = 'event'))
   where user_id = (select id from ids where name = 'student_b')),
  'people who opted out are listed without any dietary details');
select is((select count(*)::int from public.profiles), 1, 'kitchen staff cannot browse other profiles directly');

reset role;
select ok(
  (select count(*) from public.audit_events where action = 'dietary_report.viewed'
     and entity_id = (select id from ids where name = 'event')::text) >= 2,
  'every named dietary report view is written to the audit log');

-- ---------------------------------------------------------------------------
-- Roles and admin functions
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'student_a'));
select throws_ok(
  format('insert into public.user_roles (user_id, role) values (%L, ''admin'')', (select id from ids where name = 'student_a')),
  '42501', null, 'a student cannot give themselves a role');
select throws_ok($$ select public.admin_grant_role('x@example.com', 'admin') $$, 'P0001', 'forbidden',
  'a student cannot call admin_grant_role');
select is((select count(*)::int from public.audit_events), 0, 'a student cannot read the audit log');

select tests.as_user((select id from ids where name = 'admin'));
select is(public.admin_grant_role('Future.Organizer@Example.com', 'organizer'), 'pending',
  'granting a role to someone who has not signed in yet is saved as pending');
select ok((select count(*) from public.audit_events) > 0, 'admins can read the audit log');
select throws_ok(
  format('select public.admin_revoke_role(%L, ''admin'')', (select id from ids where name = 'admin')),
  'P0001', 'last_admin', 'the last admin cannot be removed');

reset role;
select tests.create_user('future.organizer@example.com');
select ok(
  exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
          where p.email = 'future.organizer@example.com' and ur.role = 'organizer')
  and not exists (select 1 from public.pending_role_grants where email = 'future.organizer@example.com'),
  'a pending role is applied (and cleared) on first sign-in');
select ok(
  exists (select 1 from public.audit_events where action = 'user_roles.insert' and details ->> 'role' = 'organizer'),
  'role grants are recorded in the audit log');

select * from finish();
rollback;
