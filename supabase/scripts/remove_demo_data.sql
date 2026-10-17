-- =============================================================================
-- Remove all DEMO content (events, menus, dishes, ingredients, announcements
-- marked as demo). Run this before real use if you loaded supabase/seed.sql.
--
-- HOW: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Real (non-demo) content is not touched.
-- =============================================================================

begin;

-- Events cascade to their RSVPs, menus, menu items, updates and options.
delete from public.events where is_demo;

-- Demo dishes (only if no real menu still uses them).
delete from public.dishes d
where d.is_demo
  and not exists (select 1 from public.menu_items mi where mi.dish_id = d.id);

-- Demo ingredients that are no longer used by any dish.
delete from public.ingredients i
where i.created_by is null
  and not exists (select 1 from public.dish_ingredients di where di.ingredient_id = i.id)
  and i.name in (
    'All-purpose flour', 'Eggs', 'Sesame seeds', 'Sugar', 'Canola oil', 'Yeast', 'Salt', 'Honey',
    'Chicken', 'Carrots', 'Celery', 'Onion', 'Garlic', 'Fresh dill', 'Fresh parsley', 'Matzo meal',
    'Tahini', 'Chickpeas', 'Lemon juice', 'Olive oil', 'Toasted sesame oil', 'Soy sauce', 'Rice vinegar',
    'Green cabbage', 'Potatoes', 'Cucumbers', 'Tomatoes', 'Panko breadcrumbs', 'Dijon mustard',
    'Pareve chocolate chips', 'Pareve margarine', 'Walnuts', 'White rice', 'Zucchini', 'Bell peppers',
    'Apples', 'Cinnamon', 'Rolled oats', 'Egg noodles', 'Paprika', 'Grape juice'
  );

delete from public.announcements where is_demo;
delete from public.volunteer_shifts where is_demo;
delete from public.learning_programs where is_demo;

commit;
