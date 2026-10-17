-- =============================================================================
-- Announcements, volunteer shifts, learning programs, gallery storage.
-- (Volunteer, learning and gallery screens are planned features; the tables
-- and security rules exist now so they can be built without schema churn.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Announcements
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  body text check (char_length(body) <= 4000),
  audience text not null default 'public' check (audience in ('public', 'members')),
  status text not null default 'published' check (status in ('draft', 'published')),
  is_pinned boolean not null default false,
  is_urgent boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  event_id uuid references public.events (id) on delete set null,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > publish_at)
);
create index announcements_publish_idx on public.announcements (status, publish_at desc);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();
create trigger announcements_audit
  after insert or update or delete on public.announcements
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- Volunteer shifts (planned feature)
-- -----------------------------------------------------------------------------
create table public.volunteer_shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  slots integer not null default 1 check (slots between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create trigger volunteer_shifts_set_updated_at
  before update on public.volunteer_shifts
  for each row execute function private.set_updated_at();

create table public.volunteer_signups (
  shift_id uuid not null references public.volunteer_shifts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Learning programs (planned feature)
-- -----------------------------------------------------------------------------
create table public.learning_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  description text check (char_length(description) <= 4000),
  schedule_text text check (char_length(schedule_text) <= 280),
  starts_on date,
  ends_on date,
  capacity integer check (capacity is null or capacity between 1 and 1000),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create trigger learning_programs_set_updated_at
  before update on public.learning_programs
  for each row execute function private.set_updated_at();

create table public.learning_signups (
  program_id uuid not null references public.learning_programs (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (program_id, user_id)
);

-- Capacity checks for signups (serialized per shift/program with a row lock).
create or replace function private.enforce_signup_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_status text;
  v_taken integer;
begin
  perform private.enforce_rate_limit('signup:' || coalesce(auth.uid()::text, 'anon'), 20, interval '10 minutes');
  if tg_table_name = 'volunteer_signups' then
    select slots, status into v_limit, v_status from public.volunteer_shifts where id = new.shift_id for update;
    select count(*) into v_taken from public.volunteer_signups where shift_id = new.shift_id;
  else
    select capacity, status into v_limit, v_status from public.learning_programs where id = new.program_id for update;
    select count(*) into v_taken from public.learning_signups where program_id = new.program_id;
  end if;
  if v_status is distinct from 'open' then
    raise exception 'signup_closed';
  end if;
  if v_limit is not null and v_taken >= v_limit then
    raise exception 'signup_full';
  end if;
  return new;
end;
$$;

create trigger volunteer_signups_capacity
  before insert on public.volunteer_signups
  for each row execute function private.enforce_signup_capacity();
create trigger learning_signups_capacity
  before insert on public.learning_signups
  for each row execute function private.enforce_signup_capacity();

-- -----------------------------------------------------------------------------
-- RLS + privileges
-- -----------------------------------------------------------------------------
alter table public.announcements enable row level security;
alter table public.volunteer_shifts enable row level security;
alter table public.volunteer_signups enable row level security;
alter table public.learning_programs enable row level security;
alter table public.learning_signups enable row level security;

revoke all on public.announcements, public.volunteer_shifts, public.volunteer_signups,
  public.learning_programs, public.learning_signups from anon, authenticated;

grant select on public.announcements, public.volunteer_shifts, public.learning_programs to anon, authenticated;
grant insert, update, delete on public.announcements, public.volunteer_shifts, public.learning_programs to authenticated;
grant select, insert, delete on public.volunteer_signups, public.learning_signups to authenticated;

create policy "announcements: read current" on public.announcements for select to anon, authenticated
  using (
    status = 'published'
    and publish_at <= now()
    and (expires_at is null or expires_at > now())
    and (audience = 'public' or (select auth.uid()) is not null)
  );
create policy "announcements: organizers read all" on public.announcements for select to authenticated
  using ((select public.can_manage_events()));
create policy "announcements: organizers insert" on public.announcements for insert to authenticated
  with check ((select public.can_manage_events()));
create policy "announcements: organizers update" on public.announcements for update to authenticated
  using ((select public.can_manage_events())) with check ((select public.can_manage_events()));
create policy "announcements: organizers delete" on public.announcements for delete to authenticated
  using ((select public.can_manage_events()));

create policy "volunteer_shifts: read open" on public.volunteer_shifts for select to anon, authenticated
  using (status <> 'draft');
create policy "volunteer_shifts: organizers read all" on public.volunteer_shifts for select to authenticated
  using ((select public.can_manage_events()));
create policy "volunteer_shifts: organizers insert" on public.volunteer_shifts for insert to authenticated
  with check ((select public.can_manage_events()));
create policy "volunteer_shifts: organizers update" on public.volunteer_shifts for update to authenticated
  using ((select public.can_manage_events())) with check ((select public.can_manage_events()));
create policy "volunteer_shifts: organizers delete" on public.volunteer_shifts for delete to authenticated
  using ((select public.can_manage_events()));

create policy "volunteer_signups: read own" on public.volunteer_signups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "volunteer_signups: organizers read" on public.volunteer_signups for select to authenticated
  using ((select public.can_manage_events()));
create policy "volunteer_signups: insert own" on public.volunteer_signups for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "volunteer_signups: delete own" on public.volunteer_signups for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "learning_programs: read open" on public.learning_programs for select to anon, authenticated
  using (status <> 'draft');
create policy "learning_programs: organizers read all" on public.learning_programs for select to authenticated
  using ((select public.can_manage_events()));
create policy "learning_programs: organizers insert" on public.learning_programs for insert to authenticated
  with check ((select public.can_manage_events()));
create policy "learning_programs: organizers update" on public.learning_programs for update to authenticated
  using ((select public.can_manage_events())) with check ((select public.can_manage_events()));
create policy "learning_programs: organizers delete" on public.learning_programs for delete to authenticated
  using ((select public.can_manage_events()));

create policy "learning_signups: read own" on public.learning_signups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "learning_signups: organizers read" on public.learning_signups for select to authenticated
  using ((select public.can_manage_events()));
create policy "learning_signups: insert own" on public.learning_signups for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "learning_signups: delete own" on public.learning_signups for delete to authenticated
  using (user_id = (select auth.uid()));

revoke execute on all functions in schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: public "gallery" bucket for event photos (planned feature).
-- Anyone can view; only organizers/admins can upload or delete.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "gallery: organizers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.can_manage_events()));
create policy "gallery: organizers update" on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and (select public.can_manage_events()))
  with check (bucket_id = 'gallery' and (select public.can_manage_events()));
create policy "gallery: organizers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.can_manage_events()));
