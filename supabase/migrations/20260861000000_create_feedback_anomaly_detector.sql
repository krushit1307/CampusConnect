-- 1. Create event_feedback_anomalies table to log triggered alerts
CREATE TABLE IF NOT EXISTS event_feedback_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    batch_review_count INTEGER NOT NULL,
    batch_average_rating NUMERIC(3, 2) NOT NULL,
    window_start_time TIMESTAMPTZ NOT NULL,
    window_end_time TIMESTAMPTZ NOT NULL,
    alert_status TEXT DEFAULT 'triggered' NOT NULL CHECK (alert_status IN ('triggered', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for real-time lookups
CREATE INDEX IF NOT EXISTS idx_feedback_anomalies_event ON event_feedback_anomalies(event_id, alert_status);

-- Enable RLS
ALTER TABLE event_feedback_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizers and Student Union Admins can view anomaly records
CREATE POLICY "Organizers and Admins can view feedback anomalies"
    ON event_feedback_anomalies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = event_feedback_anomalies.event_id AND eo.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM user_preferences up
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- Stored RPC procedure for 15-minute rolling window statistical evaluation
CREATE OR REPLACE FUNCTION check_feedback_anomaly_rolling_window(
    p_event_id UUID
)
RETURNS TABLE (
    is_anomaly BOOLEAN,
    review_count INTEGER,
    avg_rating NUMERIC(3, 2),
    alert_message TEXT
) AS $$
DECLARE
    v_count INTEGER;
    v_avg NUMERIC(3, 2);
BEGIN
    -- Query reviews submitted in the last 15 minutes
    SELECT COUNT(*), COALESCE(AVG(rating), 0)
    INTO v_count, v_avg
    FROM event_surveys
    WHERE event_id = p_event_id
      AND created_at >= (NOW() - INTERVAL '15 minutes');

    IF v_count > 10 AND v_avg < 2.0 THEN
        -- Log anomaly event
        INSERT INTO event_feedback_anomalies (
            event_id, batch_review_count, batch_average_rating, window_start_time, window_end_time
        ) VALUES (
            p_event_id, v_count, v_avg, NOW() - INTERVAL '15 minutes', NOW()
        );

        RETURN QUERY SELECT 
            TRUE, 
            v_count, 
            v_avg, 
            'CRITICAL: The current event is receiving a massive spike in negative feedback. Please review the dashboard immediately.'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, v_count, v_avg, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;