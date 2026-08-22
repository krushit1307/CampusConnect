-- 1. Create club_merger_proposals table for digital signature verification
CREATE TABLE IF NOT EXISTS club_merger_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_club_a_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    source_club_b_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    new_club_name TEXT NOT NULL,
    president_a_user_id UUID NOT NULL REFERENCES auth.users(id),
    president_b_user_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    executed_at TIMESTAMPTZ,
    CONSTRAINT unique_active_merger UNIQUE(source_club_a_id, source_club_b_id)
);

-- 2. Add archived status support to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED', 'SUSPENDED')),
ADD COLUMN IF NOT EXISTS merged_into_club_id UUID REFERENCES clubs(id);

-- 3. Atomic Stored Procedure to execute Club Merger transaction
CREATE OR REPLACE FUNCTION execute_club_merger_transaction(
    p_proposal_id UUID,
    p_president_b_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_club_a_id UUID;
    v_club_b_id UUID;
    v_new_club_name TEXT;
    v_new_club_id UUID;
    v_events_migrated INT;
    v_members_migrated INT;
BEGIN
    -- Fetch proposal and verify pending status
    SELECT source_club_a_id, source_club_b_id, new_club_name
    INTO v_club_a_id, v_club_b_id, v_new_club_name
    FROM club_merger_proposals
    WHERE id = p_proposal_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or non-pending merger proposal.';
    END IF;

    -- Create new unified club entity
    INSERT INTO clubs (name, description, status)
    VALUES (v_new_club_name, 'Unified entity created via club merger.', 'ACTIVE')
    RETURNING id INTO v_new_club_id;

    -- Re-parent historical events
    UPDATE events
    SET club_id = v_new_club_id
    WHERE club_id IN (v_club_a_id, v_club_b_id);
    GET DIAGNOSTICS v_events_migrated = ROW_COUNT;

    -- Re-parent financial transactions / ledgers
    UPDATE club_transactions
    SET club_id = v_new_club_id
    WHERE club_id IN (v_club_a_id, v_club_b_id);

    -- Migrate & deduplicate club members
    INSERT INTO club_members (club_id, user_id, role, status)
    SELECT DISTINCT ON (user_id) v_new_club_id, user_id, 
           CASE WHEN user_id IN (p_president_b_user_id) THEN 'PRESIDENT' ELSE 'MEMBER' END,
           'ACTIVE'
    FROM club_members
    WHERE club_id IN (v_club_a_id, v_club_b_id)
    ON CONFLICT (club_id, user_id) DO NOTHING;
    GET DIAGNOSTICS v_members_migrated = ROW_COUNT;

    -- Archive source clubs A and B
    UPDATE clubs
    SET status = 'ARCHIVED', merged_into_club_id = v_new_club_id
    WHERE id IN (v_club_a_id, v_club_b_id);

    -- Mark proposal executed
    UPDATE club_merger_proposals
    SET status = 'EXECUTED', president_b_user_id = p_president_b_user_id, executed_at = NOW()
    WHERE id = p_proposal_id;

    RETURN jsonb_build_object(
        'newClubId', v_new_club_id,
        'newClubName', v_new_club_name,
        'migratedEventsCount', v_events_migrated,
        'migratedMembersCount', v_members_migrated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;