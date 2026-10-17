-- =============================================================================
-- Event invitations (in-app). Organizers enter email addresses; people who have
-- an account get an "You're invited" notification linking to the event.
-- Addresses without an account are returned so the organizer can send them the
-- event link themselves (no extra email service needed).
-- =============================================================================

create or replace function public.staff_invite_to_event(
  p_event_id uuid,
  p_emails text[],
  p_message text default null
)
returns table (email text, result text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_email text;
  v_user uuid;
  v_notified integer := 0;
begin
  if not public.can_manage_events() then
    raise exception 'forbidden';
  end if;
  if coalesce(array_length(p_emails, 1), 0) = 0 then
    raise exception 'no_emails';
  end if;
  if array_length(p_emails, 1) > 100 then
    raise exception 'too_many_emails';
  end if;
  if char_length(coalesce(v_message, '')) > 500 then
    raise exception 'text_too_long';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status <> 'published' then
    raise exception 'event_not_found';
  end if;

  perform private.enforce_rate_limit('invite:' || auth.uid()::text, 20, interval '1 hour');

  for v_email in
    select distinct lower(trim(e)) from unnest(p_emails) e where trim(coalesce(e, '')) <> ''
  loop
    email := v_email;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      result := 'invalid';
      return next;
      continue;
    end if;

    select id into v_user from public.profiles where profiles.email = v_email;
    if v_user is null then
      result := 'no_account';
    elsif exists (
      select 1 from public.rsvps r
      where r.event_id = p_event_id and r.user_id = v_user and r.status in ('going', 'pending', 'waitlist')
    ) then
      result := 'already_rsvped';
    elsif exists (
      select 1 from public.notifications n
      where n.user_id = v_user and n.event_id = p_event_id and n.kind = 'invite' and n.read_at is null
    ) then
      result := 'already_invited';
    else
      perform private.notify_user(
        v_user, p_event_id, 'invite',
        'You''re invited: ' || v_event.title,
        coalesce(v_message, 'Tap to see the details and RSVP.'),
        '/events/' || v_event.slug, false);
      v_notified := v_notified + 1;
      result := 'invited';
    end if;
    return next;
  end loop;

  perform private.log_audit('event.invites_sent', 'events', p_event_id::text,
    jsonb_build_object('invited', v_notified));
end;
$$;

revoke execute on function public.staff_invite_to_event(uuid, text[], text) from public, anon;
grant execute on function public.staff_invite_to_event(uuid, text[], text) to authenticated;
