-- Process Bundle Purchase (Atomic Transaction)
CREATE OR REPLACE FUNCTION rpc_process_bundle_purchase(
    p_user_id UUID,
    p_bundle_id UUID,
    p_stripe_session_id TEXT,
    p_amount_paid NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_purchase_id UUID;
    v_bundle_title TEXT;
    v_item RECORD;
BEGIN
    -- 1. Get Bundle Info
    SELECT title INTO v_bundle_title
    FROM bundles WHERE id = p_bundle_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bundle not found';
    END IF;

    -- 2. Prevent duplicate processing
    IF EXISTS (SELECT 1 FROM bundle_purchases WHERE stripe_session_id = p_stripe_session_id) THEN
        RAISE EXCEPTION 'Stripe session already processed';
    END IF;

    -- 3. Create purchase record
    INSERT INTO bundle_purchases (user_id, bundle_id, stripe_session_id, amount_paid, status)
    VALUES (p_user_id, p_bundle_id, p_stripe_session_id, p_amount_paid)
    RETURNING id INTO v_purchase_id;

    -- 4. Process each club in the bundle
    FOR v_item IN (SELECT club_id, allocation_amount FROM bundle_items WHERE bundle_id = p_bundle_id) LOOP
        
        -- Insert Membership (if not already a member, handle conflict safely)
        INSERT INTO club_members (user_id, club_id, role, status)
        VALUES (p_user_id, v_item.club_id, 'MEMBER', 'ACTIVE')
        ON CONFLICT (user_id, club_id) DO NOTHING;
        
        -- Insert Financial Ledger Credit (club_transactions)
        INSERT INTO club_transactions (club_id, amount, transaction_type, category, description)
        VALUES (v_item.club_id, v_item.allocation_amount, 'INCOME', 'Bundle Sales', 'Bundle Purchase - ' || v_bundle_title);
        
    END LOOP;

    -- 5. Audit Log
    INSERT INTO bundle_audit_log (user_id, bundle_id, action, details)
    VALUES (p_user_id, p_bundle_id, 'PURCHASE', jsonb_build_object('amount', p_amount_paid, 'stripe_session_id', p_stripe_session_id));

    RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Process Bundle Refund (Atomic Transaction)
CREATE OR REPLACE FUNCTION rpc_process_bundle_refund(
    p_bundle_purchase_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_bundle_id UUID;
    v_bundle_title TEXT;
    v_item RECORD;
BEGIN
    -- 1. Get Purchase Info
    SELECT user_id, bundle_id INTO v_user_id, v_bundle_id
    FROM bundle_purchases
    WHERE id = p_bundle_purchase_id AND status = 'completed';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Valid purchase not found';
    END IF;

    -- 2. Get Bundle Info
    SELECT title INTO v_bundle_title
    FROM bundles WHERE id = v_bundle_id;

    -- 3. Reverse Memberships and Credits
    FOR v_item IN (SELECT club_id, allocation_amount FROM bundle_items WHERE bundle_id = v_bundle_id) LOOP
        
        -- Remove Membership
        DELETE FROM club_members
        WHERE user_id = v_user_id AND club_id = v_item.club_id;
        
        -- Insert Financial Ledger Reversal (club_transactions)
        -- Negative income or Expense? The spec says:
        -- INSERT INTO financial_ledger (amount, transaction_type) VALUES (-20, 'bundle_refund')
        -- In our club_transactions model: amount = allocation_amount, transaction_type = EXPENSE
        INSERT INTO club_transactions (club_id, amount, transaction_type, category, description)
        VALUES (v_item.club_id, v_item.allocation_amount, 'EXPENSE', 'Refunds', 'Bundle Refund - ' || v_bundle_title);
        
    END LOOP;

    -- 4. Update purchase status
    UPDATE bundle_purchases SET status = 'refunded' WHERE id = p_bundle_purchase_id;

    -- 5. Audit Log
    INSERT INTO bundle_audit_log (user_id, bundle_id, action, details)
    VALUES (v_user_id, v_bundle_id, 'REFUND', jsonb_build_object('purchase_id', p_bundle_purchase_id));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
