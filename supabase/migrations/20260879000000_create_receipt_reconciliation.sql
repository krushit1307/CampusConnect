-- 1. Extend ledger_transactions to support automated verification status tracking
ALTER TABLE ledger_transactions
ADD COLUMN IF NOT EXISTS ocr_total_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Pending_Verification' NOT NULL 
    CHECK (verification_status IN ('Pending_Verification', 'Auto-Verified', 'Mismatch_Detected', 'Manual_Audit_Passed'));

-- Index for admin audit queue lookups
CREATE INDEX IF NOT EXISTS idx_ledger_verification ON ledger_transactions(verification_status) WHERE verification_status = 'Mismatch_Detected';

-- 2. Stored RPC procedure to reconcile OCR total against ledger transaction entry
CREATE OR REPLACE FUNCTION reconcile_ledger_receipt_ocr(
    p_transaction_id UUID,
    p_ocr_total NUMERIC(10, 2)
)
RETURNS TABLE (
    transaction_id UUID,
    ledger_amount NUMERIC(10, 2),
    ocr_total NUMERIC(10, 2),
    status TEXT,
    delta NUMERIC(10, 2)
) AS $$
DECLARE
    v_ledger_amount NUMERIC(10, 2);
    v_status TEXT;
    v_delta NUMERIC(10, 2);
BEGIN
    SELECT amount INTO v_ledger_amount
    FROM ledger_transactions
    WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction ID not found.';
    END IF;

    v_delta := ABS(v_ledger_amount - p_ocr_total);

    IF v_delta = 0.00 THEN
        v_status := 'Auto-Verified';
    ELSE
        v_status := 'Mismatch_Detected';
    END IF;

    UPDATE ledger_transactions
    SET ocr_total_amount = p_ocr_total,
        verification_status = v_status,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    RETURN QUERY SELECT p_transaction_id, v_ledger_amount, p_ocr_total, v_status, v_delta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;