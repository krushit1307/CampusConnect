-- 1. Create mentorship_surveys table
CREATE TABLE IF NOT EXISTS mentorship_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES mentorship_relationships(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(relationship_id)
);

-- 2. Extend user_preferences to cache aggregated mentorship ratings and matchmaking status
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS average_mentorship_rating NUMERIC(3, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS total_mentorship_reviews INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS is_matchmaking_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Index for rating queries
CREATE INDEX IF NOT EXISTS idx_mentorship_surveys_mentor ON mentorship_surveys(mentor_id);

-- Enable RLS
ALTER TABLE mentorship_surveys ENABLE ROW LEVEL SECURITY;

-- Stored RPC procedure to record survey rating and re-evaluate mentor matchmaking pool eligibility
CREATE OR REPLACE FUNCTION submit_mentorship_milestone_survey(
    p_relationship_id UUID,
    p_rating INTEGER,
    p_feedback TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_mentor_id UUID;
    v_mentee_id UUID;
    v_avg NUMERIC(3, 2);
    v_count INTEGER;
BEGIN
    SELECT mentor_id, mentee_id INTO v_mentor_id, v_mentee_id
    FROM mentorship_relationships
    WHERE id = p_relationship_id AND completed_meetings_count >= 5;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Insert survey rating record
    INSERT INTO mentorship_surveys (relationship_id, mentor_id, mentee_id, rating, feedback_notes)
    VALUES (p_relationship_id, v_mentor_id, v_mentee_id, p_rating, p_feedback);

    -- Calculate updated running average for mentor
    SELECT COUNT(*), ROUND(AVG(rating)::numeric, 2)
    INTO v_count, v_avg
    FROM mentorship_surveys
    WHERE mentor_id = v_mentor_id;

    -- Update mentor profile with aggregated rating & handle matchmaking pool suppression (<3.0 stars)
    UPDATE user_preferences
    SET average_mentorship_rating = v_avg,
        total_mentorship_reviews = v_count,
        is_matchmaking_active = CASE WHEN (v_count >= 2 AND v_avg < 3.0) THEN FALSE ELSE TRUE END
    WHERE user_id = v_mentor_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;