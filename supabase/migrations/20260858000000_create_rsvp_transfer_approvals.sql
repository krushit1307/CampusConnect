-- 1. Add requires_transfer_approval setting to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS requires_transfer_approval BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create rsvp_transfer_requests table
CREATE TABLE IF NOT EXISTS rsvp_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    original_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_transfer_requests_event_status ON rsvp_transfer_requests(event_id, status);

-- Enable RLS
ALTER TABLE rsvp_transfer_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Event organizers can manage transfer requests
CREATE POLICY "Organizers can manage transfer requests"
    ON rsvp_transfer_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = rsvp_transfer_requests.event_id
              AND eo.user_id = auth.uid()
        )
    );

-- Stored RPC function to execute manual organizer ticket grant
CREATE OR REPLACE FUNCTION grant_transfer_ticket_to_user(
    p_request_id UUID,
    p_target_user_id UUID,
    p_organizer_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_event_id UUID;
    v_original_user_id UUID;
BEGIN
    SELECT event_id, original_user_id INTO v_event_id, v_original_user_id
    FROM rsvp_transfer_requests
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Verify caller is organizer
    IF NOT EXISTS (
        SELECT 1 FROM event_organizers eo
        WHERE eo.event_id = v_event_id AND eo.user_id = p_organizer_id
    ) THEN
        RETURN FALSE;
    END IF;

    -- Update original user RSVP to cancelled
    UPDATE rsvps
    SET status = 'cancelled', updated_at = NOW()
    WHERE event_id = v_event_id AND user_id = v_original_user_id;

    -- Upsert target user RSVP to attending
    INSERT INTO rsvps (event_id, user_id, status)
    VALUES (v_event_id, p_target_user_id, 'attending')
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET status = 'attending', updated_at = NOW();

    -- Mark transfer request as approved
    UPDATE rsvp_transfer_requests
    SET status = 'approved', target_user_id = p_target_user_id, updated_at = NOW()
    WHERE id = p_request_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;