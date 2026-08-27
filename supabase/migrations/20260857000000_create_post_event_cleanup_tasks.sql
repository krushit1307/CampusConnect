-- 1. Create cleanup_tasks table
CREATE TABLE IF NOT EXISTS cleanup_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    point_bounty INTEGER DEFAULT 500 NOT NULL CHECK (point_bounty > 0),
    max_volunteers INTEGER DEFAULT 1 NOT NULL CHECK (max_volunteers > 0),
    claimed_volunteers_count INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'hidden' NOT NULL CHECK (status IN ('hidden', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create cleanup_task_claims table
CREATE TABLE IF NOT EXISTS cleanup_task_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES cleanup_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'claimed' NOT NULL CHECK (status IN ('claimed', 'verified', 'rejected')),
    claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ,
    UNIQUE(task_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cleanup_tasks_event ON cleanup_tasks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_cleanup_claims_user ON cleanup_task_claims(user_id);

-- Enable RLS
ALTER TABLE cleanup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_task_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Checked-in attendees can only view ACTIVE cleanup tasks
CREATE POLICY "Attendees can view active cleanup tasks"
    ON cleanup_tasks FOR SELECT
    USING (
        status = 'active'
        OR EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = cleanup_tasks.event_id AND eo.user_id = auth.uid()
        )
    );

-- Stored RPC procedure to verify cleanup completion and disburse gamification points
CREATE OR REPLACE FUNCTION verify_cleanup_task_claim(
    p_claim_id UUID,
    p_organizer_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_task_id UUID;
    v_user_id UUID;
    v_event_id UUID;
    v_points INTEGER;
BEGIN
    -- Verify caller is event organizer
    SELECT t.id, t.event_id, c.user_id, t.point_bounty
    INTO v_task_id, v_event_id, v_user_id, v_points
    FROM cleanup_task_claims c
    JOIN cleanup_tasks t ON t.id = c.task_id
    WHERE c.id = p_claim_id AND c.status = 'claimed';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM event_organizers eo
        WHERE eo.event_id = v_event_id AND eo.user_id = p_organizer_id
    ) THEN
        RETURN FALSE;
    END IF;

    -- Update claim status
    UPDATE cleanup_task_claims
    SET status = 'verified', verified_at = NOW()
    WHERE id = p_claim_id;

    -- Disburse points to volunteer ledger
    UPDATE user_preferences
    SET gamification_points = COALESCE(gamification_points, 0) + v_points
    WHERE user_id = v_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;