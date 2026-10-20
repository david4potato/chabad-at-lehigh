-- =============================================================================
-- SYNTHETIC SCALE DATA, for local performance measurement only.
--
-- NEVER run this on the live Supabase project or on any database people use.
-- It adds about 5,000 fake accounts and three years of fake activity. Read
-- supabase/perf/README.md first. The script refuses to run unless the session
-- sets perf.local_only = 'yes', and it refuses to run twice.
--
-- Scale (one large campus over about three years, ending 90 days from today):
--   5,000 accounts (3,100 students, 1,880 community, 20 staff), 600 events
--   (a Shabbat dinner every Friday plus 444 other events), about 41,500 RSVPs,
--   dietary details for about 40% of people, 800 ingredients, 400 dishes,
--   menus for meal events, about 2,800 votes and suggestions, about 150,000
--   notifications, about 60,000 audit entries, volunteer shifts and sign-ups,
--   announcements and learning sign-ups.
--
-- Repeatable: every per-row choice (who RSVPs to which event, which dishes are
-- on a menu) comes from an md5 hash of stable keys, so it does not depend on
-- query plans, and setseed() fixes random() for anything that uses it. Dates
-- are relative to now(), so a run on another day shifts the window with it.
--
-- Triggers turned off while loading (inside this transaction only), because
-- they would reject old data and they send nothing:
--   dish_votes_rate_limit, dish_suggestions_rate_limit (rate limits),
--   volunteer_signups_capacity, learning_signups_capacity (rate limit, and they
--   refuse sign-ups for shifts that already started).
-- All other triggers run as usual: new accounts get a profile and a role from
-- on_auth_user_created, audit triggers write the audit log, menu guards check
-- versions, and urgent menu updates notify attendees.
--
-- Run (from the repository root, against a local COPY of the database):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/perf" -v ON_ERROR_STOP=1 \
--     -c "set perf.local_only = 'yes'" -f supabase/perf/scale_seed.sql
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
begin
  if coalesce(current_setting('perf.local_only', true), '') <> 'yes' then
    raise exception 'Refusing to run: local measurement only. See supabase/perf/README.md.';
  end if;
  if exists (select 1 from auth.users where email like 'perf-%') then
    raise exception 'Synthetic data is already loaded in this database.';
  end if;
end;
$$;

select setseed(0.20261019);

-- A repeatable number in [0, 1) from any text key.
create function pg_temp.h(p_key text)
returns double precision
language sql
immutable
as $$ select ('x' || substr(md5(p_key), 1, 12))::bit(48)::bigint / 281474976710656.0 $$;

alter table public.dish_votes disable trigger dish_votes_rate_limit;
alter table public.dish_suggestions disable trigger dish_suggestions_rate_limit;
alter table public.volunteer_signups disable trigger volunteer_signups_capacity;
alter table public.learning_signups disable trigger learning_signups_capacity;

create temp table perf_cfg as
select (now() at time zone 'America/New_York')::date as today,
       (now() at time zone 'America/New_York')::date - 1000 as first_day,
       (now() at time zone 'America/New_York')::date + 90 as last_day;

-- -----------------------------------------------------------------------------
-- People: 4 fixed accounts to measure with, 16 more staff, students, community
-- -----------------------------------------------------------------------------
create temp table perf_users as
with base as (
  select n,
    case
      when n = 1 then 'student'
      when n = 2 then 'organizer'
      when n = 3 then 'kitchen_staff'
      when n = 4 then 'admin'
      when n between 5 and 9 then 'organizer_student'
      when n between 10 and 14 then 'organizer'
      when n between 15 and 18 then 'kitchen_staff'
      when n between 19 and 20 then 'admin'
      when n <= 3100 then 'student'
      else 'community'
    end as kind
  from generate_series(1, 5000) n
), dated as (
  select b.*,
    b.kind in ('student', 'organizer_student') as is_student,
    case
      when b.n <= 20 then (c.first_day - 30)::timestamptz + interval '10 hours'
      -- About 30% signed up in the first month (launch), the rest over time.
      when pg_temp.h('j' || b.n) < 0.3 then (c.first_day + floor(pg_temp.h('jd' || b.n) * 30)::int)::timestamptz
        + make_interval(hours => 8 + floor(pg_temp.h('jh' || b.n) * 14)::int)
      else (c.first_day + floor(pg_temp.h('jd' || b.n) * (c.today - c.first_day))::int)::timestamptz
        + make_interval(hours => 8 + floor(pg_temp.h('jh' || b.n) * 14)::int)
    end as created_at
  from base b cross join perf_cfg c
)
select d.n, d.kind, d.is_student,
  case d.n
    when 1 then 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
    when 2 then 'aaaaaaaa-0000-4000-8000-000000000002'::uuid
    when 3 then 'aaaaaaaa-0000-4000-8000-000000000003'::uuid
    when 4 then 'aaaaaaaa-0000-4000-8000-000000000004'::uuid
    else md5('perf-user-' || d.n)::uuid
  end as id,
  case d.n
    when 1 then 'perf-student@lehigh.edu'
    when 2 then 'perf-organizer@example.com'
    when 3 then 'perf-kitchen@example.com'
    when 4 then 'perf-admin@example.com'
    else 'perf-' || case when d.is_student then 's' || d.n || '@lehigh.edu' else 'c' || d.n || '@example.com' end
  end as email,
  (array['Avi','Ben','Chana','Daniel','Eli','Esther','Gabe','Hannah','Isaac','Jacob','Leah','Maya','Miriam','Noah',
         'Rachel','Rebecca','Sam','Sarah','Tamar','Yael','Adam','Ari','Dina','Ezra','Josh','Lily','Max','Naomi',
         'Nate','Rivka','Shira','Talia','Zach','Emma','Olivia','Liam','Ethan','Ava','Mia','Ella'])[1 + floor(pg_temp.h('fn' || d.n) * 40)::int]
  || ' ' ||
  (array['Cohen','Levy','Katz','Friedman','Goldberg','Schwartz','Klein','Weiss','Rosen','Shapiro','Kaplan','Adler',
         'Berger','Stein','Gross','Fischer','Bloom','Green','Segal','Mendel','Baker','Miller','Davis','Garcia','Chen',
         'Patel','Kim','Nguyen','Lopez','Brown','Wilson','Moore','Taylor','Clark','Lewis','Walker','Hall','Young',
         'King','Wright'])[1 + floor(pg_temp.h('ln' || d.n) * 40)::int] as full_name,
  d.created_at,
  case
    when d.n <= 20 then 'infinity'::timestamptz
    when d.is_student then d.created_at + make_interval(days => 365 + floor(pg_temp.h('au' || d.n) * 1100)::int)
    else d.created_at + make_interval(days => 120 + floor(pg_temp.h('au' || d.n) * 980)::int)
  end as active_until,
  -- How often someone comes: a few people come nearly every week, most rarely.
  case
    when d.n = 1 then 40.0
    when d.n = 2 then 25.0
    when d.n = 3 then 4.0
    when d.n = 4 then 15.0
    when d.n <= 20 then 8.0
    when d.is_student then 0.3 + 6.0 * power(pg_temp.h('w' || d.n), 3)
    else 0.2 + 3.0 * power(pg_temp.h('w' || d.n), 3)
  end as weight
from dated d;

create unique index on perf_users (id);

