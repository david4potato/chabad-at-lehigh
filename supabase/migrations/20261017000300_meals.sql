-- =============================================================================
-- Meals: allergens, ingredients, dishes, versioned menus, urgent updates,
-- dish votes, suggestions, and PRIVATE dietary preferences.
--
-- Safety principles enforced here:
--   * Ingredient allergens ("contains") and cross-contact allergens ("may
--     contain / shared equipment") are stored separately.
--   * A menu can only be published after a staff member confirms preparation
--     and cross-contact information. Published menus are immutable snapshots;
--     changes require a new version with a change summary.
--   * Votes are advisory only and never change a menu.
--   * Dietary data is readable only by its owner. Kitchen staff and admins can
--     see it solely through event_dietary_report(), which is audited.
-- =============================================================================

create type public.menu_status as enum ('draft', 'published', 'archived');
create type public.allergen_severity as enum ('intolerance', 'allergy', 'severe');
create type public.suggestion_status as enum ('new', 'under_review', 'accepted', 'declined');

-- -----------------------------------------------------------------------------
-- Allergens (reference data)
-- -----------------------------------------------------------------------------
create table public.allergens (
  code text primary key check (code ~ '^[a-z_]+$'),
  label text not null,
  description text,
  sort_order integer not null default 100
);

insert into public.allergens (code, label, description, sort_order) values
  ('milk', 'Milk / dairy', 'Milk and milk products (butter, cheese, cream, whey, casein).', 10),
  ('egg', 'Egg', 'Eggs and egg products (including egg wash and mayonnaise).', 20),
  ('fish', 'Fish', 'Finned fish and fish products (e.g. salmon, tuna, anchovy in sauces).', 30),
  ('shellfish', 'Crustacean shellfish', 'Shrimp, crab, lobster and similar.', 40),
  ('tree_nuts', 'Tree nuts', 'Almonds, walnuts, cashews, pecans, pistachios, hazelnuts and others.', 50),
  ('peanuts', 'Peanuts', 'Peanuts, peanut butter and peanut oil.', 60),
  ('wheat', 'Wheat', 'Wheat flour and wheat products (challah, pasta, breadcrumbs, matzo).', 70),
  ('gluten', 'Gluten', 'Gluten from wheat, barley, rye, spelt, and oats that are not certified gluten-free.', 75),
  ('soy', 'Soy', 'Soybeans and soy products (soy sauce, tofu, soy lecithin, edamame).', 80),
  ('sesame_seed', 'Sesame seeds', 'Sesame seeds and seed products: tahini, hummus, halva, za''atar, seeded toppings.', 90),
  ('sesame_oil', 'Sesame oil', 'Sesame oil (toasted or refined) used in cooking, dressings and marinades. Listed separately from sesame seeds.', 91),
  ('mustard', 'Mustard', 'Mustard seed, powder and prepared mustard.', 100),
  ('sulfites', 'Sulfites', 'Sulfites (often in wine, grape juice, dried fruit and some pickles).', 110);

-- -----------------------------------------------------------------------------
-- Ingredients and dishes (shared library)
-- -----------------------------------------------------------------------------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  notes text check (char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ingredients_name_key on public.ingredients (lower(name));
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function private.set_updated_at();

create table public.ingredient_allergens (
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  allergen_code text not null references public.allergens (code),
  primary key (ingredient_id, allergen_code)
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  category text not null default 'main'
    check (category in ('appetizer', 'soup', 'salad', 'bread', 'main', 'side', 'dessert', 'drink', 'other')),
  kosher_type text check (kosher_type in ('meat', 'dairy', 'pareve')),
  diet_tags text[] not null default '{}' check (diet_tags <@ array['vegetarian', 'vegan']::text[]),
  status text not null default 'active' check (status in ('active', 'proposed', 'archived')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index dishes_name_key on public.dishes (lower(name));
create trigger dishes_set_updated_at
  before update on public.dishes
  for each row execute function private.set_updated_at();

create table public.dish_ingredients (
  dish_id uuid not null references public.dishes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity_note text check (char_length(quantity_note) <= 120),
  is_optional boolean not null default false,
  sort_order integer not null default 0,
  primary key (dish_id, ingredient_id)
);
create index dish_ingredients_ingredient_idx on public.dish_ingredients (ingredient_id);

-- Allergens a dish contains, derived from its ingredients.
create view public.dish_allergens
with (security_invoker = true)
as
  select di.dish_id, ia.allergen_code, bool_and(di.is_optional) as only_in_optional
  from public.dish_ingredients di
  join public.ingredient_allergens ia on ia.ingredient_id = di.ingredient_id
  group by di.dish_id, ia.allergen_code;

-- Full, self-contained description of a dish (used for live previews and
-- frozen into published menus).
create or replace function private.dish_snapshot(p_dish_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'description', d.description,
    'category', d.category,
    'kosher_type', d.kosher_type,
    'diet_tags', to_jsonb(d.diet_tags),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'notes', i.notes,
        'quantity_note', di.quantity_note,
        'optional', di.is_optional,
        'allergens', coalesce((
          select jsonb_agg(ia.allergen_code order by ia.allergen_code)
          from public.ingredient_allergens ia where ia.ingredient_id = i.id
        ), '[]'::jsonb)
      ) order by di.sort_order, i.name)
      from public.dish_ingredients di
      join public.ingredients i on i.id = di.ingredient_id
      where di.dish_id = d.id
    ), '[]'::jsonb),
    'allergens', coalesce((
      select jsonb_agg(distinct ia.allergen_code)
      from public.dish_ingredients di
      join public.ingredient_allergens ia on ia.ingredient_id = di.ingredient_id
      where di.dish_id = d.id
    ), '[]'::jsonb)
  )
  from public.dishes d
  where d.id = p_dish_id;
