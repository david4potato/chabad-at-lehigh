-- "Duplicate for next week" menu copy, the "back on" notice when a cancelled
-- event is reinstated, and role details in the audit log.
begin;
select plan(12);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('student', tests.create_user('dup-student@lehigh.edu')),
  ('organizer', tests.create_user('dup-organizer@example.com')),
  ('admin', tests.create_user('dup-admin@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

insert into public.events (slug, title, status, starts_at, has_meal, is_demo) values
  ('dup-source', 'Dup source dinner', 'published', now() - interval '6 days', true, false),
  ('dup-target', 'Dup target dinner', 'draft', now() + interval '1 day', true, false),
  ('dup-empty', 'Dup no menu', 'published', now() - interval '5 days', true, false),
  ('dup-target-2', 'Dup target two', 'draft', now() + interval '2 days', true, false),
  ('dup-back', 'Dup back on', 'published', now() + interval '3 days', false, false);
insert into ids select slug, id from public.events where slug like 'dup-%';

-- A published menu on the source: one dish with an ingredient and a cross-contact tick.
insert into public.ingredients (name) values ('Dup test flour');
insert into public.dishes (name, category) values ('Dup test challah', 'bread');
insert into public.dish_ingredients (dish_id, ingredient_id)
  select d.id, i.id from public.dishes d, public.ingredients i
  where d.name = 'Dup test challah' and i.name = 'Dup test flour';
select tests.as_user((select id from ids where name = 'organizer'));
select public.create_menu_draft((select id from ids where name = 'dup-source'));
update public.menu_versions set kitchen_notes = 'Shared kitchen that also handles sesame.'
  where event_id = (select id from ids where name = 'dup-source');
reset role;
insert into public.menu_items (menu_version_id, dish_id, course, preparation_notes)
  select v.id, d.id, 'main', 'Brushed with egg'
  from public.menu_versions v, public.dishes d
  where v.event_id = (select id from ids where name = 'dup-source') and d.name = 'Dup test challah';
insert into public.menu_item_cross_contact (menu_item_id, allergen_code)
  select mi.id, 'tree_nuts' from public.menu_items mi
  join public.menu_versions v on v.id = mi.menu_version_id
  where v.event_id = (select id from ids where name = 'dup-source');
select tests.as_user((select id from ids where name = 'organizer'));
select public.publish_menu(
  (select id from public.menu_versions where event_id = (select id from ids where name = 'dup-source')), '', true);

-- ---------------------------------------------------------------------------
-- copy_menu_to_event
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'student'));
select throws_ok(
  format('select public.copy_menu_to_event(%L, %L)', (select id from ids where name = 'dup-source'), (select id from ids where name = 'dup-target')),
  'P0001', 'forbidden', 'students cannot copy menus');

select tests.as_user((select id from ids where name = 'organizer'));
select public.copy_menu_to_event((select id from ids where name = 'dup-source'), (select id from ids where name = 'dup-target'));
select is(
  (select status::text from public.menu_versions where event_id = (select id from ids where name = 'dup-target')),
  'draft', 'the copied menu is a draft (staff still confirm preparation to publish)');
select is(
  (select kitchen_notes from public.menu_versions where event_id = (select id from ids where name = 'dup-target')),
  'Shared kitchen that also handles sesame.', 'the kitchen note comes along');
select is(
  (select count(*)::int from public.menu_items mi join public.menu_versions v on v.id = mi.menu_version_id
   where v.event_id = (select id from ids where name = 'dup-target') and mi.preparation_notes = 'Brushed with egg'),
  1, 'dishes and their preparation notes come along');
select is(
  (select count(*)::int from public.menu_item_cross_contact c
   join public.menu_items mi on mi.id = c.menu_item_id
   join public.menu_versions v on v.id = mi.menu_version_id
   where v.event_id = (select id from ids where name = 'dup-target') and c.allergen_code = 'tree_nuts'),
  1, 'cross-contact ticks come along');

select public.copy_menu_to_event((select id from ids where name = 'dup-source'), (select id from ids where name = 'dup-target'));
select is(
  (select count(*)::int from public.menu_versions where event_id = (select id from ids where name = 'dup-target')),
  1, 'copying again does nothing when the new event already has a menu');

select public.copy_menu_to_event((select id from ids where name = 'dup-empty'), (select id from ids where name = 'dup-target-2'));
select is(
  (select count(*)::int from public.menu_versions where event_id = (select id from ids where name = 'dup-target-2')),
  0, 'nothing is created when the source event has no menu');

-- ---------------------------------------------------------------------------
-- Cancelled → Published tells people it's back on
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'student'));
select public.set_rsvp((select id from ids where name = 'dup-back'), 'going');
select tests.as_user((select id from ids where name = 'organizer'));
update public.events set status = 'cancelled' where id = (select id from ids where name = 'dup-back');
update public.events set status = 'published' where id = (select id from ids where name = 'dup-back');
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = (select id from ids where name = 'student') and event_id = (select id from ids where name = 'dup-back')
     and kind = 'event_reinstated' and is_urgent),
  1, 'people who RSVP''d get an urgent "back on" notice');
select is(
  (select status::text from public.rsvps
   where user_id = (select id from ids where name = 'student') and event_id = (select id from ids where name = 'dup-back')),
  'going', 'their RSVP is still there');

-- ---------------------------------------------------------------------------
-- Audit log: which role was granted or removed, and for whom
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'admin'));
select public.admin_grant_role('dup-student@lehigh.edu', 'kitchen_staff');
select public.admin_revoke_role((select id from ids where name = 'student'), 'kitchen_staff');
select public.admin_grant_role('dup-future@example.com', 'organizer');
reset role;
select is(
  (select details ->> 'role' from public.audit_events
   where action = 'user_roles.delete' and entity_id = (select id from ids where name = 'student')::text
   order by id desc limit 1),
  'kitchen_staff', 'a role removal records which role');
select is(
  (select details ->> 'role' from public.audit_events
   where action = 'user_roles.insert' and entity_id = (select id from ids where name = 'student')::text
   order by id desc limit 1),
  'kitchen_staff', 'a role grant records which role');
select ok(
  exists (select 1 from public.audit_events where action = 'pending_role_grants.insert' and entity_id = 'dup-future@example.com'),
  'a pending grant is identified by the email');

select * from finish();
rollback;