-- The on_auth_user_created trigger creates each profile and default role.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, last_sign_in_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, u.created_at,
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
  u.created_at, u.created_at, least(now(), u.active_until)
from perf_users u
order by u.n;

update public.profiles p set
  created_at = u.created_at,
  preferred_name = case when pg_temp.h('pn' || u.n) < 0.12 then split_part(u.full_name, ' ', 1) end,
  affiliation = case
    when u.is_student then 'student'
    else (array['community','community','alumni','parent','faculty_staff','other'])[1 + floor(pg_temp.h('af' || u.n) * 6)::int]
  end,
  class_year = case when u.is_student then extract(year from u.created_at)::int + 1 + floor(pg_temp.h('cy' || u.n) * 4)::int end,
  phone = case when pg_temp.h('ph' || u.n) < 0.3 then '610-555-' || lpad((u.n % 10000)::text, 4, '0') end,
  onboarded_at = case when u.n <= 20 or pg_temp.h('ob' || u.n) < 0.92 then u.created_at + interval '5 minutes' end
from perf_users u
where p.id = u.id;

-- Act as the admin for role grants, so the audit log names an actor.
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);

insert into public.user_roles (user_id, role, granted_by, granted_at)
select u.id, r.role::public.app_role,
  case when u.n = 4 then null else 'aaaaaaaa-0000-4000-8000-000000000004'::uuid end,
  u.created_at + interval '1 day'
from perf_users u
join (values ('organizer', 'organizer'), ('organizer_student', 'organizer'),
             ('kitchen_staff', 'kitchen_staff'), ('admin', 'admin')) r(kind, role) on r.kind = u.kind
order by u.n;

create temp table perf_staff as
select
  array_agg(id order by n) filter (where kind in ('organizer', 'organizer_student', 'admin')) as organizers,
  array_agg(id order by n) filter (where kind in ('kitchen_staff', 'admin')) as kitchen
from perf_users
where n <= 20;

-- From here on, act as the main organizer (events, menus, shifts, announcements).
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);

-- -----------------------------------------------------------------------------
-- Events: a Shabbat dinner every Friday, plus 444 other events
-- -----------------------------------------------------------------------------
create temp table perf_ev (
  id uuid primary key, slug text, category public.event_category, status public.event_status,
  visibility public.event_visibility, starts_at timestamptz, ends_eff timestamptz, capacity integer,
  approval_mode public.approval_mode, max_guests integer, has_meal boolean
);

with fridays as (
  select d::date as d
  from perf_cfg c,
       generate_series(c.first_day + ((5 - extract(isodow from c.first_day)::int + 7) % 7), c.last_day, interval '7 days') d
), shabbat_rows as (
  select
    'shabbat-dinner-' || to_char(f.d, 'YYYY-MM-DD') as slug,
    'Shabbat Dinner' as title,
    'Friday-night dinner for students and community.' as summary,
    'Candle lighting, kiddush, a home-cooked dinner and good company. Everyone is welcome.' as description,
    'shabbat_dinner'::public.event_category as category,
    case
      when f.d > c.today + 28 then 'draft'
      when pg_temp.h('cancel' || f.d) < 0.02 then 'cancelled'
      else 'published'
    end::public.event_status as status,
    'public'::public.event_visibility as visibility,
    (f.d + time '18:30') at time zone 'America/New_York' as starts_at,
    (f.d + time '21:00') at time zone 'America/New_York' as ends_at,
    'Chabad House' as location_name,
    '306 Wyandotte Street, Bethlehem, PA 18015' as location_address,
    160 as capacity,
    (f.d + time '12:00') at time zone 'America/New_York' as rsvp_deadline,
    'guests_need_approval'::public.approval_mode as approval_mode,
    2 as max_guests,
    true as has_meal,
    f.d between c.today and c.today + 14 as menu_voting_open,
    (select organizers[1 + floor(pg_temp.h('ecb' || f.d) * array_length(organizers, 1))::int] from perf_staff) as created_by
  from fridays f cross join perf_cfg c
), others as (
  select i,
    case
      when pg_temp.h('ec' || i) < 0.14 then 'holiday'
      when pg_temp.h('ec' || i) < 0.59 then 'learning'
      when pg_temp.h('ec' || i) < 0.84 then 'social'
      when pg_temp.h('ec' || i) < 0.93 then 'volunteer'
      else 'other'
    end::public.event_category as category,
    c.first_day + floor(pg_temp.h('ed' || i) * (c.last_day - c.first_day))::int as d0
  from generate_series(1, 444) i cross join perf_cfg c
), others2 as (
  select o.*,
    -- Fridays and Saturdays belong to Shabbat; move other events to Sunday.
    case when o.category <> 'holiday' and extract(isodow from o.d0) in (5, 6)
         then o.d0 + (7 - extract(isodow from o.d0)::int) else o.d0 end as d,
    case o.category
      when 'holiday' then (array['Rosh Hashanah Dinner','Yom Kippur Break-Fast','Sukkot in the Sukkah','Chanukah Party',
                                 'Purim Celebration','Passover Seder','Shavuot Ice Cream Party','Lag BaOmer BBQ'])[1 + floor(pg_temp.h('et' || o.i) * 8)::int]
      when 'learning' then (array['Lunch & Learn','Torah Study','Jewish Mysticism Class','Talmud for Beginners'])[1 + floor(pg_temp.h('et' || o.i) * 4)::int]
      when 'social' then (array['Study Break: Snacks & Board Games','Bagel Brunch','Movie Night','Challah Bake','Sushi in the Sukkah'])[1 + floor(pg_temp.h('et' || o.i) * 5)::int]
      when 'volunteer' then (array['Community Volunteer Morning','Care Package Packing','Food Drive'])[1 + floor(pg_temp.h('et' || o.i) * 3)::int]
      else (array['Guest Speaker','Graduation Celebration','Parents Weekend Brunch'])[1 + floor(pg_temp.h('et' || o.i) * 3)::int]
    end as title
  from others o
), other_rows as (
  select
    trim(both '-' from regexp_replace(lower(o.title), '[^a-z0-9]+', '-', 'g')) || '-' || to_char(o.d, 'YYYY-MM-DD') || '-' || o.i as slug,
    o.title,
    'Synthetic event for performance measurement.' as summary,
    null::text as description,
    o.category,
    case
      when o.d > c.today + 35 then case when pg_temp.h('es' || o.i) < 0.6 then 'draft' else 'published' end
      when pg_temp.h('es' || o.i) < 0.02 then 'draft'
      when pg_temp.h('es' || o.i) < 0.06 then 'cancelled'
      else 'published'
    end::public.event_status as status,
    case when pg_temp.h('ev' || o.i) < 0.15 then 'members' else 'public' end::public.event_visibility as visibility,
    (o.d + case o.category when 'learning' then time '12:00' when 'social' then time '20:00' when 'holiday' then time '18:00'
                           when 'volunteer' then time '10:00' else time '19:00' end) at time zone 'America/New_York' as starts_at,
    case when pg_temp.h('ee' || o.i) < 0.08 then null else
      (o.d + case o.category when 'learning' then time '13:00' when 'social' then time '22:00' when 'holiday' then time '21:00'
                             when 'volunteer' then time '12:00' else time '20:30' end) at time zone 'America/New_York' end as ends_at,
    case when o.category in ('holiday', 'volunteer') or pg_temp.h('el' || o.i) < 0.7 then 'Chabad House' else 'Campus meeting room' end as location_name,
    null::text as location_address,
    case o.category
      when 'holiday' then 200 when 'learning' then 25 when 'volunteer' then 20
      when 'social' then case when pg_temp.h('ek' || o.i) < 0.3 then null else 40 end
      else case when pg_temp.h('ek' || o.i) < 0.5 then null else 60 end
    end as capacity,
    null::timestamptz as rsvp_deadline,
    case
      when o.category = 'holiday' then 'guests_need_approval'
      when o.category = 'volunteer' and pg_temp.h('ea' || o.i) < 0.5 then 'all_need_approval'
      else 'auto'
    end::public.approval_mode as approval_mode,
    case o.category when 'holiday' then 3 when 'social' then 2 when 'learning' then 1 else 0 end as max_guests,
    o.category in ('holiday', 'learning') or (o.category = 'social' and pg_temp.h('em' || o.i) < 0.4) as has_meal,
    false as menu_voting_open,
    (select organizers[1 + floor(pg_temp.h('ecb' || o.i) * array_length(organizers, 1))::int] from perf_staff) as created_by
  from others2 o cross join perf_cfg c
), all_rows as (
  select * from shabbat_rows union all select * from other_rows
), ins as (
  insert into public.events (slug, title, summary, description, category, status, visibility, starts_at, ends_at,
    location_name, location_address, capacity, rsvp_enabled, rsvp_deadline, approval_mode, max_guests_per_rsvp,
    has_meal, menu_voting_open, created_by, created_at, updated_at)
  select slug, title, summary, description, category, status, visibility, starts_at, ends_at,
    location_name, location_address, capacity, true, rsvp_deadline, approval_mode, max_guests,
    has_meal, menu_voting_open, created_by,
    least(now(), starts_at - interval '14 days'), least(now(), starts_at - interval '14 days')
  from all_rows
  order by starts_at, slug
  returning id, slug, category, status, visibility, starts_at, ends_at, capacity, approval_mode, max_guests_per_rsvp, has_meal
)
insert into perf_ev
select id, slug, category, status, visibility, starts_at, coalesce(ends_at, starts_at + interval '3 hours'),
  capacity, approval_mode, max_guests_per_rsvp, has_meal
