-- =============================================================================
-- Migration: 20261231000031_peer_support_matcher.sql
-- Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
-- Description: Schema for certified peer listener roles, ephemeral session tokens,
--              zero-knowledge session metrics, and matchmaking stored procedures.
-- =============================================================================

-- 1. Peer Listener Certifications Table
CREATE TABLE IF NOT EXISTS public.peer_listener_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anonymous_alias TEXT NOT NULL UNIQUE,
    major_or_focus TEXT NOT NULL,
    certification_level TEXT NOT NULL DEFAULT 'CERTIFIED_PEER_SUPPORTER' CHECK (
        certification_level IN (
            'CERTIFIED_PEER_SUPPORTER',
            'ACTIVE_LISTENING_TIER_2',
            'CRISIS_TRAINED_SENIOR'
        )
    ),
    total_sessions_completed INT NOT NULL DEFAULT 0,
    is_available_online BOOLEAN NOT NULL DEFAULT true,
    training_completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ephemeral Support Sessions Metadata (NO PLAINTEXT MESSAGES STORED)
CREATE TABLE IF NOT EXISTS public.ephemeral_support_sessions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    mood_rating INT NOT NULL CHECK (mood_rating BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'in_queue' CHECK (
        status IN (
            'in_queue',
            'matched_active',
            'escalated_crisis',
            'closed_keys_destroyed'
        )
    ),
    matched_listener_id UUID REFERENCES public.peer_listener_certifications(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_peer_listener_status ON public.peer_listener_certifications(is_available_online);
CREATE INDEX IF NOT EXISTS idx_ephemeral_sessions_status ON public.ephemeral_support_sessions(status);

-- 3. Row Level Security
ALTER TABLE public.peer_listener_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ephemeral_support_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view online peer listeners aliases"
    ON public.peer_listener_certifications
    FOR SELECT
    USING (true);

CREATE POLICY "Listeners can update their own availability"
    ON public.peer_listener_certifications
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Anonymous sessions access"
    ON public.ephemeral_support_sessions
    FOR ALL
    USING (true);

-- 4. Stored Procedure: Match Ephemeral Peer Support
CREATE OR REPLACE FUNCTION public.request_peer_support_rpc(
    p_session_id TEXT,
    p_topic TEXT,
    p_mood_rating INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listener_id UUID;
    v_listener_alias TEXT;
BEGIN
    -- Find first available certified listener
    SELECT id, anonymous_alias INTO v_listener_id, v_listener_alias
    FROM public.peer_listener_certifications
    WHERE is_available_online = true
    LIMIT 1;

    INSERT INTO public.ephemeral_support_sessions (
        id, topic, mood_rating, status, matched_listener_id, created_at
    )
    VALUES (
        p_session_id, p_topic, p_mood_rating,
        CASE WHEN v_listener_id IS NOT NULL THEN 'matched_active' ELSE 'in_queue' END,
        v_listener_id, NOW()
    );

    RETURN jsonb_build_object(
        'session_id', p_session_id,
        'matched_listener_alias', v_listener_alias,
        'status', CASE WHEN v_listener_id IS NOT NULL THEN 'matched_active' ELSE 'in_queue' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_peer_support_rpc TO authenticated, anon;
