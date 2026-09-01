-- 1. Extend vendor_contracts to track tax exemption documentation and vendor acknowledgement
ALTER TABLE vendor_contracts
ADD COLUMN IF NOT EXISTS tax_exemption_cert_url TEXT DEFAULT 'https://storage.campusconnect.edu/compliance/university_st5_form.pdf',
ADD COLUMN IF NOT EXISTS is_tax_exempt_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS tax_exemption_acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billed_tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- 2. Create index for tax compliance auditing
CREATE INDEX IF NOT EXISTS idx_vendor_tax_compliance ON vendor_contracts(id, is_tax_exempt_acknowledged);

-- 3. Stored RPC procedure to acknowledge tax exemption and validate final invoice payloads
CREATE OR REPLACE FUNCTION acknowledge_tax_exemption(
    p_contract_id UUID,
    p_acknowledged BOOLEAN
)
RETURNS TABLE (
    contract_id UUID,
    cert_url TEXT,
    is_acknowledged BOOLEAN,
    acknowledged_at TIMESTAMPTZ
) AS $$
DECLARE
    v_cert_url TEXT;
    v_ack_time TIMESTAMPTZ := NULL;
BEGIN
    IF NOT p_acknowledged THEN
        RAISE EXCEPTION 'Vendor must acknowledge the Tax-Exempt certificate before finalizing contract.';
    END IF;

    v_ack_time := NOW();

    UPDATE vendor_contracts
    SET is_tax_exempt_acknowledged = TRUE,
        tax_exemption_acknowledged_at = v_ack_time,
        updated_at = NOW()
    WHERE id = p_contract_id
    RETURNING tax_exemption_cert_url INTO v_cert_url;

    RETURN QUERY SELECT p_contract_id, v_cert_url, TRUE, v_ack_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;