$$;

-- -----------------------------------------------------------------------------
-- Menus (versioned per event)
-- -----------------------------------------------------------------------------
create table public.menu_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  version integer not null check (version >= 1),
  status public.menu_status not null default 'draft',
  title text check (char_length(title) <= 140),
  change_summary text check (char_length(change_summary) <= 1000),
  kitchen_notes text check (char_length(kitchen_notes) <= 2000),
  prep_confirmed_at timestamptz,
  prep_confirmed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, version)
);
create unique index menu_versions_one_published on public.menu_versions (event_id) where status = 'published';
create unique index menu_versions_one_draft on public.menu_versions (event_id) where status = 'draft';

create trigger menu_versions_set_updated_at
  before update on public.menu_versions
  for each row execute function private.set_updated_at();
create trigger menu_versions_audit
  after insert or update or delete on public.menu_versions
  for each row execute function private.audit_row_change();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_version_id uuid not null references public.menu_versions (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete restrict,
  course text not null default 'main'
    check (course in ('appetizer', 'soup', 'salad', 'bread', 'main', 'side', 'dessert', 'drink', 'other')),
  sort_order integer not null default 0,
  preparation_notes text check (char_length(preparation_notes) <= 500),
  cross_contact_notes text check (char_length(cross_contact_notes) <= 500),
  -- Frozen copy of the dish (name, ingredients, allergens) taken at publish time.
  dish_snapshot jsonb,
  unique (menu_version_id, dish_id)
);
create index menu_items_dish_idx on public.menu_items (dish_id);

create trigger menu_items_audit
  after insert or update or delete on public.menu_items
  for each row execute function private.audit_row_change();

-- Allergens the dish may come into contact with (shared equipment, fryer, etc.)
create table public.menu_item_cross_contact (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  allergen_code text not null references public.allergens (code),
  primary key (menu_item_id, allergen_code)
);

-- Published/archived menus are immutable (except archiving).
create or replace function private.guard_menu_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not exists (select 1 from public.events where id = old.event_id) then
      return old; -- cascading event delete
    end if;
    if old.status <> 'draft' then
      raise exception 'menu_locked' using hint = 'Published menus cannot be deleted. Publish a new version instead.';
    end if;
    return old;
  end if;
  if old.status = 'archived' then
    raise exception 'menu_locked';
  end if;
  if old.status = 'published' then
    if new.status = 'archived'
       and new.version = old.version and new.event_id = old.event_id
       and new.title is not distinct from old.title
       and new.change_summary is not distinct from old.change_summary
       and new.kitchen_notes is not distinct from old.kitchen_notes
       and new.prep_confirmed_at is not distinct from old.prep_confirmed_at
       and new.published_at is not distinct from old.published_at then
      return new;
    end if;
    raise exception 'menu_locked' using hint = 'Published menus cannot be edited. Create a new version instead.';
  end if;
  -- Drafts may not be marked published directly; use publish_menu().
  if new.status <> 'draft' and current_setting('app.publishing_menu', true) is distinct from 'on' then
    raise exception 'use_publish_menu';
  end if;
  return new;
