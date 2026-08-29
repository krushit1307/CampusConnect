-- 1. Extend ledger_transactions to associate specific expenses with corporate sponsorship funds
ALTER TABLE ledger_transactions
ADD COLUMN IF NOT EXISTS sponsorship_id UUID REFERENCES corporate_sponsorships(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS receipt_ocr_url TEXT;

-- Index for sponsor portal query lookups
CREATE INDEX IF NOT EXISTS idx_ledger_tx_sponsorship ON ledger_transactions(sponsorship_id);

-- 2. Stored RPC function to retrieve verified sponsor spending breakdown
CREATE OR REPLACE FUNCTION get_sponsor_roi_breakdown(
    p_sponsorship_id UUID,
    p_sponsor_user_id UUID
)
RETURNS TABLE (
    transaction_id UUID,
    vendor_name TEXT,
    category TEXT,
    amount NUMERIC(10, 2),
    transaction_date TIMESTAMPTZ,
    receipt_ocr_url TEXT,
    is_verified BOOLEAN
) AS $$
BEGIN
    -- Verify caller owns the corporate sponsorship record or is event admin
    IF NOT EXISTS (
        SELECT 1 FROM corporate_sponsorships cs
        WHERE cs.id = p_sponsorship_id
          AND (cs.sponsor_user_id = p_sponsor_user_id OR EXISTS (
              SELECT 1 FROM user_preferences up WHERE up.user_id = p_sponsor_user_id AND up.is_admin = TRUE
          ))
    ) THEN
        RAISE EXCEPTION 'Unauthorized access to sponsorship financial records.';
    END IF;

    RETURN QUERY
    SELECT 
        lt.id AS transaction_id,
        lt.vendor_name,
        lt.category,
        lt.amount,
        lt.created_at AS transaction_date,
        lt.receipt_ocr_url,
        (lt.receipt_ocr_url IS NOT NULL) AS is_verified
    FROM ledger_transactions lt
    WHERE lt.sponsorship_id = p_sponsorship_id
    ORDER BY lt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;