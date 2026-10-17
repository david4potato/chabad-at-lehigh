-- =============================================================================
-- DEMO SEED DATA — for local development and trying out the app.
--
-- Everything here is clearly marked "[DEMO]" and flagged is_demo = true.
-- It is NOT real Chabad at Lehigh information. Remove it before real use with:
--   supabase/remove_demo_data.sql
--
-- Dates are relative to "now" so the demo always shows upcoming events.
-- Dishes and ingredients are realistic examples for testing the allergen
-- display; they are not an actual Chabad at Lehigh menu.
-- =============================================================================

do $$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
  v_fri date;
  v_next_fri date;
  v_wed date;
  v_mon date;
  v_sun date;
  e_shabbat uuid;
  e_shabbat_next uuid;
  e_lunch uuid;
  e_study uuid;
  e_volunteer uuid;
  e_cooking uuid;
  e_draft uuid;
  m_v1 uuid;
  m_v2 uuid;
  m_lunch uuid;
  item uuid;
begin
  v_fri := v_today + ((5 - extract(isodow from v_today)::int + 7) % 7);
  if v_fri = v_today and (now() at time zone 'America/New_York')::time > time '17:00' then
    v_fri := v_fri + 7;
  end if;
  v_next_fri := v_fri + 7;
  v_wed := v_today + ((3 - extract(isodow from v_today)::int + 7) % 7) + case when extract(isodow from v_today) = 3 then 7 else 0 end;
  v_mon := v_today + ((1 - extract(isodow from v_today)::int + 7) % 7) + case when extract(isodow from v_today) = 1 then 7 else 0 end;
  v_sun := v_today + ((7 - extract(isodow from v_today)::int + 7) % 7) + case when extract(isodow from v_today) = 7 then 7 else 0 end;

  -- ---------------------------------------------------------------------------
  -- Events
  -- ---------------------------------------------------------------------------
  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, rsvp_deadline, approval_mode,
    max_guests_per_rsvp, has_meal, menu_voting_open, contact_name, contact_email, is_demo)
  values (
    'demo-shabbat-dinner-' || to_char(v_fri, 'YYYY-MM-DD'),
    '[DEMO] Shabbat Dinner',
    'Sample event for testing: a warm Friday-night Shabbat dinner for students and community.',
    E'[DEMO] This is sample content for testing the app.\n\nJoin us for candle lighting, kiddush, a home-cooked dinner and great conversation. Everyone is welcome — no experience needed.',
    'shabbat_dinner', 'published', 'public',
    (v_fri + time '18:30') at time zone 'America/New_York',
    (v_fri + time '21:00') at time zone 'America/New_York',
    'Chabad House', 60, true,
    (v_fri + time '12:00') at time zone 'America/New_York',
    'guests_need_approval', 2, true, false,
    '[DEMO] Organizer', 'organizer@example.com', true
  ) returning id into e_shabbat;

  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, approval_mode,
    max_guests_per_rsvp, has_meal, menu_voting_open, is_demo)
  values (
    'demo-shabbat-dinner-' || to_char(v_next_fri, 'YYYY-MM-DD'),
    '[DEMO] Shabbat Dinner',
    'Sample event for testing. Vote on the menu options for this dinner!',
    E'[DEMO] Sample content for testing.\n\nThe menu for this dinner is still being planned — vote for your favorite options below. Votes are advisory; our staff choose the final menu.',
    'shabbat_dinner', 'published', 'public',
    (v_next_fri + time '18:30') at time zone 'America/New_York',
    (v_next_fri + time '21:00') at time zone 'America/New_York',
    'Chabad House', 60, true, 'guests_need_approval', 2, true, true, true
  ) returning id into e_shabbat_next;

  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, approval_mode,
    max_guests_per_rsvp, has_meal, is_demo)
  values (
    'demo-lunch-and-learn-' || to_char(v_wed, 'YYYY-MM-DD'),
    '[DEMO] Lunch & Learn',
    'Sample event for testing: a casual lunchtime discussion.',
    '[DEMO] Sample content for testing. A relaxed lunch with a short discussion. Bring a friend!',
    'learning', 'published', 'public',
    (v_wed + time '12:00') at time zone 'America/New_York',
    (v_wed + time '13:00') at time zone 'America/New_York',
    '[DEMO] Campus meeting room', 20, true, 'auto', 1, true, true
  ) returning id into e_lunch;

  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, approval_mode,
    max_guests_per_rsvp, has_meal, is_demo)
  values (
    'demo-study-break-' || to_char(v_mon, 'YYYY-MM-DD'),
    '[DEMO] Study Break: Snacks & Board Games',
    'Sample event for testing: drop in, take a break, play a game.',
    '[DEMO] Sample content for testing. No RSVP limit — drop in any time.',
    'social', 'published', 'members',
    (v_mon + time '20:00') at time zone 'America/New_York',
    (v_mon + time '22:00') at time zone 'America/New_York',
    'Chabad House', null, true, 'auto', 3, false, true
  ) returning id into e_study;

  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, approval_mode,
    max_guests_per_rsvp, has_meal, is_demo)
  values (
    'demo-volunteer-morning-' || to_char(v_sun, 'YYYY-MM-DD'),
    '[DEMO] Community Volunteer Morning',
    'Sample event for testing: help pack care packages.',
    '[DEMO] Sample content for testing. Light breakfast provided.',
    'volunteer', 'published', 'public',
    (v_sun + time '10:00') at time zone 'America/New_York',
    (v_sun + time '12:00') at time zone 'America/New_York',
    'Chabad House', 15, true, 'all_need_approval', 0, false, true
  ) returning id into e_volunteer;

  insert into public.events (slug, title, summary, description, category, status, visibility,
    starts_at, ends_at, location_name, capacity, rsvp_enabled, approval_mode,
    max_guests_per_rsvp, has_meal, is_demo)
  values (
    'demo-small-group-cooking-' || to_char(v_wed + 1, 'YYYY-MM-DD'),
    '[DEMO] Small-Group Cooking Night',
    'Sample event for testing the waitlist: only 3 spots.',
    '[DEMO] Sample content for testing. Very small group, so it fills fast — join the waitlist if it''s full.',
    'social', 'published', 'public',
    (v_wed + 1 + time '19:00') at time zone 'America/New_York',
    (v_wed + 1 + time '21:00') at time zone 'America/New_York',
    'Chabad House kitchen', 3, true, 'auto', 0, false, true
  ) returning id into e_cooking;

  insert into public.events (slug, title, summary, category, status, visibility,
    starts_at, location_name, capacity, has_meal, is_demo)
  values (
    'demo-draft-event',
    '[DEMO] Draft event (only staff can see this)',
    'Sample draft for testing the dashboard.',
    'holiday', 'draft', 'public',
    (v_next_fri + 2 + time '17:00') at time zone 'America/New_York',
    '[DEMO] TBD', 100, true, true
  ) returning id into e_draft;

  -- Demo events held at Chabad House use the real address so map links work.
  update public.events set location_address = '306 Wyandotte Street, Bethlehem, PA 18015'
  where is_demo and location_name like 'Chabad House%';

  -- ---------------------------------------------------------------------------
  -- Ingredients
  -- ---------------------------------------------------------------------------
  insert into public.ingredients (name, notes) values
    ('All-purpose flour', null),
    ('Eggs', null),
    ('Sesame seeds', null),
    ('Sugar', null),
    ('Canola oil', null),
    ('Yeast', null),
    ('Salt', null),
    ('Honey', null),
    ('Chicken', null),
    ('Carrots', null),
    ('Celery', null),
    ('Onion', null),
    ('Garlic', null),
    ('Fresh dill', null),
    ('Fresh parsley', null),
    ('Matzo meal', null),
    ('Tahini', 'Ground sesame seed paste.'),
    ('Chickpeas', null),
    ('Lemon juice', null),
    ('Olive oil', null),
    ('Toasted sesame oil', 'Oil only — no whole seeds. Listed separately from sesame seeds.'),
    ('Soy sauce', 'Contains wheat.'),
    ('Rice vinegar', null),
    ('Green cabbage', null),
    ('Potatoes', null),
    ('Cucumbers', null),
    ('Tomatoes', null),
    ('Panko breadcrumbs', null),
    ('Dijon mustard', null),
    ('Pareve chocolate chips', '[DEMO] Example label note: check the package for facility warnings.'),
    ('Pareve margarine', null),
    ('Walnuts', null),
    ('White rice', null),
    ('Zucchini', null),
    ('Bell peppers', null),
    ('Apples', null),
    ('Cinnamon', null),
    ('Rolled oats', 'Not certified gluten-free.'),
    ('Egg noodles', null),
    ('Paprika', null),
    ('Grape juice', 'May contain sulfites.');

  insert into public.ingredient_allergens (ingredient_id, allergen_code)
  select i.id, a.code
  from (values
    ('All-purpose flour', 'wheat'), ('All-purpose flour', 'gluten'),
    ('Eggs', 'egg'),
    ('Sesame seeds', 'sesame_seed'),
    ('Matzo meal', 'wheat'), ('Matzo meal', 'gluten'),
    ('Tahini', 'sesame_seed'),
    ('Toasted sesame oil', 'sesame_oil'),
    ('Soy sauce', 'soy'), ('Soy sauce', 'wheat'), ('Soy sauce', 'gluten'),
    ('Panko breadcrumbs', 'wheat'), ('Panko breadcrumbs', 'gluten'),
    ('Dijon mustard', 'mustard'),
    ('Pareve chocolate chips', 'soy'),
    ('Pareve margarine', 'soy'),
    ('Walnuts', 'tree_nuts'),
    ('Rolled oats', 'gluten'),
    ('Egg noodles', 'wheat'), ('Egg noodles', 'gluten'), ('Egg noodles', 'egg'),
    ('Grape juice', 'sulfites')
  ) as x(ingredient, code)
  join public.ingredients i on i.name = x.ingredient
  join public.allergens a on a.code = x.code;

  -- ---------------------------------------------------------------------------
  -- Dishes
  -- ---------------------------------------------------------------------------
  insert into public.dishes (name, description, category, kosher_type, diet_tags, status, is_demo) values
    ('Challah', 'Braided egg bread topped with sesame seeds.', 'bread', 'pareve', '{vegetarian}', 'active', true),
    ('Chicken soup with matzo balls', 'Classic chicken soup with carrots, celery and dill.', 'soup', 'meat', '{}', 'active', true),
    ('Herb roasted chicken', 'Roasted chicken with garlic, parsley and paprika.', 'main', 'meat', '{}', 'active', true),
    ('Hummus with tahini', 'Creamy chickpea dip made with tahini (sesame seed paste).', 'appetizer', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Asian cabbage slaw', 'Crunchy slaw with a toasted sesame OIL and soy dressing (no sesame seeds).', 'salad', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Israeli salad', 'Diced cucumber, tomato, onion and parsley with lemon and olive oil.', 'salad', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Potato kugel', 'Baked potato pudding.', 'side', 'pareve', '{vegetarian}', 'active', true),
    ('Chicken schnitzel', 'Breaded, pan-fried chicken cutlets.', 'main', 'meat', '{}', 'active', true),
    ('Roasted vegetables', 'Zucchini, bell peppers and onion roasted in olive oil.', 'side', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Rice pilaf', 'Fluffy rice with sautéed onion.', 'side', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Chocolate babka', 'Pareve chocolate swirl cake with optional walnut topping.', 'dessert', 'pareve', '{vegetarian}', 'active', true),
    ('Grape juice for kiddush', 'Served for kiddush.', 'drink', 'pareve', '{vegetarian,vegan}', 'active', true),
    ('Apple crisp', 'Proposed dessert: baked apples with an oat crumble.', 'dessert', 'pareve', '{vegetarian}', 'proposed', true),
    ('Vegetable lo mein', 'Proposed main: egg noodles with vegetables, soy sauce and sesame oil.', 'main', 'pareve', '{vegetarian}', 'proposed', true);

  insert into public.dish_ingredients (dish_id, ingredient_id, is_optional, sort_order)
  select d.id, i.id, x.optional, x.ord
  from (values
    ('Challah', 'All-purpose flour', false, 1), ('Challah', 'Eggs', false, 2), ('Challah', 'Sugar', false, 3),
    ('Challah', 'Canola oil', false, 4), ('Challah', 'Yeast', false, 5), ('Challah', 'Salt', false, 6),
    ('Challah', 'Honey', false, 7), ('Challah', 'Sesame seeds', false, 8),
    ('Chicken soup with matzo balls', 'Chicken', false, 1), ('Chicken soup with matzo balls', 'Carrots', false, 2),
    ('Chicken soup with matzo balls', 'Celery', false, 3), ('Chicken soup with matzo balls', 'Onion', false, 4),
    ('Chicken soup with matzo balls', 'Fresh dill', false, 5), ('Chicken soup with matzo balls', 'Matzo meal', false, 6),
    ('Chicken soup with matzo balls', 'Eggs', false, 7), ('Chicken soup with matzo balls', 'Canola oil', false, 8),
    ('Chicken soup with matzo balls', 'Salt', false, 9),
    ('Herb roasted chicken', 'Chicken', false, 1), ('Herb roasted chicken', 'Garlic', false, 2),
    ('Herb roasted chicken', 'Fresh parsley', false, 3), ('Herb roasted chicken', 'Paprika', false, 4),
    ('Herb roasted chicken', 'Olive oil', false, 5), ('Herb roasted chicken', 'Salt', false, 6),
    ('Hummus with tahini', 'Chickpeas', false, 1), ('Hummus with tahini', 'Tahini', false, 2),
    ('Hummus with tahini', 'Lemon juice', false, 3), ('Hummus with tahini', 'Garlic', false, 4),
    ('Hummus with tahini', 'Olive oil', false, 5), ('Hummus with tahini', 'Salt', false, 6),
    ('Asian cabbage slaw', 'Green cabbage', false, 1), ('Asian cabbage slaw', 'Carrots', false, 2),
    ('Asian cabbage slaw', 'Toasted sesame oil', false, 3), ('Asian cabbage slaw', 'Soy sauce', false, 4),
    ('Asian cabbage slaw', 'Rice vinegar', false, 5), ('Asian cabbage slaw', 'Sugar', false, 6),
    ('Israeli salad', 'Cucumbers', false, 1), ('Israeli salad', 'Tomatoes', false, 2), ('Israeli salad', 'Onion', false, 3),
    ('Israeli salad', 'Fresh parsley', false, 4), ('Israeli salad', 'Lemon juice', false, 5),
    ('Israeli salad', 'Olive oil', false, 6), ('Israeli salad', 'Salt', false, 7),
    ('Potato kugel', 'Potatoes', false, 1), ('Potato kugel', 'Eggs', false, 2), ('Potato kugel', 'Onion', false, 3),
    ('Potato kugel', 'Canola oil', false, 4), ('Potato kugel', 'Salt', false, 5),
    ('Chicken schnitzel', 'Chicken', false, 1), ('Chicken schnitzel', 'Panko breadcrumbs', false, 2),
    ('Chicken schnitzel', 'Eggs', false, 3), ('Chicken schnitzel', 'All-purpose flour', false, 4),
    ('Chicken schnitzel', 'Canola oil', false, 5), ('Chicken schnitzel', 'Dijon mustard', true, 6),
    ('Roasted vegetables', 'Zucchini', false, 1), ('Roasted vegetables', 'Bell peppers', false, 2),
    ('Roasted vegetables', 'Onion', false, 3), ('Roasted vegetables', 'Olive oil', false, 4), ('Roasted vegetables', 'Salt', false, 5),
    ('Rice pilaf', 'White rice', false, 1), ('Rice pilaf', 'Onion', false, 2), ('Rice pilaf', 'Canola oil', false, 3), ('Rice pilaf', 'Salt', false, 4),
    ('Chocolate babka', 'All-purpose flour', false, 1), ('Chocolate babka', 'Eggs', false, 2), ('Chocolate babka', 'Sugar', false, 3),
    ('Chocolate babka', 'Pareve margarine', false, 4), ('Chocolate babka', 'Pareve chocolate chips', false, 5),
    ('Chocolate babka', 'Yeast', false, 6), ('Chocolate babka', 'Walnuts', true, 7),
    ('Grape juice for kiddush', 'Grape juice', false, 1),
    ('Apple crisp', 'Apples', false, 1), ('Apple crisp', 'All-purpose flour', false, 2), ('Apple crisp', 'Rolled oats', false, 3),
    ('Apple crisp', 'Sugar', false, 4), ('Apple crisp', 'Pareve margarine', false, 5), ('Apple crisp', 'Cinnamon', false, 6),
    ('Vegetable lo mein', 'Egg noodles', false, 1), ('Vegetable lo mein', 'Carrots', false, 2), ('Vegetable lo mein', 'Green cabbage', false, 3),
    ('Vegetable lo mein', 'Bell peppers', false, 4), ('Vegetable lo mein', 'Soy sauce', false, 5), ('Vegetable lo mein', 'Toasted sesame oil', false, 6)
  ) as x(dish, ingredient, optional, ord)
  join public.dishes d on d.name = x.dish
  join public.ingredients i on i.name = x.ingredient;

  -- ---------------------------------------------------------------------------
  -- Menus. Seeds bypass publish_menu() (no signed-in staff user exists yet),
  -- so we set the same guard flag publish_menu() uses.
  -- ---------------------------------------------------------------------------
  perform set_config('app.publishing_menu', 'on', true);

  -- This Friday: version 1 (archived) and version 2 (published).
  insert into public.menu_versions (event_id, version, status, title, change_summary, kitchen_notes,
    prep_confirmed_at, published_at)
  values (e_shabbat, 1, 'archived', '[DEMO] Shabbat Dinner Menu', 'First published menu.',
    '[DEMO] Example kitchen note: all food is prepared in one shared kosher kitchen that also handles sesame, tree nuts, eggs, wheat and soy.',
    now() - interval '2 days', now() - interval '2 days')
  returning id into m_v1;

  insert into public.menu_versions (event_id, version, status, title, change_summary, kitchen_notes,
    prep_confirmed_at, published_at)
  values (e_shabbat, 2, 'published', '[DEMO] Shabbat Dinner Menu',
    '[DEMO] Replaced roasted vegetables with rice pilaf.',
    '[DEMO] Example kitchen note: all food is prepared in one shared kosher kitchen that also handles sesame, tree nuts, eggs, wheat and soy. Ask an organizer before relying on this menu for a severe allergy.',
    now() - interval '1 day', now() - interval '1 day')
  returning id into m_v2;

  insert into public.menu_items (menu_version_id, dish_id, course, sort_order, preparation_notes, cross_contact_notes, dish_snapshot)
  select m_v1, d.id, d.category, x.ord, null, null, private.dish_snapshot(d.id)
  from (values ('Grape juice for kiddush', 1), ('Challah', 2), ('Hummus with tahini', 3), ('Asian cabbage slaw', 4),
               ('Chicken soup with matzo balls', 5), ('Herb roasted chicken', 6), ('Roasted vegetables', 7), ('Chocolate babka', 8)) as x(dish, ord)
  join public.dishes d on d.name = x.dish;

  insert into public.menu_items (menu_version_id, dish_id, course, sort_order, preparation_notes, cross_contact_notes, dish_snapshot)
  select m_v2, d.id, d.category, x.ord, x.prep, x.cc, private.dish_snapshot(d.id)
  from (values
    ('Grape juice for kiddush', 1, null, null),
    ('Challah', 2, '[DEMO] Topped with sesame seeds before baking.', '[DEMO] Baked on shared trays; seeds can fall onto other baked goods.'),
    ('Hummus with tahini', 3, null, '[DEMO] Served next to the challah; shared serving area.'),
    ('Asian cabbage slaw', 4, '[DEMO] Dressing uses toasted sesame oil, not seeds.', '[DEMO] Prepared on the same counter as the seeded challah.'),
    ('Chicken soup with matzo balls', 5, null, null),
    ('Herb roasted chicken', 6, null, null),
    ('Rice pilaf', 7, null, null),
    ('Chocolate babka', 8, '[DEMO] Walnut topping is on half of the babkas only.', '[DEMO] Cut with the same knife as the walnut-topped babka.')
  ) as x(dish, ord, prep, cc)
  join public.dishes d on d.name = x.dish;

  insert into public.menu_item_cross_contact (menu_item_id, allergen_code)
  select mi.id, x.code
  from (values
    ('Challah', 'tree_nuts'),
    ('Hummus with tahini', 'wheat'),
    ('Asian cabbage slaw', 'sesame_seed'),
    ('Chocolate babka', 'tree_nuts')
  ) as x(dish, code)
  join public.dishes d on d.name = x.dish
  join public.menu_items mi on mi.dish_id = d.id and mi.menu_version_id = m_v2;

  insert into public.menu_updates (event_id, menu_version_id, message, is_urgent, created_at) values
    (e_shabbat, m_v2, '[DEMO] Menu updated to version 2: Replaced roasted vegetables with rice pilaf.', false, now() - interval '1 day'),
    (e_shabbat, m_v2, '[DEMO] Example urgent update: the slaw dressing uses toasted sesame oil, and the challah is topped with sesame seeds.', true, now() - interval '20 hours');

  -- Lunch & Learn: a draft menu (visible to staff only).
  insert into public.menu_versions (event_id, version, status, title, kitchen_notes)
  values (e_lunch, 1, 'draft', '[DEMO] Lunch Menu', '[DEMO] Draft — not yet confirmed by the kitchen.')
  returning id into m_lunch;

  insert into public.menu_items (menu_version_id, dish_id, course, sort_order)
  select m_lunch, d.id, d.category, x.ord
  from (values ('Hummus with tahini', 1), ('Israeli salad', 2), ('Rice pilaf', 3)) as x(dish, ord)
  join public.dishes d on d.name = x.dish;

  perform set_config('app.publishing_menu', 'off', true);

  -- Next Friday: proposed options to vote on (advisory).
  insert into public.event_menu_options (event_id, dish_id, note)
  select e_shabbat_next, d.id, x.note
  from (values
    ('Apple crisp', '[DEMO] Dessert idea'),
    ('Vegetable lo mein', '[DEMO] Vegetarian main idea'),
    ('Chocolate babka', null),
    ('Potato kugel', null)
  ) as x(dish, note)
  join public.dishes d on d.name = x.dish;

  -- ---------------------------------------------------------------------------
  -- Announcements
  -- ---------------------------------------------------------------------------
  insert into public.announcements (title, body, audience, is_pinned, is_demo) values
    ('[DEMO] Welcome to the new Chabad at Lehigh app',
     '[DEMO] This is sample content for testing. Organizers can edit or delete announcements from the dashboard.',
     'public', true, true),
    ('[DEMO] Sample announcement',
     '[DEMO] Sample text for testing the announcements list. Replace with real announcements before launch.',
     'public', false, true);
end;
$$;
