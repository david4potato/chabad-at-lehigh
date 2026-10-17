-- =============================================================================
-- Chabad at Lehigh — core schema: roles, profiles, settings, rate limits, audit
-- =============================================================================
-- Conventions used across all migrations:
--   * Every table in `public` has row level security (RLS) enabled.
--   * Table privileges are granted explicitly (least privilege) on top of RLS.
--   * Privileged logic lives in SECURITY DEFINER functions with an empty
--     search_path and fully-qualified names.
--   * The `private` schema is NOT exposed through the Supabase Data API.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'student',
  'community_guest',
  'organizer',
  'kitchen_staff',
  'admin'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  preferred_name text check (char_length(preferred_name) <= 60),
  affiliation text not null default 'community'
    check (affiliation in ('student', 'community', 'alumni', 'parent', 'faculty_staff', 'other')),
  class_year integer check (class_year between 1950 and 2100),
  phone text check (char_length(phone) <= 40),
  -- Reserved for the planned "friends attending" feature. Off by default.
  share_attendance boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Basic profile per signed-in person. Dietary data lives in dietary_profiles (private).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

-- Roles to grant automatically when a given email signs in for the first time.
create table public.pending_role_grants (
  email text not null check (email = lower(email) and email like '%@%'),
  role public.app_role not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (email, role)
);

-- -----------------------------------------------------------------------------
-- Role helper functions (used by RLS policies)
-- -----------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = p_role
  );
$$;

create or replace function public.has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = any (p_roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_role('admin'); $$;

-- Organizers and admins manage events, RSVPs, announcements.
create or replace function public.can_manage_events()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_any_role(array['organizer', 'admin']::public.app_role[]); $$;

-- Organizers, kitchen staff and admins manage menus, dishes, ingredients.
create or replace function public.can_manage_menus()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_any_role(array['organizer', 'kitchen_staff', 'admin']::public.app_role[]); $$;

-- Only kitchen staff and admins may see named dietary / allergy details.
create or replace function public.can_view_dietary()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_any_role(array['kitchen_staff', 'admin']::public.app_role[]); $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.has_any_role(array['organizer', 'kitchen_staff', 'admin']::public.app_role[]); $$;

-- Convenience for the app: the current user's roles.
create or replace function public.my_roles()
returns public.app_role[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(ur.role order by ur.role), '{}')
  from public.user_roles ur
  where ur.user_id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- App settings (contact info, address, student email domains)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function private.set_updated_at();

insert into public.app_settings (key, value) values
  ('student_email_domains', '["lehigh.edu"]'),
  -- Contact details from public listings (Lubavitch.com center directory, Lehigh
  -- chaplaincy page, Chabad.org / The Brown and White), October 2026. Confirm
  -- with the Greenbergs; editable any time in Dashboard → Settings.
  ('organization', jsonb_build_object(
    'name', 'Chabad at Lehigh',
    'contact_name', 'Rabbi Zalman & Dit Greenberg',
    'contact_email', 'rabbi@chabadlehigh.org',
    'contact_phone', '(610) 419-9036',
    'address', E'Joachim Schaufeld Center for Jewish Life\n306 Wyandotte Street\nBethlehem, PA 18015',
    'directions', 'We''re in the Joachim Schaufeld Center for Jewish Life, a historic mansion on Wyandotte Street in South Bethlehem, close to Lehigh''s campus.',
    'parking', '',
    'map_query', '306 Wyandotte Street, Bethlehem, PA 18015'
  ));

-- -----------------------------------------------------------------------------
-- Audit log (append-only; written by triggers and SECURITY DEFINER functions)
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_events_created_at_idx on public.audit_events (created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

create or replace function private.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Only reference actors that have a profile (service-role/seed writes have none).
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor) then
    v_actor := null;
  end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, details)
  values (v_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'));
end;
$$;

-- Generic row-change audit trigger. Records which columns changed, not the
-- values, so private content is never copied into the audit log.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_changed text[];
  v_new jsonb;
  v_old jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id := coalesce(v_old ->> 'id', v_old ->> 'key', v_old ->> 'user_id');
    perform private.log_audit(lower(tg_table_name) || '.delete', tg_table_name, v_id, '{}');
    return old;
  end if;

  v_new := to_jsonb(new);
  v_id := coalesce(v_new ->> 'id', v_new ->> 'key', v_new ->> 'user_id');

  if tg_op = 'INSERT' then
    perform private.log_audit(lower(tg_table_name) || '.insert', tg_table_name, v_id,
      case when v_new ? 'role' then jsonb_build_object('role', v_new ->> 'role') else '{}'::jsonb end);
    return new;
  end if;

  v_old := to_jsonb(old);
  select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
  from jsonb_each(v_new) n
  where n.key not in ('updated_at')
    and (v_old -> n.key) is distinct from n.value;

  if cardinality(v_changed) > 0 then
    perform private.log_audit(lower(tg_table_name) || '.update', tg_table_name, v_id,
      jsonb_build_object('changed', to_jsonb(v_changed))
      || case when 'status' = any (v_changed)
           then jsonb_build_object('status', v_new ->> 'status') else '{}'::jsonb end);
  end if;
  return new;
end;
$$;

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function private.audit_row_change();

create trigger pending_role_grants_audit
  after insert or update or delete on public.pending_role_grants
  for each row execute function private.audit_row_change();

create trigger app_settings_audit
  after insert or update or delete on public.app_settings
  for each row execute function private.audit_row_change();

-- Never allow removing the last admin.
create or replace function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.user_roles
    where role = 'admin' and user_id <> old.user_id
  ) and exists (select 1 from public.profiles where id = old.user_id) then
    raise exception 'last_admin' using
      hint = 'Grant admin to another person before removing the last admin.';
  end if;
  return old;