end;
$$;

create trigger menu_versions_guard
  before update or delete on public.menu_versions
  for each row execute function private.guard_menu_version();

create or replace function private.guard_menu_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status public.menu_status;
begin
  if tg_table_name = 'menu_items' then
    v_version_id := case when tg_op = 'DELETE' then old.menu_version_id else new.menu_version_id end;
  else
    select mi.menu_version_id into v_version_id from public.menu_items mi
    where mi.id = case when tg_op = 'DELETE' then old.menu_item_id else new.menu_item_id end;
  end if;

  select status into v_status from public.menu_versions where id = v_version_id;
  if v_status is null then
    -- Parent is being deleted (cascade).
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status <> 'draft' and current_setting('app.publishing_menu', true) is distinct from 'on' then
    raise exception 'menu_locked' using hint = 'Published menus cannot be edited. Create a new version instead.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger menu_items_guard
  before insert or update or delete on public.menu_items
  for each row execute function private.guard_menu_item();
create trigger menu_item_cross_contact_guard
  before insert or update or delete on public.menu_item_cross_contact
  for each row execute function private.guard_menu_item();

-- -----------------------------------------------------------------------------
-- Menu updates (visible change log + urgent notices)
-- -----------------------------------------------------------------------------
create table public.menu_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  menu_version_id uuid references public.menu_versions (id) on delete set null,
  message text not null check (char_length(message) between 3 and 1000),
  is_urgent boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index menu_updates_event_idx on public.menu_updates (event_id, created_at desc);

create or replace function private.after_menu_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = new.event_id;
  perform private.log_audit(
    case when new.is_urgent then 'menu_update.urgent' else 'menu_update.posted' end,
    'menu_updates', new.id::text, jsonb_build_object('event_id', new.event_id));

  if new.is_urgent then
    insert into public.notifications (user_id, event_id, kind, title, body, link, is_urgent)
    select r.user_id, new.event_id, 'menu_urgent',
      left('Urgent menu update: ' || v_event.title, 200),
      left(new.message, 2000),
      '/events/' || v_event.slug || '#menu',
      true
    from public.rsvps r
    where r.event_id = new.event_id and r.status in ('going', 'waitlist', 'pending');
  end if;
  return new;
end;
$$;

create trigger menu_updates_after_insert
  after insert on public.menu_updates
  for each row execute function private.after_menu_update();

-- -----------------------------------------------------------------------------
-- Menu workflow functions
-- -----------------------------------------------------------------------------
create or replace function public.create_menu_draft(p_event_id uuid, p_copy_published boolean default true)
returns public.menu_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.menu_versions;
  v_published public.menu_versions;
  v_next integer;
  r public.menu_items;
  v_new_item uuid;
begin
  if not public.can_manage_menus() then
    raise exception 'forbidden';
  end if;
  perform 1 from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found';
  end if;

  select * into v_draft from public.menu_versions where event_id = p_event_id and status = 'draft';
  if found then
    return v_draft;
  end if;

  select coalesce(max(version), 0) + 1 into v_next from public.menu_versions where event_id = p_event_id;
  select * into v_published from public.menu_versions where event_id = p_event_id and status = 'published';

  insert into public.menu_versions (event_id, version, status, title, kitchen_notes, created_by)
  values (p_event_id, v_next, 'draft', v_published.title, v_published.kitchen_notes, auth.uid())
  returning * into v_draft;

  if p_copy_published and v_published.id is not null then
    for r in select * from public.menu_items where menu_version_id = v_published.id loop
      insert into public.menu_items (menu_version_id, dish_id, course, sort_order, preparation_notes, cross_contact_notes)
      values (v_draft.id, r.dish_id, r.course, r.sort_order, r.preparation_notes, r.cross_contact_notes)
      returning id into v_new_item;
      insert into public.menu_item_cross_contact (menu_item_id, allergen_code)
      select v_new_item, allergen_code from public.menu_item_cross_contact where menu_item_id = r.id;
    end loop;
  end if;

  return v_draft;
end;
$$;

create or replace function public.publish_menu(
  p_menu_version_id uuid,
  p_change_summary text,
  p_confirm_preparation boolean,
  p_urgent boolean default false
)
returns public.menu_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.menu_versions;
  v_previous public.menu_versions;
  v_summary text := nullif(trim(coalesce(p_change_summary, '')), '');
  v_result public.menu_versions;
