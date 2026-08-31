-- =============================================================================
-- Migration: 20270924000000_dmca_takedown_pipeline.sql
-- Description: Issue #5060 - Audio Fingerprinting & Automated DMCA Takedown Pipeline
-- =============================================================================

BEGIN;

-- 1. Create dmca_takedown_logs table
CREATE TABLE IF NOT EXISTS public.dmca_takedown_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    match_confidence NUMERIC(5, 2) NOT NULL,
    acr_response JSONB,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.dmca_takedown_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Allow public select of DMCA logs"
ON public.dmca_takedown_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of DMCA logs"
ON public.dmca_takedown_logs FOR ALL TO authenticated USING (true);

-- 4. RPC to execute automated DMCA quarantine and notify student
CREATE OR REPLACE FUNCTION public.quarantine_media_dmca(
    p_photo_id UUID,
    p_song_title TEXT,
    p_artist_name TEXT,
    p_match_confidence NUMERIC,
    p_acr_response JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_event_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Fetch photo and verification
    SELECT user_id, event_id INTO v_student_id, v_event_id 
    FROM public.event_photos 
    WHERE id = p_photo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Event media not found.');
    END IF;

    -- 2. Update status to quarantined in public.event_photos
    UPDATE public.event_photos 
    SET status = 'quarantined'
    WHERE id = p_photo_id;

    -- 3. Insert record into dmca_takedown_logs
    INSERT INTO public.dmca_takedown_logs (
        photo_id, 
        student_id, 
        song_title, 
        artist_name, 
        match_confidence, 
        acr_response
    )
    VALUES (
        p_photo_id,
        v_student_id,
        p_song_title,
        p_artist_name,
        p_match_confidence,
        p_acr_response
    );

    -- 4. Insert notification/warning alert to the student
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
        v_student_id,
        'security',
        'Copyright Infringement (DMCA)',
        'Your upload was flagged for Copyright Infringement (DMCA). The media has been removed.',
        '/events/' || v_event_id::TEXT
    );

    SELECT jsonb_build_object(
        'success', TRUE,
        'status', 'QUARANTINED',
        'song_title', p_song_title,
        'artist_name', p_artist_name,
        'match_confidence', p_match_confidence
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
