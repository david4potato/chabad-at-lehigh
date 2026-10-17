-- Self-service account deletion.
begin;
select plan(9);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values
  ('leaver', tests.create_user('del-leaver@lehigh.edu')),
  ('waiter', tests.create_user('del-waiter@example.com')),
  ('kitchen', tests.create_user('del-kitchen@example.com')),
  ('admin', tests.create_user('del-admin@example.com'));
select tests.add_role((select id from ids where name = 'kitchen'), 'kitchen_staff');
select tests.add_role((select id from ids where name = 'admin'), 'admin');
delete from public.user_roles where role = 'admin' and user_id <> (select id from ids where name = 'admin');

insert into public.events (slug, title, status, starts_at, capacity, has_meal)
values ('del-dinner', 'Deletion test dinner', 'published', now() + interval '2 days', 1, true);
insert into ids values ('event', (select id from public.events where slug = 'del-dinner'));
insert into public.dietary_profiles (user_id, notes_for_kitchen) values ((select id from ids where name = 'leaver'), 'private');

-- leaver takes the only seat; waiter is waitlisted
select tests.as_user((select id from ids where name = 'leaver'));
select public.set_rsvp((select id from ids where name = 'event'), 'going');
select tests.as_user((select id from ids where name = 'waiter'));
select is((public.set_rsvp((select id from ids where name = 'event'), 'going')).status, 'waitlist'::public.rsvp_status,
  'the second person is waitlisted');

-- kitchen staff publish a menu (their name is attached to it)
select tests.as_user((select id from ids where name = 'kitchen'));
select public.create_menu_draft((select id from ids where name = 'event'));
reset role;
insert into public.dishes (name, category) values ('Deletion test dish', 'main');
insert into public.menu_items (menu_version_id, dish_id)
  select v.id, d.id from public.menu_versions v, public.dishes d
  where v.event_id = (select id from ids where name = 'event') and d.name = 'Deletion test dish';
select tests.as_user((select id from ids where name = 'kitchen'));
select public.publish_menu((select id from public.menu_versions where event_id = (select id from ids where name = 'event')), '', true);

-- anonymous visitors cannot call it
select tests.as_anon();
select throws_ok('select public.delete_my_account()', '42501', null, 'anonymous visitors cannot delete accounts');

-- the last admin cannot delete their account
select tests.as_user((select id from ids where name = 'admin'));
select throws_ok('select public.delete_my_account()', 'P0001', 'last_admin', 'the last admin cannot delete their account');

-- a student deletes their account
select tests.as_user((select id from ids where name = 'leaver'));
select lives_ok('select public.delete_my_account()', 'a person can delete their own account');
reset role;
select is((select count(*)::int from public.profiles where id = (select id from ids where name = 'leaver')), 0, 'their profile is gone');
select is((select count(*)::int from public.dietary_profiles where user_id = (select id from ids where name = 'leaver')), 0,
  'their dietary data is gone');
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 'event') and user_id = (select id from ids where name = 'waiter')),
  'going'::public.rsvp_status, 'their seat goes to the next person on the waitlist');

-- staff who published a menu can delete their account; the menu stays published
select tests.as_user((select id from ids where name = 'kitchen'));
select lives_ok('select public.delete_my_account()', 'staff who published a menu can delete their account');
reset role;
select ok(
  (select status = 'published' and published_by is null from public.menu_versions where event_id = (select id from ids where name = 'event')),
  'the published menu remains, with the staff member''s name cleared');

select * from finish();
rollback;
