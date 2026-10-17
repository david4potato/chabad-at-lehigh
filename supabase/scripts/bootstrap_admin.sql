-- =============================================================================
-- Make yourself the first admin.
--
-- HOW: Supabase dashboard → SQL Editor → New query → paste this → replace the
-- email below with YOUR email → Run.
--
-- Works whether or not you have signed in yet:
--   * Not signed in yet → the admin role is applied automatically the first
--     time you sign in with that email.
--   * Already signed in → you become admin immediately (refresh the app).
-- After this, manage everyone else's roles in the app: Dashboard → People & roles.
-- =============================================================================

do $$
declare
  v_email text := lower(trim('YOUR-EMAIL@lehigh.edu'));  -- <<< CHANGE THIS
  v_user uuid;
begin
  if v_email like 'your-email@%' then
    raise exception 'Please replace YOUR-EMAIL@lehigh.edu with your real email address first.';
  end if;

  select id into v_user from public.profiles where email = v_email;

  if v_user is null then
    insert into public.pending_role_grants (email, role) values (v_email, 'admin')
    on conflict do nothing;
    raise notice 'Saved. % will become admin when they first sign in.', v_email;
  else
    insert into public.user_roles (user_id, role) values (v_user, 'admin')
    on conflict do nothing;
    raise notice 'Done. % is now an admin.', v_email;
  end if;
end;
$$;
