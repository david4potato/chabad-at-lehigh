-- =============================================================================
-- Remove all DEMO content (events, menus, dishes, ingredients, announcements
-- marked as demo). Run this before real use if you loaded supabase/seed.sql.
-- Admins can do the same from the app: Dashboard → Overview → Getting started
-- → Remove demo content.
--
-- HOW: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Real (non-demo) content is not touched.
-- =============================================================================

select private.remove_demo_data();
