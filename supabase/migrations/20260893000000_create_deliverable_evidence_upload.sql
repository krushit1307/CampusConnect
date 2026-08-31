-- 1. Extend vendor_contract_deliverables to track evidence attachments
ALTER TABLE vendor_contract_deliverables
ADD COLUMN IF NOT EXISTS requires_evidence BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS evidence_file_url TEXT,
ADD COLUMN IF NOT EXISTS evidence_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS evidence_file_type TEXT;

-- 2. Stored RPC procedure to upload deliverable evidence and unlock organizer countersign eligibility
CREATE OR REPLACE FUNCTION upload_vendor_deliverable_evidence(
    p_deliverable_id UUID,
    p_evidence_url TEXT,
    p_file_type TEXT DEFAULT 'image/jpeg'
)
RETURNS TABLE (
    deliverable_id UUID,
    contract_id UUID,
    evidence_url TEXT,
    vendor_checked BOOLEAN,
    ready_for_countersign BOOLEAN
) AS $$
DECLARE
    v_contract_id UUID;
BEGIN
    SELECT contract_id INTO v_contract_id
    FROM vendor_contract_deliverables
    WHERE id = p_deliverable_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deliverable record not found.';
    END IF;

    UPDATE vendor_contract_deliverables
    SET evidence_file_url = p_evidence_url,
        evidence_file_type = p_file_type,
        evidence_uploaded_at = NOW(),
        vendor_checked = TRUE,
        vendor_checked_at = NOW(),
        updated_at = NOW()
    WHERE id = p_deliverable_id;

    RETURN QUERY 
    SELECT 
        p_deliverable_id, 
        v_contract_id, 
        p_evidence_url, 
        TRUE, 
        TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;