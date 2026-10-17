-- Menu publishing workflow, immutability, snapshots, urgent updates, votes
-- and suggestions.
begin;
select plan(32);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('a', tests.create_user('menu-a@lehigh.edu')),
  ('b', tests.create_user('menu-b@lehigh.edu')),
  ('kitchen', tests.create_user('menu-kitchen@example.com')),
  ('admin', tests.create_user('menu-admin@example.com'));
select tests.add_role((select id from ids where name = 'kitchen'), 'kitchen_staff');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

insert into public.events (slug, title, status, starts_at, has_meal, menu_voting_open)
values ('m-dinner', 'Menu test dinner', 'published', now() + interval '2 days', true, false);
insert into ids values ('event', (select id from public.events where slug = 'm-dinner'));

insert into public.ingredients (name) values ('Test sesame oil'), ('Test cabbage'), ('Test walnuts');
insert into public.ingredient_allergens (ingredient_id, allergen_code)
  select id, 'sesame_oil' from public.ingredients where name = 'Test sesame oil';
insert into public.ingredient_allergens (ingredient_id, allergen_code)
  select id, 'tree_nuts' from public.ingredients where name = 'Test walnuts';
insert into public.dishes (name, category, status) values ('Test slaw', 'salad', 'active'), ('Test proposed dish', 'main', 'proposed');
insert into ids select 'slaw', id from public.dishes where name = 'Test slaw';
insert into ids select 'proposed', id from public.dishes where name = 'Test proposed dish';
insert into public.dish_ingredients (dish_id, ingredient_id)
  select (select id from ids where name = 'slaw'), id from public.ingredients where name in ('Test sesame oil', 'Test cabbage');

insert into public.rsvps (event_id, user_id, status) values
  ((select id from ids where name = 'event'), (select id from ids where name = 'a'), 'going'),
  ((select id from ids where name = 'event'), (select id from ids where name = 'b'), 'not_going');

-- ---------------------------------------------------------------------------
-- Drafts are private
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'kitchen'));
select is((public.create_menu_draft((select id from ids where name = 'event'))).status, 'draft'::public.menu_status,
  'kitchen staff can start a menu draft');
reset role;
insert into ids select 'v1', id from public.menu_versions where event_id = (select id from ids where name = 'event');

select tests.as_anon();
select ok(public.get_event_menu((select id from ids where name = 'event')) -> 'version' = 'null'::jsonb,
  'anonymous visitors do not see a draft menu');
select is((select count(*)::int from public.menu_versions where event_id = (select id from ids where name = 'event')), 0,
  'draft menu rows are hidden from anonymous visitors');

select tests.as_user((select id from ids where name = 'a'));
select ok(public.get_event_menu((select id from ids where name = 'event'), true) -> 'version' = 'null'::jsonb,
  'students cannot preview drafts');
select throws_ok(
  format('select public.publish_menu(%L, '''', true)', (select id from ids where name = 'v1')),
  'P0001', 'forbidden', 'students cannot publish menus');

select tests.as_user((select id from ids where name = 'kitchen'));
select is(public.get_event_menu((select id from ids where name = 'event'), true) -> 'version' ->> 'status', 'draft',
  'kitchen staff can preview the draft');

-- ---------------------------------------------------------------------------
-- Publishing rules
-- ---------------------------------------------------------------------------
select throws_ok(
  format('select public.publish_menu(%L, '''', true)', (select id from ids where name = 'v1')),
  'P0001', 'menu_empty', 'an empty menu cannot be published');

insert into public.menu_items (menu_version_id, dish_id, course)
  values ((select id from ids where name = 'v1'), (select id from ids where name = 'slaw'), 'salad');
insert into public.menu_item_cross_contact (menu_item_id, allergen_code)
  select id, 'sesame_seed' from public.menu_items where menu_version_id = (select id from ids where name = 'v1');

