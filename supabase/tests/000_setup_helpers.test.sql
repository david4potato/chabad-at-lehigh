-- Test helpers shared by all database tests (local/CI databases only).
-- Run all tests with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Create a confirmed auth user; the on_auth_user_created trigger gives them a
-- profile and a default role (student for @lehigh.edu, otherwise community guest).
create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now());
  update public.profiles set full_name = split_part(p_email, '@', 1), onboarded_at = now() where id = v_id;
  return v_id;
end;
$$;

create or replace function tests.add_role(p_user uuid, p_role public.app_role)
returns void
language sql
security definer
set search_path = ''
as $$ insert into public.user_roles (user_id, role) values (p_user, p_role) on conflict do nothing; $$;

-- Act as a signed-in user for the rest of the transaction (until tests.as_anon / reset role).
create or replace function tests.as_user(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Run a statement as the current role and return how many rows it changed.
create or replace function tests.rows_affected(p_sql text)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select ok(true, 'test helpers installed');
select * from finish();
commit;
