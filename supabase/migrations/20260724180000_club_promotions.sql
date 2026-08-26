-- Add promo_video_url column to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS promo_video_url TEXT;

-- Create the club-promotions bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'club-promotions',
    'club-promotions',
    true,
    52428800, -- 50 MB
    ARRAY['video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can insert promo videos in their own club folders
DROP POLICY IF EXISTS "Club admins can upload promo videos" ON storage.objects;
CREATE POLICY "Club admins can upload promo videos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'club-promotions' AND
    (
        public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
        OR EXISTS (
            SELECT 1 FROM public.clubs
            WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
        )
    )
);

-- Policy: Authenticated users can update promo videos in their own club folders
DROP POLICY IF EXISTS "Club admins can update promo videos" ON storage.objects;
CREATE POLICY "Club admins can update promo videos" ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'club-promotions' AND
    (
        public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
        OR EXISTS (
            SELECT 1 FROM public.clubs
            WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
        )
    )
);

-- Policy: Authenticated users can delete promo videos from their own club folders
DROP POLICY IF EXISTS "Club admins can delete promo videos" ON storage.objects;
CREATE POLICY "Club admins can delete promo videos" ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'club-promotions' AND
    (
        public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
        OR EXISTS (
            SELECT 1 FROM public.clubs
            WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
        )
    )
);

-- Policy: Public read access to promotional videos
DROP POLICY IF EXISTS "Public access to promo videos" ON storage.objects;
CREATE POLICY "Public access to promo videos" ON storage.objects
FOR SELECT USING (
    bucket_id = 'club-promotions'
);
