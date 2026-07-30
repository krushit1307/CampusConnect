-- Duplicate migration removed (saved_events table is already created by upstream main migrations)
-- Keeping the profile backfill script from upstream

-- Backfill any missing profiles for existing authenticated users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
