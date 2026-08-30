-- 1. Create speaker_requests table
CREATE TABLE IF NOT EXISTS speaker_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    alumni_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    honorarium_budget NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for alumni request lookups
CREATE INDEX IF NOT EXISTS idx_speaker_requests_alumni ON speaker_requests(alumni_id, status);

-- Enable RLS
ALTER TABLE speaker_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Club leadership can view and create speaker requests"
    ON speaker_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM club_memberships cm
            WHERE cm.club_id = speaker_requests.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('president', 'officer', 'admin')
        )
        OR auth.uid() = alumni_id
    );

-- Stored procedure to process alumni acceptance and link profile to event draft
CREATE OR REPLACE FUNCTION accept_alumni_speaker_request(
    p_request_id UUID,
    p_alumni_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_event_id UUID;
    v_headshot_url TEXT;
    v_bio TEXT;
    v_full_name TEXT;
BEGIN
    -- Fetch request details
    SELECT event_id INTO v_event_id
    FROM speaker_requests
    WHERE id = p_request_id AND alumni_id = p_alumni_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Update request status
    UPDATE speaker_requests
    SET status = 'accepted', updated_at = NOW()
    WHERE id = p_request_id;

    -- Fetch alumni profile details
    SELECT avatar_url, bio, full_name INTO v_headshot_url, v_bio, v_full_name
    FROM user_preferences
    WHERE user_id = p_alumni_id;

    -- Attach alumni details to event draft if linked
    IF v_event_id IS NOT NULL THEN
        UPDATE events
        SET featured_speaker_name = v_full_name,
            featured_speaker_bio = v_bio,
            featured_speaker_headshot = v_headshot_url,
            updated_at = NOW()
        WHERE id = v_event_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;