from ins;

-- -----------------------------------------------------------------------------
-- RSVPs (weighted sample of people active at the time of each event)
-- -----------------------------------------------------------------------------
create temp table perf_ev_target as
select e.*,
  case when e.status = 'draft' then 0 else round(
    (case e.category when 'shabbat_dinner' then 175 when 'holiday' then 170 when 'learning' then 28
                     when 'social' then 45 when 'volunteer' then 16 else 38 end)
    * (0.85 + 0.3 * pg_temp.h('tn' || e.slug))
    -- Summer and winter break are quieter (most students are away).
    * case when e.category in ('shabbat_dinner', 'learning', 'social')
             and extract(month from e.starts_at at time zone 'America/New_York') in (6, 7, 8) then 0.35
           when extract(month from e.starts_at at time zone 'America/New_York') = 1
             and extract(day from e.starts_at at time zone 'America/New_York') < 15 then 0.6
           else 1 end
    -- Upcoming events have only part of their RSVPs so far.
    * case when e.starts_at <= now() then 1
           when e.starts_at <= now() + interval '7 days' then 0.7
           when e.starts_at <= now() + interval '30 days' then 0.3
           else 0.1 end
  )::int end as target_n,
  e.ends_eff < now() and pg_temp.h('ci' || e.slug) < 0.65 as used_check_in
from perf_ev e;

insert into public.rsvps (event_id, user_id, status, guest_count, guest_names, guest_status, note, waitlisted_at,
  status_changed_at, decided_by, decided_at, checked_in_at, checked_in_by, created_at, updated_at)
select e.id, s.id, st.status, g.guest_count,
  case when g.guest_count > 0 then 'Friend of ' || split_part(s.full_name, ' ', 1) end,
  g.guest_status,
  case when pg_temp.h('no' || e.slug || s.n) < 0.03 then 'Might be a few minutes late.' end,
  case when st.status = 'waitlist' then t.created_at end,
  t.created_at,
  case when e.approval_mode <> 'auto' and (st.status = 'declined' or (st.status = 'going' and pg_temp.h('dc' || e.slug || s.n) < 0.35))
       then (select organizers[1 + floor(pg_temp.h('db' || e.slug || s.n) * array_length(organizers, 1))::int] from perf_staff) end,
  case when e.approval_mode <> 'auto' and (st.status = 'declined' or (st.status = 'going' and pg_temp.h('dc' || e.slug || s.n) < 0.35))
       then t.created_at + interval '1 day' end,
  case when e.used_check_in and st.status = 'going' and pg_temp.h('cu' || e.slug || s.n) < 0.86
       then e.starts_at + make_interval(mins => floor(pg_temp.h('cm' || e.slug || s.n) * 45)::int) end,
  case when e.used_check_in and st.status = 'going' and pg_temp.h('cu' || e.slug || s.n) < 0.86
       then (select organizers[1 + floor(pg_temp.h('cb' || e.slug) * array_length(organizers, 1))::int] from perf_staff) end,
  t.created_at, t.created_at
from perf_ev_target e
cross join lateral (
  select u.id, u.n, u.full_name, row_number() over (order by -ln(greatest(pg_temp.h(e.slug || ':' || u.n), 1e-15)) / u.weight) as rk
  from perf_users u
  where u.created_at <= e.starts_at - interval '1 day' and u.active_until >= e.starts_at
  order by -ln(greatest(pg_temp.h(e.slug || ':' || u.n), 1e-15)) / u.weight
  limit e.target_n
) s
cross join lateral (
  select case
    when pg_temp.h('st' || e.slug || s.n) < 0.08 then 'not_going'
    when pg_temp.h('st' || e.slug || s.n) < 0.09 and e.approval_mode <> 'auto' then 'declined'
    when pg_temp.h('st' || e.slug || s.n) < 0.11 and e.approval_mode <> 'auto' and e.starts_at > now() then 'pending'
    when e.capacity is not null and s.rk > e.capacity then 'waitlist'
    else 'going'
  end::public.rsvp_status as status
) st
cross join lateral (
  select
    case when st.status = 'going' and e.max_guests > 0 and pg_temp.h('g' || e.slug || s.n) < 0.12
         then least(e.max_guests, 1 + case when pg_temp.h('g2' || e.slug || s.n) < 0.25 then 1 else 0 end) else 0 end as guest_count
) gc
cross join lateral (
  select gc.guest_count,
    case
      when gc.guest_count = 0 then 'none'
      when e.approval_mode = 'auto' then 'approved'
      when pg_temp.h('gs' || e.slug || s.n) < 0.8 then 'approved'
      when pg_temp.h('gs' || e.slug || s.n) < 0.9 and e.starts_at > now() then 'pending'
      else 'declined'
    end::public.guest_status as guest_status
) g
cross join lateral (
  select least(now() - interval '1 minute',
               e.starts_at - make_interval(hours => 2 + floor(pg_temp.h('rc' || e.slug || s.n) * 300)::int)) as created_at
) t
order by e.starts_at, s.rk;

-- -----------------------------------------------------------------------------
-- Private dietary details (about 40% of people)
-- -----------------------------------------------------------------------------
insert into public.dietary_profiles (user_id, diets, other_restrictions, notes_for_kitchen, carries_epinephrine,
  share_with_kitchen, updated_at)
