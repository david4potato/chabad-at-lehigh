-- =============================================================================
-- Housekeeping: keep storage small and the audit log meaningful.
-- =============================================================================

-- Menu publishing is already audited at the menu level (menu_versions +
-- 'menu.published'); per-item rows only added noise.
drop trigger if exists menu_items_audit on public.menu_items;

-- Rate limiting: also clean up stale windows for all keys occasionally.
create or replace function private.enforce_rate_limit(
  p_key text,
  p_max integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01');
  v_hits integer;
begin
  insert into private.rate_limits as rl (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- About 1 call in 100 sweeps windows older than a day (the table stays tiny).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  if v_hits > p_max then
    raise exception 'rate_limited' using hint = 'Too many requests. Please wait a few minutes and try again.';
  end if;
end;
$$;

-- Notifications: when someone reads their notifications, drop their own read
-- notifications older than 90 days.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;

  delete from public.notifications
  where user_id = auth.uid() and read_at is not null and read_at < now() - interval '90 days';

  return v_count;
end;
$$;

-- Remove everything the DEMO seed created (is_demo rows, demo ingredients no
-- dish uses any more). Used by the dashboard button and
-- supabase/scripts/remove_demo_data.sql. Real content is never touched.
create or replace function private.remove_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
end;
$$;

create or replace function public.admin_remove_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  perform private.remove_demo_data();
  perform private.log_audit('demo.removed', 'app_settings', null, '{}');
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
revoke execute on function public.admin_remove_demo_data() from public, anon;
grant execute on function public.admin_remove_demo_data() to authenticated;