begin
  if not public.can_manage_menus() then
    raise exception 'forbidden';
  end if;

  select * into v_version from public.menu_versions where id = p_menu_version_id for update;
  if not found then
    raise exception 'menu_not_found';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'menu_not_draft';
  end if;
  if not coalesce(p_confirm_preparation, false) then
    raise exception 'prep_confirmation_required'
      using hint = 'Confirm that ingredients, allergens and cross-contact notes match how the food will actually be prepared.';
  end if;
  if not exists (select 1 from public.menu_items where menu_version_id = v_version.id) then
    raise exception 'menu_empty';
  end if;

  select * into v_previous from public.menu_versions
  where event_id = v_version.event_id and status = 'published'
  for update;

  if v_previous.id is not null and v_summary is null then
    raise exception 'change_summary_required'
      using hint = 'Describe what changed so attendees with allergies can review it.';
  end if;
  if char_length(coalesce(v_summary, '')) > 1000 then
    raise exception 'text_too_long';
  end if;

  perform set_config('app.publishing_menu', 'on', true);

  update public.menu_items mi
    set dish_snapshot = private.dish_snapshot(mi.dish_id)
    where mi.menu_version_id = v_version.id;

  if v_previous.id is not null then
    update public.menu_versions set status = 'archived' where id = v_previous.id;
  end if;

  update public.menu_versions set
    status = 'published',
    change_summary = coalesce(v_summary, 'First published menu.'),
    prep_confirmed_at = now(),
    prep_confirmed_by = auth.uid(),
    published_at = now(),
    published_by = auth.uid()
  where id = v_version.id
  returning * into v_result;

  perform set_config('app.publishing_menu', 'off', true);

  if v_previous.id is not null then
    insert into public.menu_updates (event_id, menu_version_id, message, is_urgent, created_by)
    values (
      v_version.event_id, v_version.id,
      left('Menu updated to version ' || v_result.version || ': ' || v_result.change_summary, 1000),
      coalesce(p_urgent, false), auth.uid()
    );
  end if;

  perform private.log_audit('menu.published', 'menu_versions', v_version.id::text,
    jsonb_build_object('event_id', v_version.event_id, 'version', v_result.version, 'urgent', coalesce(p_urgent, false)));
  return v_result;
end;
$$;

-- One call returns everything needed to render an event's menu.
-- Published menus come from frozen snapshots; drafts (staff only) are live.
create or replace function public.get_event_menu(p_event_id uuid, p_include_draft boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_version public.menu_versions;
  v_staff boolean := public.can_manage_menus();
  v_items jsonb;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    return null;
  end if;
  if not (
    (v_event.status in ('published', 'cancelled') and (v_event.visibility = 'public' or auth.uid() is not null))
    or public.is_staff()
  ) then
    return null;
  end if;

  if p_include_draft and v_staff then
    select * into v_version from public.menu_versions where event_id = p_event_id and status = 'draft';
  end if;
  if v_version.id is null then
    select * into v_version from public.menu_versions where event_id = p_event_id and status = 'published';
  end if;
  if v_version.id is null then
    return jsonb_build_object('event_id', p_event_id, 'version', null, 'items', '[]'::jsonb,
      'updates', private.event_menu_updates(p_event_id));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', mi.id,
      'course', mi.course,
      'sort_order', mi.sort_order,
      'preparation_notes', mi.preparation_notes,
      'cross_contact_notes', mi.cross_contact_notes,
      'cross_contact_allergens', coalesce((
        select jsonb_agg(cc.allergen_code order by cc.allergen_code)
        from public.menu_item_cross_contact cc where cc.menu_item_id = mi.id
      ), '[]'::jsonb),
      'dish', case when v_version.status = 'draft' or mi.dish_snapshot is null
                   then private.dish_snapshot(mi.dish_id) else mi.dish_snapshot end
    ) order by mi.sort_order, mi.course), '[]'::jsonb)
  into v_items
  from public.menu_items mi
  where mi.menu_version_id = v_version.id;

  return jsonb_build_object(
    'event_id', p_event_id,
    'version', jsonb_build_object(
      'id', v_version.id,
      'version', v_version.version,
      'status', v_version.status,
      'title', v_version.title,
      'change_summary', v_version.change_summary,
      'kitchen_notes', v_version.kitchen_notes,
      'prep_confirmed_at', v_version.prep_confirmed_at,
      'published_at', v_version.published_at
    ),
    'items', v_items,
    'updates', private.event_menu_updates(p_event_id)
  );