select u.id,
  array_remove(array[
    case when pg_temp.h('dv' || u.n) < 0.15 then 'vegetarian' end,
    case when pg_temp.h('dg' || u.n) < 0.04 then 'vegan' end,
    case when pg_temp.h('dgf' || u.n) < 0.07 then 'gluten_free' end,
    case when pg_temp.h('ddf' || u.n) < 0.05 then 'dairy_free' end,
    case when pg_temp.h('dnf' || u.n) < 0.03 then 'no_fish' end,
    case when pg_temp.h('dls' || u.n) < 0.02 then 'low_sodium' end
  ], null)::text[],
  case when pg_temp.h('dor' || u.n) < 0.10 then 'No mushrooms, please.' end,
  case when pg_temp.h('dnk' || u.n) < 0.08 then 'Please keep my plate separate from the nut desserts.' end,
  u.n = 1 or pg_temp.h('dep' || u.n) < 0.03,
  u.n = 1 or pg_temp.h('dsh' || u.n) < 0.92,
  u.created_at + interval '1 day'
from perf_users u
where u.n = 1 or pg_temp.h('diet' || u.n) < 0.40
order by u.n;

insert into public.user_allergens (user_id, allergen_code, severity, notes, created_at)
select u.id, a.code,
  case when u.n = 1 and a.code = 'peanuts' then 'severe'
       when pg_temp.h('sev' || u.n || a.code) < 0.25 then 'intolerance'
       when pg_temp.h('sev' || u.n || a.code) < 0.85 then 'allergy'
       else 'severe' end::public.allergen_severity,
  null, u.created_at + interval '1 day'
from perf_users u
join public.dietary_profiles dp on dp.user_id = u.id
join (values ('peanuts', 0.30), ('tree_nuts', 0.28), ('milk', 0.22), ('gluten', 0.15), ('egg', 0.10),
             ('sesame_seed', 0.10), ('wheat', 0.06), ('soy', 0.06), ('fish', 0.05), ('shellfish', 0.08),
             ('mustard', 0.02), ('sulfites', 0.02), ('sesame_oil', 0.03)) a(code, p) on true
where (u.n = 1 and a.code in ('peanuts', 'sesame_seed'))
   or (u.n <> 1 and pg_temp.h('hasal' || u.n) < 0.55 and pg_temp.h('ua' || u.n || a.code) < a.p)
order by u.n, a.code;

-- -----------------------------------------------------------------------------
-- Ingredient and dish library
-- -----------------------------------------------------------------------------
create temp table perf_ing_base (b int, name text, allergens text[]);
insert into perf_ing_base
select row_number() over (), name, allergens
from (values
  ('All-purpose flour', '{wheat,gluten}'::text[]), ('Eggs', '{egg}'), ('Sesame seeds', '{sesame_seed}'), ('Sugar', '{}'),
  ('Canola oil', '{}'), ('Yeast', '{}'), ('Salt', '{}'), ('Honey', '{}'), ('Chicken', '{}'), ('Carrots', '{}'),
  ('Celery', '{}'), ('Onion', '{}'), ('Garlic', '{}'), ('Dill', '{}'), ('Parsley', '{}'), ('Matzo meal', '{wheat,gluten}'),
  ('Tahini', '{sesame_seed}'), ('Chickpeas', '{}'), ('Lemon juice', '{}'), ('Olive oil', '{}'), ('Sesame oil', '{sesame_oil}'),
  ('Soy sauce', '{soy,wheat,gluten}'), ('Rice vinegar', '{}'), ('Cabbage', '{}'), ('Potatoes', '{}'), ('Cucumbers', '{}'),
  ('Tomatoes', '{}'), ('Breadcrumbs', '{wheat,gluten}'), ('Dijon mustard', '{mustard}'), ('Chocolate chips', '{soy}'),
  ('Margarine', '{soy}'), ('Walnuts', '{tree_nuts}'), ('White rice', '{}'), ('Zucchini', '{}'), ('Bell peppers', '{}'),
  ('Apples', '{}'), ('Cinnamon', '{}'), ('Rolled oats', '{gluten}'), ('Egg noodles', '{wheat,gluten,egg}'), ('Paprika', '{}'),
  ('Grape juice', '{sulfites}'), ('Almonds', '{tree_nuts}'), ('Peanut butter', '{peanuts}'), ('Salmon', '{fish}'),
  ('Tuna', '{fish}'), ('Mayonnaise', '{egg}'), ('Tofu', '{soy}'), ('Pasta', '{wheat,gluten}'), ('Couscous', '{wheat,gluten}'),
  ('Butter', '{milk}'), ('Milk', '{milk}'), ('Cream cheese', '{milk}'), ('Cheddar', '{milk}'), ('Beef brisket', '{}'),
  ('Ground beef', '{}'), ('Turkey', '{}'), ('Lentils', '{}'), ('Quinoa', '{}'), ('Spinach', '{}'), ('Mushrooms', '{}'),
  ('Eggplant', '{}'), ('Sweet potatoes', '{}'), ('Green beans', '{}'), ('Broccoli', '{}'), ('Cauliflower', '{}'),
  ('Corn', '{}'), ('Black pepper', '{}'), ('Cumin', '{}'), ('Basil', '{}'), ('Oregano', '{}'), ('Ginger', '{}'),
  ('Brown sugar', '{}'), ('Maple syrup', '{}'), ('Vanilla', '{}'), ('Cocoa powder', '{}'), ('Pecans', '{tree_nuts}'),
  ('Pistachios', '{tree_nuts}'), ('Red wine', '{sulfites}'), ('Barley', '{gluten}'), ('Rye flour', '{gluten}')
) v(name, allergens);

create temp table perf_ing as
select b.b * 10 + q.k as k, b.name || ', ' || q.qual as name, b.allergens
from perf_ing_base b
cross join (values (0, 'whole'), (1, 'fresh'), (2, 'frozen'), (3, 'organic'), (4, 'chopped'), (5, 'dried'), (6, 'canned'),
                   (7, 'roasted'), (8, 'ground'), (9, 'sliced')) q(k, qual);

insert into public.ingredients (name, notes, created_by, created_at, updated_at)
select i.name, case when pg_temp.h('in' || i.k) < 0.05 then 'Check the label for facility warnings.' end,
  (select kitchen[1 + floor(pg_temp.h('icb' || i.k) * array_length(kitchen, 1))::int] from perf_staff),
  (select first_day::timestamptz from perf_cfg), (select first_day::timestamptz from perf_cfg)
from perf_ing i
order by i.k;

insert into public.ingredient_allergens (ingredient_id, allergen_code)
select ing.id, a.code
from perf_ing i
join public.ingredients ing on ing.name = i.name
cross join lateral unnest(i.allergens) a(code)
order by i.k, a.code;