end;
$$;

create trigger user_roles_protect_last_admin
  before delete on public.user_roles
  for each row execute function private.protect_last_admin();

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window, stored in Postgres — no extra service needed)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

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

  -- Opportunistic cleanup of this key's old windows.
  delete from private.rate_limits
  where key = p_key and window_start < now() - interval '1 day';

  if v_hits > p_max then
    raise exception 'rate_limited' using hint = 'Too many requests. Please wait a few minutes and try again.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- New-user bootstrap: profile + default role + any pending role grants
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_domain text := split_part(lower(coalesce(new.email, '')), '@', 2);
  v_student_domains jsonb;
  v_is_student boolean := false;
begin
  insert into public.profiles (id, email, full_name, affiliation)
  values (
    new.id,
    v_email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    'community'
  )
  on conflict (id) do nothing;

  select value into v_student_domains from public.app_settings where key = 'student_email_domains';
  if v_student_domains is not null and jsonb_typeof(v_student_domains) = 'array' then
    select exists (
      select 1 from jsonb_array_elements_text(v_student_domains) d
      where v_domain = lower(d) or v_domain like '%.' || lower(d)
    ) into v_is_student;
  end if;

  if v_is_student then
    update public.profiles set affiliation = 'student' where id = new.id;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, case when v_is_student then 'student'::public.app_role else 'community_guest'::public.app_role end)
  on conflict do nothing;

  insert into public.user_roles (user_id, role)
  select new.id, p.role from public.pending_role_grants p where p.email = v_email
  on conflict do nothing;

  delete from public.pending_role_grants where email = v_email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Admin helper: grant / revoke roles by email (works before or after sign-up)
-- -----------------------------------------------------------------------------
create or replace function public.admin_grant_role(p_email text, p_role public.app_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;

  select id into v_user from public.profiles where email = v_email;
  if v_user is null then
    insert into public.pending_role_grants (email, role, created_by)
    values (v_email, p_role, auth.uid())
    on conflict do nothing;
    return 'pending';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_user, p_role, auth.uid())
  on conflict do nothing;
  return 'granted';
end;
$$;

create or replace function public.admin_revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = p_role;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS + privileges
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.pending_role_grants enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.profiles, public.user_roles, public.pending_role_grants,
  public.app_settings, public.audit_events from anon, authenticated;

-- profiles: you can read and edit your own; organizers/admins can read profiles
-- (kitchen staff see names only through the audited dietary report).
grant select on public.profiles to authenticated;
grant update (full_name, preferred_name, affiliation, class_year, phone, share_attendance, onboarded_at)
  on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: organizers read" on public.profiles
  for select to authenticated using ((select public.can_manage_events()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: read your own roles; staff read all; only admins change roles.
grant select, insert, delete on public.user_roles to authenticated;

create policy "user_roles: read own" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_roles: organizers read" on public.user_roles
  for select to authenticated using ((select public.can_manage_events()));
create policy "user_roles: admin insert" on public.user_roles
  for insert to authenticated with check ((select public.is_admin()));
create policy "user_roles: admin delete" on public.user_roles
  for delete to authenticated using ((select public.is_admin()));

-- pending_role_grants: admins only.
grant select, insert, delete on public.pending_role_grants to authenticated;
create policy "pending_role_grants: admin all" on public.pending_role_grants
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- app_settings: everyone can read (contact info, address); admins edit.
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
create policy "app_settings: public read" on public.app_settings
  for select to anon, authenticated using (key <> 'student_email_domains' or (select public.is_admin()));
create policy "app_settings: admin insert" on public.app_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy "app_settings: admin update" on public.app_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- audit_events: admins read; nobody writes directly.
grant select on public.audit_events to authenticated;
create policy "audit_events: admin read" on public.audit_events
  for select to authenticated using ((select public.is_admin()));

-- Function privileges: helpers are callable by signed-in users; admin RPCs check
-- roles internally. Anonymous callers get nothing they don't need.
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
revoke execute on function public.admin_grant_role(text, public.app_role) from public, anon;
revoke execute on function public.admin_revoke_role(uuid, public.app_role) from public, anon;
revoke execute on function public.my_roles() from public, anon;
grant execute on function public.admin_grant_role(text, public.app_role) to authenticated;
grant execute on function public.admin_revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.my_roles() to authenticated;
