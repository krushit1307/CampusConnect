-- Issue #3183: User Profile Banner Customization
--
-- 1. Add banner_url to profiles so each user can have a custom banner/header.
-- 2. Create a public "profile-banners" storage bucket with size + MIME limits.
-- 3. RLS policies: public read; authenticated users manage their own folder.

-- ── profiles.banner_url ───────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- ── Storage bucket ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-banners',
  'profile-banners',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Allow public read access to banner images
create policy "Public read access for profile banners"
on storage.objects for select
using (bucket_id = 'profile-banners');

-- Allow users to upload a banner into their own folder
-- Path convention: <user_id>/<uuid>.<ext>
create policy "Users can upload their profile banner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to overwrite/replace their own banner
create policy "Users can update their profile banner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own banner
create policy "Users can delete their profile banner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-banners'
  and (storage.foldername(name))[1] = auth.uid()::text
);