end;
$$;

create or replace function private.event_menu_updates(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'message', u.message, 'is_urgent', u.is_urgent, 'created_at', u.created_at
  ) order by u.created_at desc), '[]'::jsonb)
  from public.menu_updates u
  where u.event_id = p_event_id;
$$;

-- -----------------------------------------------------------------------------
-- Voting (advisory) and proposed menu options
-- -----------------------------------------------------------------------------
create table public.event_menu_options (
  event_id uuid not null references public.events (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  note text check (char_length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (event_id, dish_id)
);

create table public.dish_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index dish_votes_general_key on public.dish_votes (user_id, dish_id) where event_id is null;
create unique index dish_votes_event_key on public.dish_votes (user_id, dish_id, event_id) where event_id is not null;
create index dish_votes_dish_idx on public.dish_votes (dish_id);

create or replace function private.rate_limit_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('vote:' || coalesce(auth.uid()::text, 'anon'), 60, interval '10 minutes');
  return new;
end;
$$;
create trigger dish_votes_rate_limit
  before insert on public.dish_votes
  for each row execute function private.rate_limit_votes();

create or replace function public.get_dish_vote_counts(p_event_id uuid default null)
returns table (dish_id uuid, votes integer, voted_by_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.dish_id, count(*)::integer, bool_or(v.user_id = auth.uid())
  from public.dish_votes v
  where (p_event_id is null and v.event_id is null)
     or (p_event_id is not null and v.event_id = p_event_id
         and exists (
           select 1 from public.events e where e.id = p_event_id
           and ((e.status in ('published', 'cancelled') and (e.visibility = 'public' or auth.uid() is not null))
                or public.is_staff())))
  group by v.dish_id;
$$;

-- -----------------------------------------------------------------------------
-- Suggestions (dishes, ingredients, feedback)
-- -----------------------------------------------------------------------------
create table public.dish_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  kind text not null default 'dish' check (kind in ('dish', 'ingredient', 'feedback')),
  title text not null check (char_length(title) between 2 and 120),
  details text check (char_length(details) <= 1000),
  status public.suggestion_status not null default 'new',
  staff_response text check (char_length(staff_response) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dish_suggestions_status_idx on public.dish_suggestions (status, created_at desc);
create trigger dish_suggestions_set_updated_at
  before update on public.dish_suggestions
  for each row execute function private.set_updated_at();

create or replace function private.rate_limit_suggestions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('suggest:' || coalesce(auth.uid()::text, 'anon'), 10, interval '1 hour');
  return new;
end;
$$;
create trigger dish_suggestions_rate_limit
  before insert on public.dish_suggestions
  for each row execute function private.rate_limit_suggestions();

-- -----------------------------------------------------------------------------
-- PRIVATE dietary data
-- -----------------------------------------------------------------------------
create table public.dietary_profiles (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  diets text[] not null default '{}' check (diets <@ array[
    'vegetarian', 'vegan', 'pescatarian', 'no_red_meat', 'no_fish', 'dairy_free', 'gluten_free', 'low_sodium'
  ]::text[]),
  other_restrictions text check (char_length(other_restrictions) <= 1000),
  notes_for_kitchen text check (char_length(notes_for_kitchen) <= 1000),
  carries_epinephrine boolean not null default false,
  -- Consent to show these details to kitchen staff/admins for events you RSVP to.
  share_with_kitchen boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger dietary_profiles_set_updated_at
  before update on public.dietary_profiles
  for each row execute function private.set_updated_at();

create table public.user_allergens (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  allergen_code text not null references public.allergens (code),
  severity public.allergen_severity not null default 'allergy',
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, allergen_code)
);

create table public.event_meal_preferences (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  preference text check (char_length(preference) <= 500),
  guest_dietary_notes text check (char_length(guest_dietary_notes) <= 500),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create trigger event_meal_preferences_set_updated_at
  before update on public.event_meal_preferences
  for each row execute function private.set_updated_at();

-- Named report for kitchen staff/admins. Every call is written to the audit log.
create or replace function public.event_dietary_report(p_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  rsvp_status public.rsvp_status,
  guest_count integer,
  guest_status public.guest_status,
  shared boolean,
  allergens jsonb,
  diets text[],
  other_restrictions text,
  notes_for_kitchen text,
  carries_epinephrine boolean,
  meal_preference text,
  guest_dietary_notes text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.can_view_dietary() then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  select count(*) into v_count from public.rsvps r
  where r.event_id = p_event_id and r.status in ('going', 'pending', 'waitlist');

  perform private.log_audit('dietary_report.viewed', 'events', p_event_id::text,
    jsonb_build_object('attendees', v_count));

  return query
  select
    r.user_id,
    coalesce(nullif(p.preferred_name, ''), p.full_name, p.email),
    p.email,
    r.status,
    r.guest_count,
    r.guest_status,
    coalesce(dp.share_with_kitchen, true),
    case when coalesce(dp.share_with_kitchen, true) then coalesce((
      select jsonb_agg(jsonb_build_object('code', ua.allergen_code, 'severity', ua.severity, 'notes', ua.notes)
                       order by ua.allergen_code)
      from public.user_allergens ua where ua.user_id = r.user_id
    ), '[]'::jsonb) else null end,
    case when coalesce(dp.share_with_kitchen, true) then coalesce(dp.diets, '{}') else null end,
    case when coalesce(dp.share_with_kitchen, true) then dp.other_restrictions else null end,
    case when coalesce(dp.share_with_kitchen, true) then dp.notes_for_kitchen else null end,
    case when coalesce(dp.share_with_kitchen, true) then coalesce(dp.carries_epinephrine, false) else null end,
    case when coalesce(dp.share_with_kitchen, true) then mp.preference else null end,
    case when coalesce(dp.share_with_kitchen, true) then mp.guest_dietary_notes else null end
  from public.rsvps r
  join public.profiles p on p.id = r.user_id
  left join public.dietary_profiles dp on dp.user_id = r.user_id
  left join public.event_meal_preferences mp on mp.event_id = r.event_id and mp.user_id = r.user_id
  where r.event_id = p_event_id and r.status in ('going', 'pending', 'waitlist')
  order by r.status, 2;
end;
$$;

-- Anonymous counts for organizers planning food (no names, no free text).
create or replace function public.event_dietary_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (public.can_manage_events() or public.can_view_dietary()) then
    raise exception 'forbidden';
  end if;

  with attendees as (
    select r.user_id, r.status, r.guest_count, r.guest_status,
           coalesce(dp.share_with_kitchen, true) as shared, dp.diets, dp.carries_epinephrine,
           (nullif(trim(coalesce(dp.other_restrictions, '')), '') is not null
             or nullif(trim(coalesce(dp.notes_for_kitchen, '')), '') is not null) as has_notes,
           nullif(trim(coalesce(mp.guest_dietary_notes, '')), '') is not null as has_guest_notes
    from public.rsvps r
    left join public.dietary_profiles dp on dp.user_id = r.user_id
    left join public.event_meal_preferences mp on mp.event_id = r.event_id and mp.user_id = r.user_id
    where r.event_id = p_event_id and r.status in ('going', 'pending', 'waitlist')
  )
  select jsonb_build_object(
    'attendees', (select count(*) from attendees),
    'going', (select count(*) from attendees where status = 'going'),
    'approved_guests', (select coalesce(sum(guest_count), 0) from attendees where status = 'going' and guest_status = 'approved'),
    'not_shared', (select count(*) from attendees where not shared),
    'with_notes', (select count(*) from attendees where shared and has_notes),
    'with_guest_notes', (select count(*) from attendees where shared and has_guest_notes),
    'carries_epinephrine', (select count(*) from attendees where shared and carries_epinephrine),
    'allergens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code, 'label', a.label,
        'intolerance', x.intolerance, 'allergy', x.allergy, 'severe', x.severe
      ) order by a.sort_order)
      from public.allergens a
      join (
        select ua.allergen_code,
          count(*) filter (where ua.severity = 'intolerance') as intolerance,
          count(*) filter (where ua.severity = 'allergy') as allergy,
          count(*) filter (where ua.severity = 'severe') as severe
        from public.user_allergens ua
        join attendees t on t.user_id = ua.user_id and t.shared
        group by ua.allergen_code
      ) x on x.allergen_code = a.code
    ), '[]'::jsonb),
    'diets', coalesce((
      select jsonb_agg(jsonb_build_object('diet', d.diet, 'count', d.n) order by d.diet)
      from (
        select unnest(t.diets) as diet, count(*) as n
        from attendees t where t.shared
        group by 1
      ) d
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS + privileges
-- -----------------------------------------------------------------------------
alter table public.allergens enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_allergens enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.menu_versions enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_cross_contact enable row level security;
alter table public.menu_updates enable row level security;
alter table public.event_menu_options enable row level security;
alter table public.dish_votes enable row level security;
alter table public.dish_suggestions enable row level security;
alter table public.dietary_profiles enable row level security;
alter table public.user_allergens enable row level security;
alter table public.event_meal_preferences enable row level security;

revoke all on
  public.allergens, public.ingredients, public.ingredient_allergens, public.dishes,
  public.dish_ingredients, public.dish_allergens, public.menu_versions, public.menu_items,
  public.menu_item_cross_contact, public.menu_updates, public.event_menu_options,
  public.dish_votes, public.dish_suggestions, public.dietary_profiles, public.user_allergens,
  public.event_meal_preferences
from anon, authenticated;

-- Reference + library data: public read (ingredients are visible before RSVP).
grant select on public.allergens, public.ingredients, public.ingredient_allergens,
  public.dishes, public.dish_ingredients, public.dish_allergens to anon, authenticated;
grant insert, update, delete on public.ingredients, public.ingredient_allergens,
  public.dishes, public.dish_ingredients to authenticated;

create policy "allergens: public read" on public.allergens for select to anon, authenticated using (true);

create policy "ingredients: public read" on public.ingredients for select to anon, authenticated using (true);
create policy "ingredients: menu staff insert" on public.ingredients for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "ingredients: menu staff update" on public.ingredients for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "ingredients: menu staff delete" on public.ingredients for delete to authenticated
  using ((select public.can_manage_menus()));

create policy "ingredient_allergens: public read" on public.ingredient_allergens for select to anon, authenticated using (true);
create policy "ingredient_allergens: menu staff insert" on public.ingredient_allergens for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "ingredient_allergens: menu staff delete" on public.ingredient_allergens for delete to authenticated
  using ((select public.can_manage_menus()));

create policy "dishes: public read" on public.dishes for select to anon, authenticated
  using (status <> 'archived' or (select public.can_manage_menus()));
create policy "dishes: menu staff insert" on public.dishes for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "dishes: menu staff update" on public.dishes for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "dishes: menu staff delete" on public.dishes for delete to authenticated
  using ((select public.can_manage_menus()));

create policy "dish_ingredients: public read" on public.dish_ingredients for select to anon, authenticated using (true);
create policy "dish_ingredients: menu staff insert" on public.dish_ingredients for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "dish_ingredients: menu staff update" on public.dish_ingredients for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "dish_ingredients: menu staff delete" on public.dish_ingredients for delete to authenticated
  using ((select public.can_manage_menus()));

-- Menus: published/archived visible with the event; drafts only to menu staff.
grant select on public.menu_versions, public.menu_items, public.menu_item_cross_contact,
  public.menu_updates, public.event_menu_options to anon, authenticated;
grant insert, update, delete on public.menu_items, public.menu_item_cross_contact,
  public.event_menu_options to authenticated;
grant insert, delete on public.menu_versions to authenticated;
grant update (title, kitchen_notes) on public.menu_versions to authenticated;
grant insert on public.menu_updates to authenticated;

create policy "menu_versions: read published" on public.menu_versions for select to anon, authenticated
  using (
    status <> 'draft'
    and exists (
      select 1 from public.events e
      where e.id = menu_versions.event_id
        and e.status in ('published', 'cancelled')
        and (e.visibility = 'public' or (select auth.uid()) is not null)
    )
  );
create policy "menu_versions: staff read" on public.menu_versions for select to authenticated
  using ((select public.is_staff()));
create policy "menu_versions: menu staff insert" on public.menu_versions for insert to authenticated
  with check ((select public.can_manage_menus()) and status = 'draft');
create policy "menu_versions: menu staff update" on public.menu_versions for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "menu_versions: menu staff delete drafts" on public.menu_versions for delete to authenticated
  using ((select public.can_manage_menus()) and status = 'draft');

create policy "menu_items: read with version" on public.menu_items for select to anon, authenticated
  using (exists (select 1 from public.menu_versions v where v.id = menu_items.menu_version_id));
create policy "menu_items: menu staff insert" on public.menu_items for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "menu_items: menu staff update" on public.menu_items for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "menu_items: menu staff delete" on public.menu_items for delete to authenticated
  using ((select public.can_manage_menus()));

create policy "menu_item_cross_contact: read with item" on public.menu_item_cross_contact for select to anon, authenticated
  using (exists (select 1 from public.menu_items mi where mi.id = menu_item_cross_contact.menu_item_id));
create policy "menu_item_cross_contact: menu staff insert" on public.menu_item_cross_contact for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "menu_item_cross_contact: menu staff delete" on public.menu_item_cross_contact for delete to authenticated
  using ((select public.can_manage_menus()));

create policy "menu_updates: read with event" on public.menu_updates for select to anon, authenticated
  using (exists (
    select 1 from public.events e where e.id = menu_updates.event_id
      and ((e.status in ('published', 'cancelled') and (e.visibility = 'public' or (select auth.uid()) is not null))
           or (select public.is_staff()))
  ));
create policy "menu_updates: menu staff insert" on public.menu_updates for insert to authenticated
  with check ((select public.can_manage_menus()) and created_by = (select auth.uid()));

create policy "event_menu_options: read with event" on public.event_menu_options for select to anon, authenticated
  using (exists (
    select 1 from public.events e where e.id = event_menu_options.event_id
      and ((e.status in ('published', 'cancelled') and (e.visibility = 'public' or (select auth.uid()) is not null))
           or (select public.is_staff()))
  ));
create policy "event_menu_options: menu staff insert" on public.event_menu_options for insert to authenticated
  with check ((select public.can_manage_menus()));
create policy "event_menu_options: menu staff update" on public.event_menu_options for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));
create policy "event_menu_options: menu staff delete" on public.event_menu_options for delete to authenticated
  using ((select public.can_manage_menus()));

-- Votes: your own only; counts via get_dish_vote_counts().
grant select, insert, delete on public.dish_votes to authenticated;
create policy "dish_votes: read own" on public.dish_votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dish_votes: insert own" on public.dish_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.dishes d where d.id = dish_votes.dish_id and d.status in ('active', 'proposed'))
    and (
      event_id is null
      or exists (
        select 1 from public.event_menu_options o
        join public.events e on e.id = o.event_id
        where o.event_id = dish_votes.event_id and o.dish_id = dish_votes.dish_id
          and e.status = 'published' and e.menu_voting_open
      )
    )
  );
create policy "dish_votes: delete own" on public.dish_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Suggestions: submit your own; menu staff review.
grant select on public.dish_suggestions to authenticated;
grant insert (event_id, kind, title, details) on public.dish_suggestions to authenticated;
grant update (status, staff_response, reviewed_by, reviewed_at) on public.dish_suggestions to authenticated;
create policy "dish_suggestions: read own" on public.dish_suggestions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dish_suggestions: menu staff read" on public.dish_suggestions for select to authenticated
  using ((select public.can_manage_menus()));
create policy "dish_suggestions: insert own" on public.dish_suggestions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new');
create policy "dish_suggestions: menu staff update" on public.dish_suggestions for update to authenticated
  using ((select public.can_manage_menus())) with check ((select public.can_manage_menus()));

-- Dietary data: OWNER ONLY. No staff policies on purpose.
grant select, insert, update, delete on public.dietary_profiles, public.user_allergens,
  public.event_meal_preferences to authenticated;

create policy "dietary_profiles: owner select" on public.dietary_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dietary_profiles: owner insert" on public.dietary_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "dietary_profiles: owner update" on public.dietary_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dietary_profiles: owner delete" on public.dietary_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "user_allergens: owner select" on public.user_allergens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_allergens: owner insert" on public.user_allergens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_allergens: owner update" on public.user_allergens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_allergens: owner delete" on public.user_allergens for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "event_meal_preferences: owner select" on public.event_meal_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "event_meal_preferences: owner insert" on public.event_meal_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "event_meal_preferences: owner update" on public.event_meal_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "event_meal_preferences: owner delete" on public.event_meal_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- Function privileges
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.create_menu_draft(uuid, boolean) from public, anon;
revoke execute on function public.publish_menu(uuid, text, boolean, boolean) from public, anon;
revoke execute on function public.event_dietary_report(uuid) from public, anon;
revoke execute on function public.event_dietary_summary(uuid) from public, anon;
grant execute on function public.create_menu_draft(uuid, boolean) to authenticated;
grant execute on function public.publish_menu(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.event_dietary_report(uuid) to authenticated;
grant execute on function public.event_dietary_summary(uuid) to authenticated;
grant execute on function public.get_event_menu(uuid, boolean) to anon, authenticated;
grant execute on function public.get_dish_vote_counts(uuid) to anon, authenticated;
