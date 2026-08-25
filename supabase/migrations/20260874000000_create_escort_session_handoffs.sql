-- 1. Create safety_escort_sessions table
CREATE TABLE IF NOT EXISTS safety_escort_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    active_officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'handoff_pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create escort_handoff_tokens table for secure officer transfer verification
CREATE TABLE IF NOT EXISTS escort_handoff_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES safety_escort_sessions(id) ON DELETE CASCADE,
    departing_officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relieving_officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    handoff_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE NOT NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for active tracking lookups
CREATE INDEX IF NOT EXISTS idx_escort_sessions_status ON safety_escort_sessions(channel_name, status);
CREATE INDEX IF NOT EXISTS idx_handoff_token ON escort_handoff_tokens(handoff_token);

-- Enable RLS
ALTER TABLE safety_escort_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escort_handoff_tokens ENABLE ROW LEVEL SECURITY;

-- Stored RPC procedure to execute broadcaster role transfer upon valid token redemption
CREATE OR REPLACE FUNCTION execute_escort_officer_handoff(
    p_handoff_token TEXT,
    p_relieving_officer_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    session_id UUID,
    channel_name TEXT,
    student_user_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_token_rec RECORD;
    v_session_rec RECORD;
BEGIN
    -- Fetch handoff token details
    SELECT * INTO v_token_rec
    FROM escort_handoff_tokens
    WHERE handoff_token = p_handoff_token AND is_claimed = FALSE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, 'Invalid or expired handoff token.'::TEXT;
        RETURN;
    END IF;

    IF NOW() > v_token_rec.expires_at THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, 'Handoff token has expired.'::TEXT;
        RETURN;
    END IF;

    IF v_token_rec.relieving_officer_id != p_relieving_officer_id THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, 'Unauthorized relieving officer.'::TEXT;
        RETURN;
    END IF;

    -- Mark token claimed
    UPDATE escort_handoff_tokens
    SET is_claimed = TRUE, claimed_at = NOW()
    WHERE id = v_token_rec.id;

    -- Transfer active broadcaster officer on the escort session
    UPDATE safety_escort_sessions
    SET active_officer_id = p_relieving_officer_id,
        status = 'in_progress',
        updated_at = NOW()
    WHERE id = v_token_rec.session_id
    RETURNING id, channel_name, student_user_id INTO v_session_rec;

    RETURN QUERY SELECT TRUE, v_session_rec.id, v_session_rec.channel_name, v_session_rec.student_user_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;