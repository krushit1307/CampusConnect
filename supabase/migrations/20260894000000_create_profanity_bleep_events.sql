-- 1. Create stream_profanity_events table to log surgical audio bleep interventions
CREATE TABLE IF NOT EXISTS stream_profanity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    speaker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flagged_word TEXT NOT NULL,
    utterance_start_ms INTEGER NOT NULL,
    utterance_duration_ms INTEGER NOT NULL,
    bleep_frequency_hz INTEGER DEFAULT 1000 NOT NULL,
    bleep_applied BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for stream moderation audit lookups
CREATE INDEX IF NOT EXISTS idx_stream_profanity_lookup ON stream_profanity_events(stream_id, speaker_user_id);

-- Enable RLS
ALTER TABLE stream_profanity_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Broadcasters and Stream Admins can audit bleep events
CREATE POLICY "Broadcasters and Admins can view stream bleep events"
    ON stream_profanity_events FOR SELECT
    USING (
        auth.uid() = speaker_user_id OR 
        EXISTS (
            SELECT 1 FROM user_preferences up 
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- 2. Stored RPC procedure to record bleep event logs
CREATE OR REPLACE FUNCTION record_profanity_bleep_event(
    p_stream_id UUID,
    p_speaker_id UUID,
    p_word TEXT,
    p_start_ms INTEGER,
    p_duration_ms INTEGER
)
RETURNS TABLE (
    event_id UUID,
    stream_id UUID,
    flagged_word TEXT,
    status TEXT
) AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO stream_profanity_events (
        stream_id,
        speaker_user_id,
        flagged_word,
        utterance_start_ms,
        utterance_duration_ms
    )
    VALUES (
        p_stream_id,
        p_speaker_id,
        p_word,
        p_start_ms,
        p_duration_ms
    )
    RETURNING id INTO v_event_id;

    RETURN QUERY SELECT v_event_id, p_stream_id, p_word, 'BLEEP_APPLIED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;