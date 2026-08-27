-- 1. Extend clubs table with risk_level enum
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'Low' NOT NULL 
    CHECK (risk_level IN ('Low', 'Medium', 'High'));

-- 2. Create club_leadership_waivers table to store executed legal waivers and cryptographic hashes
CREATE TABLE IF NOT EXISTS club_leadership_waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    incoming_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    waiver_document_title TEXT NOT NULL,
    signature_text TEXT NOT NULL,
    signature_hash TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(club_id, incoming_admin_id)
);

-- Index for legal discovery lookups
CREATE INDEX IF NOT EXISTS idx_leadership_waivers ON club_leadership_waivers(club_id, incoming_admin_id);

-- Enable RLS
ALTER TABLE club_leadership_waivers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Signed users and Admins can view executed legal waivers
CREATE POLICY "Users and admins can view executed leadership waivers"
    ON club_leadership_waivers FOR SELECT
    USING (
        auth.uid() = incoming_admin_id OR 
        EXISTS (
            SELECT 1 FROM user_preferences up 
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- 3. Stored RPC procedure to record executed high-risk waiver signature
CREATE OR REPLACE FUNCTION record_leadership_waiver_signature(
    p_club_id UUID,
    p_incoming_admin_id UUID,
    p_signature_text TEXT,
    p_signature_hash TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    waiver_id UUID,
    club_id UUID,
    signed_at TIMESTAMPTZ,
    status TEXT
) AS $$
DECLARE
    v_waiver_id UUID;
    v_signed_at TIMESTAMPTZ;
BEGIN
    INSERT INTO club_leadership_waivers (
        club_id,
        incoming_admin_id,
        waiver_document_title,
        signature_text,
        signature_hash,
        ip_address
    )
    VALUES (
        p_club_id,
        p_incoming_admin_id,
        'High-Risk Organization Leadership & Legal Indemnification Waiver',
        p_signature_text,
        p_signature_hash,
        p_ip_address
    )
    ON CONFLICT (club_id, incoming_admin_id) DO UPDATE
    SET signature_text = EXCLUDED.signature_text,
        signature_hash = EXCLUDED.signature_hash,
        signed_at = NOW(),
        ip_address = EXCLUDED.ip_address
    RETURNING id, signed_at INTO v_waiver_id, v_signed_at;

    RETURN QUERY SELECT v_waiver_id, p_club_id, v_signed_at, 'EXECUTED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;