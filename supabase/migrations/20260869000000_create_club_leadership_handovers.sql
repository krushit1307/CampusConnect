-- 1. Create club_leadership_handovers table for digital signature onboarding tracking
CREATE TABLE IF NOT EXISTS club_leadership_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('president', 'treasurer', 'admin', 'officer')),
    signed_constitution BOOLEAN DEFAULT FALSE NOT NULL,
    signed_financial_ledger BOOLEAN DEFAULT FALSE NOT NULL,
    signed_compliance_probation BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(club_id, user_id)
);

-- Index for onboarding state lookups
CREATE INDEX IF NOT EXISTS idx_leadership_handover_user ON club_leadership_handovers(user_id, club_id);

-- Enable RLS
ALTER TABLE club_leadership_handovers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Incoming executives can view and update their own handover records
CREATE POLICY "Users can manage their own leadership handover"
    ON club_leadership_handovers FOR ALL
    USING (auth.uid() = user_id);

-- 2. Stored RPC procedure to record digital signatures and unlock dashboard upon 3-step completion
CREATE OR REPLACE FUNCTION sign_leadership_handover_step(
    p_club_id UUID,
    p_user_id UUID,
    p_step INTEGER -- 1: Constitution, 2: Financial Ledger, 3: Compliance/Probation
)
RETURNS TABLE (
    is_fully_completed BOOLEAN,
    signed_constitution BOOLEAN,
    signed_financial_ledger BOOLEAN,
    signed_compliance_probation BOOLEAN
) AS $$
DECLARE
    v_rec RECORD;
BEGIN
    -- Ensure handover record exists
    INSERT INTO club_leadership_handovers (club_id, user_id, role)
    SELECT p_club_id, p_user_id, cm.role
    FROM club_memberships cm
    WHERE cm.club_id = p_club_id AND cm.user_id = p_user_id
    ON CONFLICT (club_id, user_id) DO NOTHING;

    -- Update specific step digital signature
    IF p_step = 1 THEN
        UPDATE club_leadership_handovers SET signed_constitution = TRUE WHERE club_id = p_club_id AND user_id = p_user_id;
    ELSIF p_step = 2 THEN
        UPDATE club_leadership_handovers SET signed_financial_ledger = TRUE WHERE club_id = p_club_id AND user_id = p_user_id;
    ELSIF p_step = 3 THEN
        UPDATE club_leadership_handovers SET signed_compliance_probation = TRUE WHERE club_id = p_club_id AND user_id = p_user_id;
    END IF;

    -- Check status after update
    SELECT * INTO v_rec FROM club_leadership_handovers WHERE club_id = p_club_id AND user_id = p_user_id;

    IF v_rec.signed_constitution AND v_rec.signed_financial_ledger AND v_rec.signed_compliance_probation THEN
        -- Unlock membership status
        UPDATE club_memberships
        SET onboarding_status = 'active'
        WHERE club_id = p_club_id AND user_id = p_user_id;

        UPDATE club_leadership_handovers
        SET completed_at = NOW()
        WHERE club_id = p_club_id AND user_id = p_user_id;

        RETURN QUERY SELECT TRUE, TRUE, TRUE, TRUE;
    ELSE
        RETURN QUERY SELECT FALSE, v_rec.signed_constitution, v_rec.signed_financial_ledger, v_rec.signed_compliance_probation;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;