-- =============================================================================
-- Self-service account deletion.
-- Deleting the auth user cascades to the profile, roles, RSVPs, dietary data,
-- votes, suggestions and notifications. Content the person created as staff
-- (events, dishes, menus) is kept, with the creator cleared.
-- =============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_events uuid[];
  v_event uuid;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  -- Keep at least one admin.
  if exists (select 1 from public.user_roles where user_id = v_uid and role = 'admin')
     and not exists (select 1 from public.user_roles where role = 'admin' and user_id <> v_uid) then
    raise exception 'last_admin';
  end if;

  -- Seats this person holds at upcoming events (freed below).
  select coalesce(array_agg(r.event_id), '{}') into v_events
  from public.rsvps r
  join public.events e on e.id = r.event_id
  where r.user_id = v_uid and r.status = 'going' and e.starts_at > now() - interval '3 hours';

  perform private.log_audit('account.deleted', 'profiles', v_uid::text, '{}');

  delete from auth.users where id = v_uid;

  -- Give freed seats to people on the waitlist.
  foreach v_event in array v_events loop
    perform 1 from public.events where id = v_event for update;
    perform private.promote_waitlist(v_event);
  end loop;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Published/archived menus stay immutable, but when a staff member's account is
-- deleted their name must be cleared from created_by / prep_confirmed_by /
-- published_by (ON DELETE SET NULL). Allow exactly that, nothing else.
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

  if old.status in ('published', 'archived') then
    if new.event_id = old.event_id
       and new.version = old.version
       and new.title is not distinct from old.title
       and new.change_summary is not distinct from old.change_summary
       and new.kitchen_notes is not distinct from old.kitchen_notes
       and new.prep_confirmed_at is not distinct from old.prep_confirmed_at
       and new.published_at is not distinct from old.published_at
       and (new.status = old.status or (old.status = 'published' and new.status = 'archived'))
       and (new.created_by is not distinct from old.created_by or new.created_by is null)
       and (new.prep_confirmed_by is not distinct from old.prep_confirmed_by or new.prep_confirmed_by is null)
       and (new.published_by is not distinct from old.published_by or new.published_by is null) then
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

revoke execute on all functions in schema private from public, anon, authenticated;
