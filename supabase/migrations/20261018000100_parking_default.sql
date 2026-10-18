-- Parking at the Chabad House, as the project owner described it (October 2026).
-- Fills the field only while it is empty, so anything an admin already saved in
-- Settings is kept. updated_by stays as it is: admins still confirm it in Settings.
update public.app_settings
set value = jsonb_set(value, '{parking}', to_jsonb('Usually up to about 15 parking spots at the Chabad House.'::text))
where key = 'organization'
  and coalesce(value ->> 'parking', '') = '';
