-- =============================================================================
-- App helpers: one round trip for the signed-in person's context.
-- =============================================================================

-- Unread notification counts are read on every page (the bell in the header).
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function public.get_my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'preferred_name', p.preferred_name,
    'affiliation', p.affiliation,
    'onboarded', p.onboarded_at is not null,
    'roles', coalesce((
      select jsonb_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = p.id
    ), '[]'::jsonb),
    'unread_notifications', (
      select count(*) from public.notifications n where n.user_id = p.id and n.read_at is null
    ),
    'has_dietary_info', (
      exists (select 1 from public.dietary_profiles d where d.user_id = p.id)
      or exists (select 1 from public.user_allergens ua where ua.user_id = p.id)
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.get_my_context() from public, anon;
grant execute on function public.get_my_context() to authenticated;
