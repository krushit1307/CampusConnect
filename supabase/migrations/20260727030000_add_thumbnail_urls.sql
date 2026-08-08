-- Adds thumbnail URL columns populated asynchronously by the
-- generate-thumbnail Edge Function (see supabase/functions/generate-thumbnail).
-- Issue: #1448 [REFACTOR] Move Heavy Image Processing to Supabase Edge Functions

alter table public.profiles
  add column if not exists avatar_thumbnail_url text;

alter table public.clubs
  add column if not exists logo_thumbnail_url text;