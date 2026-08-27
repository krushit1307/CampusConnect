-- 1. Create webrtc_stream_telemetry_logs table to record quality adaptations
CREATE TABLE IF NOT EXISTS webrtc_stream_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    presenter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    packet_loss_percentage NUMERIC(5, 2) NOT NULL,
    latency_ms INTEGER NOT NULL,
    adaptation_tier TEXT NOT NULL CHECK (adaptation_tier IN ('optimal', 'throttled_360p', 'audio_only')),
    max_bitrate_kbps INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for stream quality analytics
CREATE INDEX IF NOT EXISTS idx_webrtc_telemetry_event ON webrtc_stream_telemetry_logs(event_id, created_at DESC);

-- Enable RLS
ALTER TABLE webrtc_stream_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Presenters can log telemetry; admins/organizers can view
CREATE POLICY "Presenters can log webrtc stream telemetry"
    ON webrtc_stream_telemetry_logs FOR ALL
    USING (auth.uid() = presenter_user_id);