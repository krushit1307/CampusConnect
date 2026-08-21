-- 1. Add payment_deadline column to rsvps
ALTER TABLE rsvps 
ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- 2. Function to promote the next person on the waitlist when a spot opens up
CREATE OR REPLACE FUNCTION promote_next_waitlisted_user(p_event_id UUID)
RETURNS UUID AS $$
DECLARE
    v_rsvp_id UUID;
BEGIN
    SELECT id INTO v_rsvp_id
    FROM rsvps
    WHERE event_id = p_event_id
      AND status = 'waitlisted'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_rsvp_id IS NOT NULL THEN
        UPDATE rsvps
        SET status = 'pending_payment',
            payment_deadline = NOW() + INTERVAL '15 minutes',
            updated_at = NOW()
        WHERE id = v_rsvp_id;
    END IF;

    RETURN v_rsvp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;