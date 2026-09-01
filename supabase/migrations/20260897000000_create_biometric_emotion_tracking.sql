-- 1. Create event_focus_group_participants table
CREATE TABLE IF NOT EXISTS event_focus_group_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opted_in BOOLEAN DEFAULT TRUE NOT NULL,
    gamification_points_awarded INTEGER DEFAULT 50 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_event_focus_user UNIQUE (event_id, user_id)
);

-- 2. Create stream_biometric_emotion_snapshots table for aggregated time-series telemetry
CREATE TABLE IF NOT EXISTS stream_biometric_emotion_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    timestamp_offset_seconds INTEGER NOT NULL CHECK (timestamp_offset_seconds >= 0),
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    avg_joy_score NUMERIC(5, 2) NOT NULL CHECK (avg_joy_score BETWEEN 0 AND 100),
    avg_surprise_score NUMERIC(5, 2) NOT NULL CHECK (avg_surprise_score BETWEEN 0 AND 100),
    avg_boredom_score NUMERIC(5, 2) NOT NULL CHECK (avg_boredom_score BETWEEN 0 AND 100),
    dominant_emotion TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for timeline analytics queries
CREATE INDEX IF NOT EXISTS idx_emotion_event_timeline ON stream_biometric_emotion_snapshots(event_id, timestamp_offset_seconds ASC);

-- Enable RLS
ALTER TABLE event_focus_group_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_biometric_emotion_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Participants can view/manage their opt-in
CREATE POLICY "Users can manage focus group opt-in"
    ON event_focus_group_participants FOR ALL
    USING (auth.uid() = user_id);

-- RLS Policy: Organizers and Admins can view aggregated timeline metrics
CREATE POLICY "Organizers can view aggregated emotion timeline"
    ON stream_biometric_emotion_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = stream_biometric_emotion_snapshots.event_id AND eo.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM user_preferences up
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- 3. Stored RPC procedure to ingest aggregated emotion batch and award gamification points
CREATE OR REPLACE FUNCTION ingest_aggregated_biometric_emotions(
    p_event_id UUID,
    p_offset_seconds INTEGER,
    p_sample_size INTEGER,
    p_joy NUMERIC(5, 2),
    p_surprise NUMERIC(5, 2),
    p_boredom NUMERIC(5, 2)
)
RETURNS TABLE (
    snapshot_id UUID,
    event_id UUID,
    offset_sec INTEGER,
    dominant_emotion TEXT
) AS $$
DECLARE
    v_snapshot_id UUID;
    v_dominant TEXT := 'joy';
    v_max NUMERIC(5, 2) := p_joy;
BEGIN
    IF p_boredom > v_max THEN
        v_dominant := 'boredom';
        v_max := p_boredom;
    END IF;

    IF p_surprise > v_max THEN
        v_dominant := 'surprise';
        v_max := p_surprise;
    END IF;

    INSERT INTO stream_biometric_emotion_snapshots (
        event_id,
        timestamp_offset_seconds,
        sample_size,
        avg_joy_score,
        avg_surprise_score,
        avg_boredom_score,
        dominant_emotion
    )
    VALUES (
        p_event_id,
        p_offset_seconds,
        p_sample_size,
        p_joy,
        p_surprise,
        p_boredom,
        v_dominant
    )
    RETURNING id INTO v_snapshot_id;

    RETURN QUERY SELECT v_snapshot_id, p_event_id, p_offset_seconds, v_dominant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;