create temp table perf_dish_base (b int, name text, category text, kosher text, tags text[]);
insert into perf_dish_base
select row_number() over (), * from (values
  ('Challah', 'bread', 'pareve', '{vegetarian}'::text[]), ('Chicken soup', 'soup', 'meat', '{}'), ('Matzo ball soup', 'soup', 'meat', '{}'),
  ('Roast chicken', 'main', 'meat', '{}'), ('Brisket', 'main', 'meat', '{}'), ('Baked salmon', 'main', 'pareve', '{}'),
  ('Schnitzel', 'main', 'meat', '{}'), ('Hummus', 'appetizer', 'pareve', '{vegetarian,vegan}'), ('Babaganoush', 'appetizer', 'pareve', '{vegetarian,vegan}'),
  ('Israeli salad', 'salad', 'pareve', '{vegetarian,vegan}'), ('Cabbage slaw', 'salad', 'pareve', '{vegetarian,vegan}'), ('Potato kugel', 'side', 'pareve', '{vegetarian}'),
  ('Rice pilaf', 'side', 'pareve', '{vegetarian,vegan}'), ('Roasted vegetables', 'side', 'pareve', '{vegetarian,vegan}'), ('Chocolate babka', 'dessert', 'pareve', '{vegetarian}'),
  ('Brownies', 'dessert', 'pareve', '{vegetarian}'), ('Apple crisp', 'dessert', 'pareve', '{vegetarian}'), ('Grape juice', 'drink', 'pareve', '{vegetarian,vegan}'),
  ('Lemonade', 'drink', 'pareve', '{vegetarian,vegan}'), ('Couscous', 'side', 'pareve', '{vegetarian,vegan}'), ('Lentil soup', 'soup', 'pareve', '{vegetarian,vegan}'),
  ('Shakshuka', 'main', 'pareve', '{vegetarian}'), ('Falafel', 'main', 'pareve', '{vegetarian,vegan}'), ('Stuffed peppers', 'main', 'meat', '{}'),
  ('Meatballs', 'main', 'meat', '{}'), ('Green salad', 'salad', 'pareve', '{vegetarian,vegan}'), ('Pasta salad', 'salad', 'pareve', '{vegetarian}'),
  ('Potato salad', 'salad', 'pareve', '{vegetarian}'), ('Sweet potato fries', 'side', 'pareve', '{vegetarian,vegan}'), ('Cholent', 'main', 'meat', '{}'),
  ('Gefilte fish', 'appetizer', 'pareve', '{}'), ('Deli roll', 'main', 'meat', '{}'), ('Sufganiyot', 'dessert', 'pareve', '{vegetarian}'),
  ('Hamantaschen', 'dessert', 'pareve', '{vegetarian}'), ('Rugelach', 'dessert', 'dairy', '{vegetarian}'), ('Fruit platter', 'dessert', 'pareve', '{vegetarian,vegan}'),
  ('Quinoa salad', 'salad', 'pareve', '{vegetarian,vegan}'), ('Vegetable soup', 'soup', 'pareve', '{vegetarian,vegan}'), ('Teriyaki chicken', 'main', 'meat', '{}'),
  ('Vegetable lo mein', 'main', 'pareve', '{vegetarian}')
) v;

create temp table perf_dish as
select b.b * 10 + s.k as k,
  b.name || ' (' || s.style || ')' as name,
  b.category, b.kosher, b.tags,
  case when pg_temp.h('dst' || b.b || s.k) < 0.10 then 'archived'
       when pg_temp.h('dst' || b.b || s.k) < 0.18 then 'proposed' else 'active' end as status
from perf_dish_base b
cross join (values (0, 'house'), (1, 'classic'), (2, 'spicy'), (3, 'herb'), (4, 'honey'), (5, 'garlic'), (6, 'lemon'),
                   (7, 'smoky'), (8, 'family-style'), (9, 'mini')) s(k, style);

insert into public.dishes (name, description, category, kosher_type, diet_tags, status, created_by, created_at, updated_at)
select d.name, 'Synthetic dish for performance measurement.', d.category, d.kosher, d.tags, d.status,
  (select kitchen[1 + floor(pg_temp.h('dcb' || d.k) * array_length(kitchen, 1))::int] from perf_staff),
  (select first_day::timestamptz from perf_cfg), (select first_day::timestamptz from perf_cfg)
from perf_dish d
order by d.k;

create temp table perf_dish_ids as
select d.k, x.id, d.status from perf_dish d join public.dishes x on x.name = d.name;

insert into public.dish_ingredients (dish_id, ingredient_id, quantity_note, is_optional, sort_order)
select d.id, pick.id, null, pg_temp.h('opt' || d.k || pick.k) < 0.08, pick.rk
from perf_dish_ids d
cross join lateral (
  select ing.id, i.k, row_number() over (order by pg_temp.h('di' || d.k || ':' || i.k)) as rk
  from perf_ing i join public.ingredients ing on ing.name = i.name
  order by pg_temp.h('di' || d.k || ':' || i.k)
  limit 5 + floor(pg_temp.h('dn' || d.k) * 6)::int
) pick
order by d.k, pick.rk;

-- -----------------------------------------------------------------------------
-- Menus (versioned) for meal events; published snapshots as publish_menu() makes
-- -----------------------------------------------------------------------------
select set_config('app.publishing_menu', 'on', true);

create temp table perf_menu_ev as
select e.*,
  case when e.starts_at <= now() + interval '14 days' then 'published' else 'draft' end as menu_kind,
  pg_temp.h('mv2' || e.slug) < 0.3 as two_versions
from perf_ev e
where e.has_meal and e.status in ('published', 'cancelled')
  and (e.category in ('shabbat_dinner', 'holiday') or pg_temp.h('menu' || e.slug) < 0.3)
  and e.starts_at <= now() + interval '28 days';

insert into public.menu_versions (event_id, version, status, title, change_summary, kitchen_notes, prep_confirmed_at,
  prep_confirmed_by, published_at, published_by, created_by, created_at, updated_at)
select e.id, v.version, v.status::public.menu_status, 'Dinner Menu',
  case when v.status = 'draft' then null when v.version = 1 then 'First published menu.' else 'Swapped one side dish.' end,
  'All food is prepared in one shared kitchen that also handles sesame, tree nuts, eggs, wheat and soy.',
  case when v.status <> 'draft' then v.at end,
  case when v.status <> 'draft' then (select kitchen[1 + floor(pg_temp.h('pc' || e.slug || v.version) * array_length(kitchen, 1))::int] from perf_staff) end,
  case when v.status <> 'draft' then v.at end,
  case when v.status <> 'draft' then (select kitchen[1 + floor(pg_temp.h('pb' || e.slug || v.version) * array_length(kitchen, 1))::int] from perf_staff) end,
  (select kitchen[1 + floor(pg_temp.h('mcb' || e.slug || v.version) * array_length(kitchen, 1))::int] from perf_staff),
  least(now(), v.at - interval '1 day'), least(now(), v.at)
from perf_menu_ev e
cross join lateral (values
  (1, case when e.menu_kind = 'draft' then 'draft' when e.two_versions then 'archived' else 'published' end,
      least(now() - interval '1 hour', e.starts_at - interval '5 days')),
  (2, case when e.menu_kind = 'published' and e.two_versions then 'published' end,
      least(now() - interval '30 minutes', e.starts_at - interval '2 days'))
) v(version, status, at)
where v.status is not null
order by e.starts_at, v.version;

insert into public.menu_items (menu_version_id, dish_id, course, sort_order, preparation_notes, cross_contact_notes, dish_snapshot)
select mv.id, pick.id, pick.category, pick.rk::int,
  case when pg_temp.h('mp' || e.slug || mv.version || pick.k) < 0.1 then 'Topped with sesame seeds before baking.' end,
  case when pg_temp.h('mx' || e.slug || mv.version || pick.k) < 0.15 then 'Prepared on shared trays.' end,
  case when mv.status <> 'draft' then private.dish_snapshot(pick.id) end
