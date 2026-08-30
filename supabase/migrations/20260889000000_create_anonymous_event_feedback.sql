-- 1. Extend event_reviews table to support cryptographic user_id hashes and anonymous flag
ALTER TABLE event_reviews
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS anonymous_user_hash TEXT;

-- Make user_id nullable for anonymous entries to enforce cryptographic dissociation
ALTER TABLE event_reviews ALTER COLUMN user_id DROP NOT NULL;

-- Index for anonymous review integrity checks
CREATE INDEX IF NOT EXISTS idx_event_reviews_anon_hash ON event_reviews(event_id, anonymous_user_hash) WHERE is_anonymous = TRUE;

-- 2. Stored RPC procedure to insert anonymous feedback with cryptographic hash
CREATE OR REPLACE FUNCTION submit_anonymous_event_feedback(
    p_event_id UUID,
    p_rating INTEGER,
    p_review_comment TEXT,
    p_anonymous_hash TEXT
)
RETURNS TABLE (
    review_id UUID,
    event_id UUID,
    is_anonymous BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_review_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Ensure duplicate anonymous reviews from same hashed user are prevented
    IF EXISTS (
        SELECT 1 FROM event_reviews 
        WHERE event_id = p_event_id AND anonymous_user_hash = p_anonymous_hash
    ) THEN
        RAISE EXCEPTION 'Feedback already submitted for this event.';
    END IF;

    INSERT INTO event_reviews (
        event_id,
        user_id,
        rating,
        review_comment,
        is_anonymous,
        anonymous_user_hash
    )
    VALUES (
        p_event_id,
        NULL, -- Nullify direct user reference for privacy
        p_rating,
        p_review_comment,
        TRUE,
        p_anonymous_hash
    )
    RETURNING id, created_at INTO v_review_id, v_created_at;

    RETURN QUERY SELECT v_review_id, p_event_id, TRUE, v_created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;