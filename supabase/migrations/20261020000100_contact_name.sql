-- =============================================================================
-- The organization's contact name is no longer pre-filled. Admins add it in
-- Dashboard → Settings once the directors confirm it; until then pages say
-- "Contact the organizer". This clears the value the first migration used to
-- pre-fill (matched by its md5), and only if nobody has changed it since.
-- =============================================================================

update public.app_settings
set value = jsonb_set(value, '{contact_name}', '""')
where key = 'organization'
  and md5(value ->> 'contact_name') = '6024c4cdb8bea65822c1ddf814d08627';
