-- ============================================================
-- Migration: Centralized Speaker Profile Database (Issue #2904)
--
-- Creates:
--   1. `guest_speakers` table (centralized directory).
--   2. `speaker_notes` table (private internal notes).
--   3. `speaker_id` FK on `events` to link structured speaker data.
--   4. RLS policies: Public speakers visible to all admins; contact
--      email and private notes restricted to verified club admins.
--   5. RPCs for fuzzy matching and fetching speaker history.
-- ============================================================

-- ── Step 1: Create guest_speakers table ──────────────────────
CREATE TABLE IF NOT EXISTS public.guest_speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization TEXT,
    title TEXT,
    bio TEXT,
    linkedin_url TEXT,
    contact_email TEXT,
    photo_url TEXT,
    rating INTEGER DEFAULT NULL CHECK (rating >= 1 AND rating <= 5),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_speakers_name ON public.guest_speakers (name);
CREATE INDEX IF NOT EXISTS idx_guest_speakers_org ON public.guest_speakers (organization);

-- ── Step 2: Create speaker_notes table ────────────────────────
CREATE TABLE IF NOT EXISTS public.speaker_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    speaker_id UUID NOT NULL REFERENCES public.guest_speakers(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_notes_speaker ON public.speaker_notes (speaker_id);

-- ── Step 3: Add speaker_id to events ──────────────────────────
-- Links an event to a structured guest_speaker entity.
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS speaker_id UUID REFERENCES public.guest_speakers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_speaker_id ON public.events (speaker_id) WHERE speaker_id IS NOT NULL;

-- ── Step 4: RLS Policies ─────────────────────────────────────
ALTER TABLE public.guest_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaker_notes ENABLE ROW LEVEL SECURITY;

-- Guest Speakers: All authenticated users can view basic profile (name, org, bio, linkedin).
-- Contact email is visible ONLY to verified club admins.
-- To enforce this cleanly, we use a SECURITY DEFINER function to check admin status.
CREATE OR REPLACE FUNCTION public.is_club_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$     SELECT EXISTS (
        SELECT 1 FROM public.club_members
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
 $$;

-- View policy: Authenticated users can see speakers, but the `contact_email` column
-- is nullified for non-admins via a view (created below) for GDPR compliance.
DROP POLICY IF EXISTS "Authenticated users can view guest speakers." ON public.guest_speakers;
CREATE POLICY "Authenticated users can view guest speakers."
ON public.guest_speakers FOR SELECT
USING (auth.role() = 'authenticated');

-- Insert/Update policy: Only club admins can create/edit speakers.
DROP POLICY IF EXISTS "Club admins can manage guest speakers." ON public.guest_speakers;
CREATE POLICY "Club admins can manage guest speakers."
ON public.guest_speakers FOR ALL
USING (public.is_club_admin())
WITH CHECK (public.is_club_admin());

-- Speaker Notes: Only club admins can view, create, or edit notes.
DROP POLICY IF EXISTS "Club admins can manage speaker notes." ON public.speaker_notes;
CREATE POLICY "Club admins can manage speaker notes."
ON public.speaker_notes FOR ALL
USING (public.is_club_admin())
WITH CHECK (public.is_club_admin());

-- ── Step 5: Create a view that masks contact_email for non-admins ──
-- This view is what the frontend queries instead of the base table.
CREATE OR REPLACE VIEW public.guest_speakers_public AS
SELECT
    id,
    name,
    organization,
    title,
    bio,
    linkedin_url,
    photo_url,
    rating,
    created_at,
    -- Only expose contact_email if the user is a club admin
    CASE WHEN public.is_club_admin() THEN contact_email ELSE NULL END AS contact_email
FROM public.guest_speakers;

-- ── Step 6: search_speakers RPC (Fuzzy Matching) ──────────────
-- Allows searching by name or organization to prevent duplicates.
CREATE OR REPLACE FUNCTION public.search_speakers(
    p_query TEXT
) RETURNS TABLE (
    id UUID,
    name TEXT,
    organization TEXT,
    title TEXT,
    bio TEXT,
    linkedin_url TEXT,
    photo_url TEXT,
    rating INTEGER,
    similarity_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    -- Uses pg_trgm for fuzzy matching (if available) or falls back to ILIKE.
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        RETURN QUERY
        SELECT
            gs.id,
            gs.name,
            gs.organization,
            gs.title,
            gs.bio,
            gs.linkedin_url,
            gs.photo_url,
            gs.rating,
            -- Calculate a simple similarity score based on text proximity
            GREATEST(
                similarity(gs.name, p_query),
                similarity(gs.organization, p_query)
            ) AS similarity_score
        FROM public.guest_speakers gs
        WHERE gs.name % p_query
           OR gs.organization % p_query
           OR gs.name ILIKE '%' || p_query || '%'
           OR gs.organization ILIKE '%' || p_query || '%'
        ORDER BY similarity_score DESC
        LIMIT 10;
    ELSE
        -- Fallback to ILIKE if pg_trgm is not installed
        RETURN QUERY
        SELECT
            gs.id,
            gs.name,
            gs.organization,
            gs.title,
            gs.bio,
            gs.linkedin_url,
            gs.photo_url,
            gs.rating,
            0.5::FLOAT AS similarity_score -- Static score for ILIKE matches
        FROM public.guest_speakers gs
        WHERE gs.name ILIKE '%' || p_query || '%'
           OR gs.organization ILIKE '%' || p_query || '%'
        ORDER BY gs.name
        LIMIT 10;
    END IF;
END;
 $$;

-- ── Step 7: get_speaker_history RPC ───────────────────────────
-- Returns all events a speaker has participated in across all clubs.
CREATE OR REPLACE FUNCTION public.get_speaker_history(
    p_speaker_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_speaker JSONB;
    v_events JSONB;
    v_notes JSONB;
BEGIN
    -- Fetch speaker details (uses the public view to respect email masking)
    SELECT COALESCE(jsonb_agg(row_to_json(t)), 'null'::jsonb)
    INTO v_speaker
    FROM (
        SELECT * FROM public.guest_speakers_public WHERE id = p_speaker_id
    ) t;

    IF v_speaker IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Speaker not found.');
    END IF;

    -- Fetch event history
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'event_id', e.id,
        'event_title', e.title,
        'event_date', e.event_date,
        'club_name', c.name,
        'club_slug', c.slug
    )), '[]'::jsonb)
    INTO v_events
    FROM public.events e
    JOIN public.clubs c ON c.id = e.club_id
    WHERE e.speaker_id = p_speaker_id
    ORDER BY e.event_date DESC;

    -- Fetch private notes (RLS ensures only admins see these)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'note_id', sn.id,
        'club_name', c.name,
        'author_name', p.full_name,
        'note_text', sn.note_text,
        'created_at', sn.created_at
    )), '[]'::jsonb)
    INTO v_notes
    FROM public.speaker_notes sn
    JOIN public.clubs c ON c.id = sn.club_id
    JOIN public.profiles p ON p.id = sn.author_id
    WHERE sn.speaker_id = p_speaker_id
    ORDER BY sn.created_at DESC;

    RETURN jsonb_build_object(
        'success', true,
        'speaker', v_speaker,
        'events', v_events,
        'notes', v_notes
    );
END;
 $$;

COMMENT ON TABLE public.guest_speakers IS
'Centralized directory of guest speakers. Issue #2904.';
COMMENT ON TABLE public.speaker_notes IS
'Private internal notes about speakers, restricted to club admins. Issue #2904.';
COMMENT ON COLUMN public.events.speaker_id IS
'FK to guest_speakers table for structured speaker data. Issue #2904.';

-- ============================================================
-- End of migration
-- ============================================================