select throws_ok(
  format('select public.publish_menu(%L, '''', false)', (select id from ids where name = 'v1')),
  'P0001', 'prep_confirmation_required', 'publishing requires confirming preparation and cross-contact details');
select is((public.publish_menu((select id from ids where name = 'v1'), '', true)).status, 'published'::public.menu_status,
  'with confirmation, the menu is published');
select throws_ok(
  format('update public.menu_items set preparation_notes = ''changed'' where menu_version_id = %L', (select id from ids where name = 'v1')),
  'P0001', 'menu_locked', 'published menu items cannot be edited');
select throws_ok(
  format('delete from public.menu_items where menu_version_id = %L', (select id from ids where name = 'v1')),
  'P0001', 'menu_locked', 'published menu items cannot be deleted');
select throws_ok(
  format('update public.menu_versions set kitchen_notes = ''changed'' where id = %L', (select id from ids where name = 'v1')),
  'P0001', 'menu_locked', 'a published version cannot be edited');

select tests.as_anon();
select ok(
  (public.get_event_menu((select id from ids where name = 'event')) -> 'version' ->> 'version') = '1'
  and (public.get_event_menu((select id from ids where name = 'event')) -> 'version' ->> 'prep_confirmed_at') is not null,
  'everyone can see the published menu and its confirmation date');
select ok(
  public.get_event_menu((select id from ids where name = 'event')) -> 'items' -> 0 -> 'dish' -> 'allergens' @> '["sesame_oil"]'
  and public.get_event_menu((select id from ids where name = 'event')) -> 'items' -> 0 -> 'cross_contact_allergens' @> '["sesame_seed"]',
  'ingredient allergens (sesame oil) and cross-contact (sesame seeds) are shown separately');

-- Changing the dish later does not change the published snapshot
reset role;
insert into public.dish_ingredients (dish_id, ingredient_id)
  select (select id from ids where name = 'slaw'), id from public.ingredients where name = 'Test walnuts';
select tests.as_anon();
select ok(
  not (public.get_event_menu((select id from ids where name = 'event')) -> 'items' -> 0 -> 'dish' -> 'allergens' @> '["tree_nuts"]'),
  'editing a dish later does not silently change the published menu');

-- New versions need a change summary
select tests.as_user((select id from ids where name = 'kitchen'));
select is((public.create_menu_draft((select id from ids where name = 'event'))).version, 2,
  'a new draft becomes version 2');
reset role;
insert into ids select 'v2', id from public.menu_versions where event_id = (select id from ids where name = 'event') and version = 2;
select is((select count(*)::int from public.menu_items where menu_version_id = (select id from ids where name = 'v2')), 1,
  'the new draft starts as a copy of the published menu');

select tests.as_user((select id from ids where name = 'kitchen'));
select throws_ok(
  format('select public.publish_menu(%L, '''', true)', (select id from ids where name = 'v2')),
  'P0001', 'change_summary_required', 'a new version needs a change summary');
select is((public.publish_menu((select id from ids where name = 'v2'), 'Added walnut topping', true, true)).status,
  'published'::public.menu_status, 'version 2 is published with a summary');
reset role;
select is((select status from public.menu_versions where id = (select id from ids where name = 'v1')), 'archived'::public.menu_status,
  'publishing version 2 archives version 1');
select ok(
  exists (select 1 from public.notifications where user_id = (select id from ids where name = 'a') and kind = 'menu_urgent'),
  'an urgent change notifies people who are going');
select ok(
  not exists (select 1 from public.notifications where user_id = (select id from ids where name = 'b') and kind = 'menu_urgent'),
  'people who are not going are not notified');

select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  format('insert into public.menu_updates (event_id, message) values (%L, ''fake update'')', (select id from ids where name = 'event')),
  '42501', null, 'students cannot post menu updates');

-- ---------------------------------------------------------------------------
-- Votes (advisory)
-- ---------------------------------------------------------------------------
select lives_ok(
  format('insert into public.dish_votes (dish_id) values (%L)', (select id from ids where name = 'slaw')),
  'a student can favorite a dish');
select throws_ok(
  format('insert into public.dish_votes (dish_id) values (%L)', (select id from ids where name = 'slaw')),
  '23505', null, 'the same favorite cannot be counted twice');
select is(
  (select votes from public.get_dish_vote_counts() where dish_id = (select id from ids where name = 'slaw')), 1,
  'vote counts are available');
select throws_ok(
  format('insert into public.dish_votes (dish_id, event_id) values (%L, %L)',
    (select id from ids where name = 'proposed'), (select id from ids where name = 'event')),
  '42501', null, 'cannot vote on options when menu voting is closed');

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------
select lives_ok($$ insert into public.dish_suggestions (kind, title) values ('dish', 'Shakshuka') $$, 'a student can suggest a dish');
select throws_ok($$ insert into public.dish_suggestions (kind, title, status) values ('dish', 'Sneaky', 'accepted') $$,
  '42501', null, 'a student cannot set a suggestion''s status');
select tests.as_user((select id from ids where name = 'b'));
select is((select count(*)::int from public.dish_suggestions where title = 'Shakshuka'), 0, 'others cannot read your suggestions');
select tests.as_user((select id from ids where name = 'kitchen'));
select is(tests.rows_affected($$ update public.dish_suggestions set status = 'accepted' where title = 'Shakshuka' $$), 1,
  'kitchen staff can review suggestions');

-- ---------------------------------------------------------------------------
-- Deleting an event with published menus (admin) cascades cleanly
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'admin'));
select is(tests.rows_affected(format('delete from public.events where id = %L', (select id from ids where name = 'event'))), 1,
  'an admin can delete an event that has published menus');

select * from finish();
rollback;
