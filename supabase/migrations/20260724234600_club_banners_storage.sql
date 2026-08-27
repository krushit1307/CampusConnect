-- Create storage bucket for club banner images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-banners',
  'club-banners',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Allow public read access to banner images
create policy "Public read access for club banners"
on storage.objects for select
using (bucket_id = 'club-banners');

-- Allow club admins to upload a banner into their own club's folder
-- Path convention: <club_id>/banner-<timestamp>.<ext>
create policy "Club admins can upload their club banner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'club-banners'
  and exists (
    select 1
    from club_members
    where club_members.club_id::text = (storage.foldername(name))[1]
      and club_members.user_id = auth.uid()
      and public.is_club_admin(club_members.club_id, auth.uid())
  )
);

-- Allow club admins to overwrite/replace their club's banner
create policy "Club admins can update their club banner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'club-banners'
  and exists (
    select 1
    from club_members
    where club_members.club_id::text = (storage.foldername(name))[1]
      and club_members.user_id = auth.uid()
      and public.is_club_admin(club_members.club_id, auth.uid())
  )
);

-- Allow club admins to delete their club's banner
create policy "Club admins can delete their club banner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'club-banners'
  and exists (
    select 1
    from club_members
    where club_members.club_id::text = (storage.foldername(name))[1]
      and club_members.user_id = auth.uid()
      and public.is_club_admin(club_members.club_id, auth.uid())
  )
);