from perf_menu_ev e
join public.menu_versions mv on mv.event_id = e.id
cross join lateral (
  select d.id, d.k, pd.category, row_number() over (order by pg_temp.h('mi' || e.slug || mv.version || ':' || d.k)) as rk
  from perf_dish_ids d join perf_dish pd on pd.k = d.k
  where d.status = 'active'
  order by pg_temp.h('mi' || e.slug || mv.version || ':' || d.k)
  limit 6 + floor(pg_temp.h('mk' || e.slug || mv.version) * 5)::int
) pick
order by e.starts_at, mv.version, pick.rk;

insert into public.menu_item_cross_contact (menu_item_id, allergen_code)
select mi.id, a.code
from public.menu_items mi
join public.menu_versions mv on mv.id = mi.menu_version_id
join perf_menu_ev e on e.id = mv.event_id
join perf_dish_ids d on d.id = mi.dish_id
join (values ('tree_nuts'), ('sesame_seed'), ('wheat'), ('milk'), ('egg'), ('soy')) a(code)
  on pg_temp.h('cc' || e.slug || mv.version || d.k || a.code) < 0.12
where mi.cross_contact_notes is not null
order by e.starts_at, mv.version, d.k, a.code;

-- Change notes for menus with a second version; a few are urgent (the trigger
-- notifies everyone who RSVP'd, as in the app).
insert into public.menu_updates (event_id, menu_version_id, message, is_urgent, created_by, created_at)
select e.id, mv.id, 'Menu updated to version 2: Swapped one side dish.', pg_temp.h('mu' || e.slug) < 0.08,
  (select kitchen[1 + floor(pg_temp.h('mub' || e.slug) * array_length(kitchen, 1))::int] from perf_staff),
  mv.published_at
from perf_menu_ev e
join public.menu_versions mv on mv.event_id = e.id and mv.version = 2
order by e.starts_at;

select set_config('app.publishing_menu', 'off', true);

-- -----------------------------------------------------------------------------
-- Votes (advisory) and suggestions
-- -----------------------------------------------------------------------------
create temp table perf_vote_ev as
select e.* from perf_ev e
where e.category = 'shabbat_dinner' and e.status = 'published'
  and ((e.starts_at > now() and e.starts_at <= now() + interval '15 days') or (e.starts_at <= now() and pg_temp.h('vote' || e.slug) < 0.15));

insert into public.event_menu_options (event_id, dish_id, note, created_by, created_at)
select e.id, pick.id, null,
  (select kitchen[1 + floor(pg_temp.h('ob' || e.slug) * array_length(kitchen, 1))::int] from perf_staff),
  least(now(), e.starts_at - interval '10 days')
from perf_vote_ev e
cross join lateral (
  select d.id, d.k from perf_dish_ids d where d.status in ('active', 'proposed')
  order by pg_temp.h('op' || e.slug || ':' || d.k) limit 4
) pick
order by e.starts_at, pick.k;

insert into public.dish_votes (user_id, dish_id, event_id, created_at)
select r.user_id, o.dish_id, e.id, least(now(), e.starts_at - interval '5 days')
from perf_vote_ev e
join public.rsvps r on r.event_id = e.id and r.status in ('going', 'waitlist', 'pending')
join public.event_menu_options o on o.event_id = e.id
join perf_users u on u.id = r.user_id
where pg_temp.h('vu' || e.slug || u.n) < 0.15 and pg_temp.h('vo' || e.slug || u.n || o.dish_id) < 0.5
order by e.starts_at, u.n, o.dish_id;

insert into public.dish_votes (user_id, dish_id, event_id, created_at)
select u.id, pick.id, null, u.created_at + interval '7 days'
from perf_users u
cross join lateral (
  select d.id, d.k from perf_dish_ids d where d.status in ('active', 'proposed')
  order by pg_temp.h('gvd' || u.n || ':' || d.k) limit 1 + floor(pg_temp.h('gvk' || u.n) * 4)::int
) pick
where pg_temp.h('gv' || u.n) < 0.15
order by u.n, pick.k;

insert into public.dish_suggestions (user_id, event_id, kind, title, details, status, staff_response, reviewed_by,
  reviewed_at, created_at, updated_at)
select u.id,
  case when pg_temp.h('se' || i) < 0.4 then (select e.id from perf_ev e where e.status = 'published' order by pg_temp.h('sep' || i || e.slug) limit 1) end,
  case when pg_temp.h('sk' || i) < 0.7 then 'dish' when pg_temp.h('sk' || i) < 0.8 then 'ingredient' else 'feedback' end,
  (array['Shakshuka for lunch', 'More vegan mains', 'Gluten-free challah', 'Sushi night', 'Spicy chicken wings',
         'Less salt in the soup', 'Mango salad', 'Date-night dessert bar'])[1 + floor(pg_temp.h('sti' || i) * 8)::int],
  case when pg_temp.h('sd' || i) < 0.5 then 'It would be great to try this at a Friday dinner.' end,
  st.status::public.suggestion_status,
  case when st.status in ('accepted', 'declined') and pg_temp.h('sr' || i) < 0.5 then 'Thanks for the idea.' end,
  case when st.status <> 'new' then (select kitchen[1 + floor(pg_temp.h('srb' || i) * array_length(kitchen, 1))::int] from perf_staff) end,
  case when st.status <> 'new' then t.at + interval '3 days' end,
  t.at, t.at
from generate_series(1, 350) i
cross join perf_cfg c
cross join lateral (
  select (c.first_day + floor(pg_temp.h('sat' || i) * (c.today - c.first_day))::int)::timestamptz + interval '15 hours' as at
) t
cross join lateral (
  select case
    when t.at > now() - interval '30 days' then case when pg_temp.h('ss' || i) < 0.7 then 'new' else 'under_review' end
    when pg_temp.h('ss' || i) < 0.05 then 'new'
    when pg_temp.h('ss' || i) < 0.10 then 'under_review'
    when pg_temp.h('ss' || i) < 0.45 then 'accepted'
    else 'declined'
  end as status
) st
cross join lateral (
  select uu.id from perf_users uu where uu.created_at <= t.at
  order by pg_temp.h('su' || i || ':' || uu.n) limit 1
) u
order by i;

-- -----------------------------------------------------------------------------
-- Volunteer shifts and sign-ups
-- -----------------------------------------------------------------------------
insert into public.volunteer_shifts (event_id, title, description, starts_at, ends_at, slots, status, created_by, created_at, updated_at)
select x.event_id, x.title, null, x.starts_at, x.ends_at, x.slots,
  case
    when x.event_status = 'cancelled' then 'closed'
    when x.starts_at < now() then case when pg_temp.h('vs' || x.key) < 0.8 then 'closed' else 'open' end
    when pg_temp.h('vs' || x.key) < 0.05 then 'draft'
    else 'open'
  end,
  (select organizers[1 + floor(pg_temp.h('vcb' || x.key) * array_length(organizers, 1))::int] from perf_staff),
  least(now(), x.starts_at - interval '10 days'), least(now(), x.starts_at - interval '10 days')
from (
  select e.id as event_id, e.status as event_status, e.slug || ':' || t.title as key, t.title,
    e.starts_at + t.off_start as starts_at, e.starts_at + t.off_end as ends_at, t.slots
  from perf_ev e
  join (values
    ('shabbat_dinner', 'Help cook Shabbat dinner', interval '-26 hours -30 minutes', interval '-23 hours -30 minutes', 4),
    ('shabbat_dinner', 'Set up tables', interval '-90 minutes', interval '-30 minutes', 3),
    ('shabbat_dinner', 'Clean up after dinner', interval '150 minutes', interval '210 minutes', 3),
    ('holiday', 'Set up for the holiday', interval '-2 hours', interval '-30 minutes', 5),
    ('holiday', 'Clean up after the holiday', interval '3 hours', interval '4 hours', 5),
    ('volunteer', 'Pack care packages', interval '0 minutes', interval '2 hours', 10)
  ) t(category, title, off_start, off_end, slots) on t.category = e.category::text
  where e.status <> 'draft'
  union all
  select null, null, 'standalone:' || i, 'Kitchen prep',
    (c.first_day + floor(pg_temp.h('vsd' || i) * (c.last_day - c.first_day))::int + time '15:00') at time zone 'America/New_York',
    (c.first_day + floor(pg_temp.h('vsd' || i) * (c.last_day - c.first_day))::int + time '17:00') at time zone 'America/New_York',
    4
  from generate_series(1, 40) i cross join perf_cfg c
) x
order by x.starts_at, x.key;

insert into public.volunteer_signups (shift_id, user_id, created_at)
select s.id, pick.id, least(now(), s.starts_at - interval '2 days')
from public.volunteer_shifts s
cross join lateral (
  select u.id from perf_users u
  where u.created_at <= s.starts_at - interval '3 days' and u.active_until >= s.starts_at
  order by -ln(greatest(pg_temp.h('vsu' || s.title || s.starts_at || ':' || u.n), 1e-15)) / u.weight
  limit floor(s.slots * case when s.starts_at < now() then 0.5 + 0.5 * pg_temp.h('vf' || s.title || s.starts_at)
                             else 0.4 * pg_temp.h('vf' || s.title || s.starts_at) end)::int
) pick
where s.status <> 'draft' and s.starts_at < now() + interval '14 days'
  and s.created_by = any ((select organizers from perf_staff)::uuid[])
order by s.starts_at, s.title;

-- -----------------------------------------------------------------------------
-- Announcements and (planned) learning programs
-- -----------------------------------------------------------------------------
insert into public.announcements (title, body, audience, status, is_pinned, is_urgent, publish_at, expires_at, event_id,
  created_by, created_at, updated_at)
select
  (array['Shabbat dinner this Friday', 'Holiday schedule', 'Volunteers needed', 'New learning series',
         'Building closed for repairs', 'Thank you to our volunteers', 'Finals week study breaks'])[1 + floor(pg_temp.h('at' || i) * 7)::int],
  'Synthetic announcement for performance measurement.',
  case when pg_temp.h('aa' || i) < 0.2 then 'members' else 'public' end,
  case when pg_temp.h('ad' || i) < 0.04 then 'draft' else 'published' end,
  pg_temp.h('ap' || i) < 0.03,
  pg_temp.h('au' || i) < 0.05,
  t.at,
  case when pg_temp.h('ae' || i) < 0.7 then t.at + make_interval(days => 7 + floor(pg_temp.h('aed' || i) * 23)::int) end,
  case when pg_temp.h('aev' || i) < 0.4 then (select e.id from perf_ev e where e.status = 'published' order by pg_temp.h('aep' || i || e.slug) limit 1) end,
  (select organizers[1 + floor(pg_temp.h('acb' || i) * array_length(organizers, 1))::int] from perf_staff),
  t.at, t.at
from generate_series(1, 300) i
cross join perf_cfg c
cross join lateral (
  select (c.first_day + floor(pg_temp.h('aat' || i) * (c.today - c.first_day + 1))::int)::timestamptz + interval '14 hours' as at
) t
order by i;

insert into public.learning_programs (title, description, schedule_text, starts_on, ends_on, capacity, status, created_by, created_at, updated_at)
select 'Learning series ' || i, 'Synthetic program for performance measurement.', 'Tuesdays at 7 pm',
  c.first_day + i * 60, c.first_day + i * 60 + 56, 40,
  case when c.first_day + i * 60 + 56 < c.today then 'closed' else 'open' end,
  (select organizers[1 + floor(pg_temp.h('lcb' || i) * array_length(organizers, 1))::int] from perf_staff),
  (c.first_day + i * 60 - 14)::timestamptz, (c.first_day + i * 60 - 14)::timestamptz
from generate_series(1, 15) i cross join perf_cfg c
order by i;

insert into public.learning_signups (program_id, user_id, created_at)
select p.id, pick.id, p.starts_on::timestamptz - interval '3 days'
from public.learning_programs p
cross join lateral (
  select u.id from perf_users u
  where u.created_at <= p.starts_on::timestamptz and u.active_until >= p.starts_on::timestamptz
  order by -ln(greatest(pg_temp.h('ls' || p.title || ':' || u.n), 1e-15)) / u.weight
  limit 10 + floor(pg_temp.h('lsn' || p.title) * 30)::int
) pick
where p.title like 'Learning series %'
order by p.starts_on;

-- -----------------------------------------------------------------------------
-- Meal preferences for some RSVPs to meal events
-- -----------------------------------------------------------------------------
insert into public.event_meal_preferences (event_id, user_id, preference, guest_dietary_notes, updated_at)
select r.event_id, r.user_id, 'Vegetarian plate, please.',
  case when r.guest_count > 0 and pg_temp.h('mg' || r.id) < 0.5 then 'My guest is allergic to tree nuts.' end,
  r.created_at
from public.rsvps r
join perf_ev e on e.id = r.event_id
join perf_users u on u.id = r.user_id
where e.has_meal and r.status in ('going', 'pending', 'waitlist')
  and pg_temp.h('mp' || e.slug || u.n) < 0.06
order by e.starts_at, u.n;

-- -----------------------------------------------------------------------------
-- Notifications: RSVP updates, event changes and organizer invitations
-- -----------------------------------------------------------------------------
insert into public.notifications (user_id, event_id, kind, title, body, link, is_urgent, read_at, created_at)
select x.user_id, x.event_id, x.kind, x.title, x.body, x.link, x.urgent,
  case
    when x.at < now() - interval '21 days' then case when pg_temp.h('rd' || x.key) < 0.93 then x.at + make_interval(hours => 1 + floor(pg_temp.h('rh' || x.key) * 72)::int) end
    when pg_temp.h('rd' || x.key) < 0.4 then least(now(), x.at + interval '2 hours')
  end,
  x.at
from (
  -- One per RSVP decision, promotion or waitlist, and for changed or cancelled events.
  select r.user_id, e.id as event_id, k.kind, k.title, k.body, '/events/' || e.slug as link, k.urgent,
    least(now() - interval '1 minute', r.created_at + interval '1 day') as at, r.id::text || k.kind as key
  from public.rsvps r
  join perf_ev e on e.id = r.event_id
  cross join lateral (values
    ('rsvp_approved', 'Your RSVP is confirmed', 'An organizer confirmed your spot.', false,
       r.decided_by is not null and r.status = 'going'),
    ('rsvp_promoted', 'You''re off the waitlist!', 'A spot opened up. You''re confirmed.', false,
       r.status = 'going' and pg_temp.h('pr' || r.id) < 0.05),
    ('rsvp_waitlisted', 'You''re on the waitlist', 'This event is full right now.', false, r.status = 'waitlist'),
    ('guests_approved', 'Your guests are approved', 'Your guests are confirmed.', false,
       r.guest_status = 'approved' and e.approval_mode <> 'auto'),
    ('event_changed', 'Updated: event time', 'The time changed. See the event page for details.', true,
       r.status in ('going', 'waitlist', 'pending') and pg_temp.h('chg' || e.slug) < 0.3),
    ('event_cancelled', 'Cancelled: event', 'This event has been cancelled.', true,
       r.status in ('going', 'waitlist', 'pending') and e.status = 'cancelled')
  ) k(kind, title, body, urgent, applies)
  where k.applies
  union all
  -- Organizer invitations to people active at the time.
  select pick.id, e.id, 'invite', 'You''re invited: ' || e.slug, 'Tap to see the details and RSVP.', '/events/' || e.slug, false,
    least(now() - interval '1 minute', e.starts_at - interval '6 days'), e.slug || ':' || pick.n
  from perf_ev e
  cross join lateral (
    select u.id, u.n from perf_users u
    where u.created_at <= e.starts_at - interval '7 days' and u.active_until >= e.starts_at
    order by pg_temp.h('inv' || e.slug || ':' || u.n)
    limit case e.category when 'shabbat_dinner' then 330 when 'holiday' then 380 when 'learning' then 110
                          when 'social' then 200 when 'volunteer' then 90 else 140 end
  ) pick
  where e.status <> 'draft' and e.starts_at <= now() + interval '30 days'
) x
order by x.at, x.key;

-- -----------------------------------------------------------------------------
-- Audit log: give trigger-written rows their real dates, then fill to 60,000
-- -----------------------------------------------------------------------------
update public.audit_events a set created_at = p.created_at + interval '1 day'
from public.profiles p
where a.created_at = now() and a.entity_type = 'user_roles' and a.entity_id = p.id::text;
update public.audit_events a set created_at = e.created_at
from public.events e
where a.created_at = now() and a.entity_type = 'events' and a.entity_id = e.id::text;
update public.audit_events a set created_at = m.created_at
from public.menu_versions m
where a.created_at = now() and a.entity_type = 'menu_versions' and a.entity_id = m.id::text;
update public.audit_events a set created_at = n.created_at
from public.announcements n
where a.created_at = now() and a.entity_type = 'announcements' and a.entity_id = n.id::text;
update public.audit_events a set created_at = u.created_at
from public.menu_updates u
where a.created_at = now() and a.entity_type = 'menu_updates' and a.entity_id = u.id::text;
update public.notifications n set created_at = u.created_at, read_at = u.created_at + interval '3 hours'
from public.menu_updates u
where n.created_at = now() and n.kind = 'menu_urgent' and n.event_id = u.event_id;

create temp table perf_ev_ids as select array_agg(id order by starts_at, slug) as ids from perf_ev;

insert into public.audit_events (actor_id, actor_ref, action, entity_type, entity_id, details, created_at)
select x.actor, x.actor, x.action, x.entity_type,
  case x.entity_type
    when 'events' then (select ids[1 + floor(pg_temp.h('aei' || i) * array_length(ids, 1))::int] from perf_ev_ids)::text
    when 'profiles' then md5('deleted-' || i)::uuid::text
    when 'app_settings' then 'organization'
    when 'pending_role_grants' then 'perf-pending-' || i || '@example.com'
    else md5('entity-' || i)::uuid::text
  end,
  case x.entity_type
    when 'events' then jsonb_build_object('changed', jsonb_build_array('starts_at'))
    when 'rsvps' then jsonb_build_object('event_id', (select ids[1 + floor(pg_temp.h('aei' || i) * array_length(ids, 1))::int] from perf_ev_ids))
    else '{}'::jsonb
  end,
  x.at
from (
  select i,
    case when pg_temp.h('aan' || i) < 0.1 then null
         else (select organizers[1 + floor(pg_temp.h('aac' || i) * array_length(organizers, 1))::int] from perf_staff) end as actor,
    a.action, a.entity_type,
    (c.first_day + floor(power(pg_temp.h('aat' || i), 0.8) * (c.today - c.first_day))::int)::timestamptz
      + make_interval(mins => floor(pg_temp.h('aam' || i) * 1440)::int) as at
  from generate_series(1, greatest(0, 60000 - (select count(*) from public.audit_events)::int)) i
  cross join perf_cfg c
  cross join lateral (
    select * from (values
      (0.000, 'events.update', 'events'), (0.200, 'rsvp.approve', 'rsvps'), (0.350, 'rsvp.guests_approve', 'rsvps'),
      (0.400, 'rsvp.decline', 'rsvps'), (0.420, 'rsvp.staff_cancel', 'rsvps'), (0.450, 'dietary_report.viewed', 'events'),
      (0.550, 'menu_versions.update', 'menu_versions'), (0.650, 'menu.published', 'menu_versions'),
      (0.700, 'menu_update.posted', 'menu_updates'), (0.720, 'event.invites_sent', 'events'),
      (0.820, 'announcements.update', 'announcements'), (0.870, 'volunteer.signup_removed', 'volunteer_shifts'),
      (0.900, 'events.update', 'events'), (0.9960, 'account.deleted', 'profiles'),
      (0.9975, 'app_settings.update', 'app_settings'), (0.9985, 'pending_role_grants.insert', 'pending_role_grants')
    ) w(lo, action, entity_type)
    where w.lo <= pg_temp.h('aak' || i)
    order by w.lo desc
    limit 1
  ) a
) x
order by x.at, x.i;

-- -----------------------------------------------------------------------------
-- Settings and pending grants (written by the admin)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000004', 'role', 'authenticated')::text, true);

update public.app_settings set updated_by = 'aaaaaaaa-0000-4000-8000-000000000004' where key = 'organization';

insert into public.pending_role_grants (email, role, created_by)
select 'perf-pending-' || i || '@example.com', 'organizer', 'aaaaaaaa-0000-4000-8000-000000000004'
from generate_series(1, 5) i;

alter table public.dish_votes enable trigger dish_votes_rate_limit;
alter table public.dish_suggestions enable trigger dish_suggestions_rate_limit;
alter table public.volunteer_signups enable trigger volunteer_signups_capacity;
alter table public.learning_signups enable trigger learning_signups_capacity;

commit;

-- Fresh statistics and visibility map, as autovacuum would leave them.
vacuum (analyze);

select 'auth.users' as table_name, count(*) as row_count from auth.users
union all select 'events', count(*) from public.events
union all select 'rsvps', count(*) from public.rsvps
union all select 'notifications', count(*) from public.notifications
union all select 'audit_events', count(*) from public.audit_events
union all select 'dietary_profiles', count(*) from public.dietary_profiles
union all select 'user_allergens', count(*) from public.user_allergens
union all select 'event_meal_preferences', count(*) from public.event_meal_preferences
union all select 'ingredients', count(*) from public.ingredients
union all select 'dishes', count(*) from public.dishes
union all select 'dish_ingredients', count(*) from public.dish_ingredients
union all select 'menu_versions', count(*) from public.menu_versions
union all select 'menu_items', count(*) from public.menu_items
union all select 'dish_votes', count(*) from public.dish_votes
union all select 'dish_suggestions', count(*) from public.dish_suggestions
union all select 'volunteer_shifts', count(*) from public.volunteer_shifts
union all select 'volunteer_signups', count(*) from public.volunteer_signups
union all select 'announcements', count(*) from public.announcements;
