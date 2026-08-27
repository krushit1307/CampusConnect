-- 1. Extend event_reviews to support organizer rebuttals
ALTER TABLE event_reviews
ADD COLUMN IF NOT EXISTS organizer_response_text TEXT,
ADD COLUMN IF NOT EXISTS organizer_responded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS organizer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- 2. Stored RPC procedure to record organizer response and trigger reviewer notification payload
CREATE OR REPLACE FUNCTION submit_organizer_review_rebuttal(
    p_review_id UUID,
    p_organizer_user_id UUID,
    p_response_text TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    review_id UUID,
    reviewer_user_id UUID,
    reviewer_email TEXT,
    event_title TEXT,
    response_text TEXT
) AS $$
DECLARE
    v_event_id UUID;
    v_reviewer_id UUID;
    v_reviewer_email TEXT;
    v_event_title TEXT;
BEGIN
    -- Verify caller is an organizer for this event
    SELECT er.event_id, er.user_id, u.email, e.title
    INTO v_event_id, v_reviewer_id, v_reviewer_email, v_event_title
    FROM event_reviews er
    JOIN events e ON e.id = er.event_id
    JOIN auth.users u ON u.id = er.user_id
    WHERE er.id = p_review_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review record not found.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM event_organizers eo
        WHERE eo.event_id = v_event_id AND eo.user_id = p_organizer_user_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User is not an organizer of this event.';
    END IF;

    -- Update review with organizer rebuttal
    UPDATE event_reviews
    SET organizer_response_text = p_response_text,
        organizer_responded_at = NOW(),
        organizer_user_id = p_organizer_user_id,
        updated_at = NOW()
    WHERE id = p_review_id;

    RETURN QUERY SELECT TRUE, p_review_id, v_reviewer_id, v_reviewer_email, v_event_title, p_response_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
