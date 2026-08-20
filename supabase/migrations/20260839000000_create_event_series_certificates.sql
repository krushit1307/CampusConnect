-- 1. Create event_series table defining multi-event completion tracks
CREATE TABLE IF NOT EXISTS event_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    required_event_ids UUID[] NOT NULL CHECK (array_length(required_event_ids, 1) > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create issued_certificates table tracking completed micro-credentials
CREATE TABLE IF NOT EXISTS issued_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    certificate_number TEXT UNIQUE NOT NULL, -- e.g. 'CERT-2026-BUS-8821'
    certificate_pdf_url TEXT,
    issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(series_id, user_id)
);

-- Index for lookup queries
CREATE INDEX IF NOT EXISTS idx_event_series_club ON event_series(club_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_user ON issued_certificates(user_id);

-- 3. Stored Procedure to evaluate series completion percentage
CREATE OR REPLACE FUNCTION check_series_completion(p_user_id UUID, p_series_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_required_ids UUID[];
    v_total_required INT;
    v_attended_count INT;
    v_is_complete BOOLEAN;
BEGIN
    -- Fetch required event IDs
    SELECT required_event_ids INTO v_required_ids
    FROM event_series
    WHERE id = p_series_id;

    IF v_required_ids IS NULL THEN
        RAISE EXCEPTION 'Event series not found.';
    END IF;

    v_total_required := array_length(v_required_ids, 1);

    -- Count attended events matching required list
    SELECT COUNT(DISTINCT event_id) INTO v_attended_count
    FROM rsvps
    WHERE user_id = p_user_id
      AND event_id = ANY(v_required_ids)
      AND status = 'attended';

    v_is_complete := (v_attended_count = v_total_required);

    RETURN jsonb_build_object(
        'userId', p_user_id,
        'seriesId', p_series_id,
        'totalRequired', v_total_required,
        'attendedCount', v_attended_count,
        'completionPercentage', ROUND((v_attended_count::numeric / v_total_required::numeric) * 100, 2),
        'isComplete', v_is_complete
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public event series" ON event_series FOR SELECT USING (true);
CREATE POLICY "Users can view their own certificates" ON issued_certificates FOR SELECT USING (auth.uid() = user_id);