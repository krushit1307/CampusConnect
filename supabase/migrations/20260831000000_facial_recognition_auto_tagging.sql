-- Migration: 20260831000000_facial_recognition_auto_tagging.sql
-- Description: Automated Photo Auto-Tagging (Facial Recognition) schema, RLS policies, and storage setup.

-- 1. Create user_face_opt_in table
CREATE TABLE IF NOT EXISTS public.user_face_opt_in (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    opted_in BOOLEAN NOT NULL DEFAULT FALSE,
    face_photos TEXT[] DEFAULT '{}'::TEXT[],
    face_indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for opt-in lookup
CREATE INDEX IF NOT EXISTS idx_user_face_opt_in_status ON public.user_face_opt_in(opted_in) WHERE opted_in = TRUE;

-- Enable RLS on user_face_opt_in
ALTER TABLE public.user_face_opt_in ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own face opt-in status" ON public.user_face_opt_in;
CREATE POLICY "Users can view their own face opt-in status"
    ON public.user_face_opt_in FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own face opt-in status" ON public.user_face_opt_in;
CREATE POLICY "Users can insert their own face opt-in status"
    ON public.user_face_opt_in FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own face opt-in status" ON public.user_face_opt_in;
CREATE POLICY "Users can update their own face opt-in status"
    ON public.user_face_opt_in FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own face opt-in status" ON public.user_face_opt_in;
CREATE POLICY "Users can delete their own face opt-in status"
    ON public.user_face_opt_in FOR DELETE
    USING (auth.uid() = user_id);


-- 2. Create photo_tags table
CREATE TABLE IF NOT EXISTS public.photo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0.9500 CHECK (confidence >= 0.0000 AND confidence <= 1.0000),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT photo_tags_photo_user_key UNIQUE (photo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON public.photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_user_id ON public.photo_tags(user_id);

-- Enable RLS on photo_tags
ALTER TABLE public.photo_tags ENABLE ROW LEVEL SECURITY;

-- Requirement: RLS must ensure users can only see tags for themselves.
DROP POLICY IF EXISTS "Users can view only their own photo tags" ON public.photo_tags;
CREATE POLICY "Users can view only their own photo tags"
    ON public.photo_tags FOR SELECT
    USING (auth.uid() = user_id);

-- Requirement: Users can remove tags ("Remove Tag / This isn't me")
DROP POLICY IF EXISTS "Users can delete their own photo tags" ON public.photo_tags;
CREATE POLICY "Users can delete their own photo tags"
    ON public.photo_tags FOR DELETE
    USING (auth.uid() = user_id);

-- Allow insertion by authenticated users or service_role
DROP POLICY IF EXISTS "Authenticated users can insert photo tags" ON public.photo_tags;
CREATE POLICY "Authenticated users can insert photo tags"
    ON public.photo_tags FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');


-- 3. Storage Bucket for 'face-indexing'
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-indexing', 'face-indexing', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view their own face reference photos" ON storage.objects;
CREATE POLICY "Users can view their own face reference photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'face-indexing' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload their own face reference photos" ON storage.objects;
CREATE POLICY "Users can upload their own face reference photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'face-indexing' AND (storage.foldername(name))[1] = auth.uid()::text AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own face reference photos" ON storage.objects;
CREATE POLICY "Users can delete their own face reference photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'face-indexing' AND (storage.foldername(name))[1] = auth.uid()::text);
