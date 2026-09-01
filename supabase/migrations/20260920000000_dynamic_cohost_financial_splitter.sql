-- Migration: 20260920000000_dynamic_cohost_financial_splitter.sql
-- Description: Issue #3889 - Develop a 'Dynamic Event Co-Hosting' Financial Splitter

-- 1. Create function to process co-host revenue splits and update club ledger balances atomically
CREATE OR REPLACE FUNCTION public.process_cohost_revenue_split(
    p_event_id UUID,
    p_charge_id TEXT,
    p_total_amount_cents INT,
    p_transfers JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    audit_id UUID
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
    v_item JSONB;
    v_club_id UUID;
    v_amount_cents INT;
    v_amount_dollars NUMERIC(10, 2);
    v_stripe_account_id TEXT;
    v_pct FLOAT;
    v_transfer_id TEXT;
    v_event_title TEXT;
BEGIN
    -- Get event title for audit description
    SELECT title INTO v_event_title FROM public.events WHERE id = p_event_id;
    IF v_event_title IS NULL THEN
        v_event_title := 'Co-Hosted Event';
    END IF;

    -- Master audit log entry
    INSERT INTO public.event_revenue_audit_logs (
        event_id,
        stripe_charge_id,
        total_net_cents,
        split_details,
        created_at
    ) VALUES (
        p_event_id,
        p_charge_id,
        p_total_amount_cents,
        p_transfers,
        NOW()
    ) RETURNING id INTO v_audit_id;

    -- Process individual transfer items & update club ledger balances
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_transfers)
    LOOP
        v_club_id := (v_item->>'club_id')::UUID;
        v_amount_cents := (v_item->>'amount_cents')::INT;
        v_amount_dollars := ROUND((v_amount_cents::NUMERIC / 100.0), 2);
        v_stripe_account_id := v_item->>'stripe_account_id';
        v_pct := (v_item->>'pct')::FLOAT;
        v_transfer_id := v_item->>'transfer_id';

        -- 1. Insert transfer log
        INSERT INTO public.event_revenue_transfers (
            event_id,
            stripe_charge_id,
            club_id,
            stripe_account_id,
            amount_cents,
            pct,
            transfer_id,
            status,
            created_at
        ) VALUES (
            p_event_id,
            p_charge_id,
            v_club_id,
            v_stripe_account_id,
            v_amount_cents,
            v_pct,
            v_transfer_id,
            'completed',
            NOW()
        );

        -- 2. Atomically update club ledger balance in club_transactions
        IF v_club_id IS NOT NULL AND v_amount_dollars > 0 THEN
            INSERT INTO public.club_transactions (
                club_id,
                amount,
                transaction_type,
                category,
                description,
                created_at
            ) VALUES (
                v_club_id,
                v_amount_dollars,
                'INCOME',
                'Ticket Sales',
                'Automated Co-Host Revenue Split (' || v_pct || '% share for ' || v_event_title || ')',
                NOW()
            );
        END IF;
    END LOOP;

    RETURN QUERY SELECT TRUE, 'Co-host revenue split and club ledger balances updated successfully.', v_audit_id;
END;
$$;
