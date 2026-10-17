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

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
