-- 1. Extend ledger_transactions to support structuring fraud flagging
ALTER TABLE ledger_transactions
ADD COLUMN IF NOT EXISTS fraud_flag_reason TEXT,
ADD COLUMN IF NOT EXISTS rolling_7day_vendor_sum NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- Index for Auditor queue lookups
CREATE INDEX IF NOT EXISTS idx_ledger_structuring_fraud 
ON ledger_transactions(verification_status) WHERE verification_status = 'Structuring_Fraud_Suspected';

-- 2. Stored RPC procedure to evaluate structuring heuristics across 7-day window
CREATE OR REPLACE FUNCTION audit_transaction_for_structuring_fraud(
    p_transaction_id UUID,
    p_single_audit_threshold NUMERIC(10, 2) DEFAULT 500.00,
    p_lookback_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    transaction_id UUID,
    club_id UUID,
    vendor_name TEXT,
    rolling_7day_total NUMERIC(10, 2),
    is_fraud_flagged BOOLEAN,
    status TEXT
) AS $$
DECLARE
    v_club_id UUID;
    v_vendor TEXT;
    v_rolling_total NUMERIC(10, 2);
    v_status TEXT;
    v_reason TEXT := NULL;
BEGIN
    -- Fetch target transaction metadata
    SELECT club_id, vendor_name INTO v_club_id, v_vendor
    FROM ledger_transactions
    WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction ID not found.';
    END IF;

    -- Calculate rolling sum for this vendor within p_lookback_days
    SELECT COALESCE(SUM(amount), 0.00) INTO v_rolling_total
    FROM ledger_transactions
    WHERE club_id = v_club_id
      AND lower(trim(vendor_name)) = lower(trim(v_vendor))
      AND created_at >= (NOW() - (p_lookback_days || ' days')::INTERVAL);

    -- Structuring heuristic evaluation
    IF v_rolling_total >= p_single_audit_threshold THEN
        v_status := 'Structuring_Fraud_Suspected';
        v_reason := 'Structuring Fraud Detected: Rolling ' || p_lookback_days || '-day spending for vendor "' || v_vendor || '" ($' || v_rolling_total || ') reached or exceeded $' || p_single_audit_threshold || ' manual audit threshold.';

        -- Overrule OCR Auto-Verification for all related rolling window transactions of this vendor
        UPDATE ledger_transactions
        SET verification_status = 'Structuring_Fraud_Suspected',
            fraud_flag_reason = v_reason,
            updated_at = NOW()
        WHERE club_id = v_club_id
          AND lower(trim(vendor_name)) = lower(trim(v_vendor))
          AND created_at >= (NOW() - (p_lookback_days || ' days')::INTERVAL);
    ELSE
        SELECT verification_status INTO v_status
        FROM ledger_transactions
        WHERE id = p_transaction_id;
    END IF;

    -- Log rolling total snapshot on target record
    UPDATE ledger_transactions
    SET rolling_7day_vendor_sum = v_rolling_total
    WHERE id = p_transaction_id;

    RETURN QUERY SELECT p_transaction_id, v_club_id, v_vendor, v_rolling_total, (v_status = 'Structuring_Fraud_Suspected'), v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;