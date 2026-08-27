-- Migration: 20260816190000_cohost_revenue_sharing.sql
-- Description: Add revenue_splits JSONB column to events table,
--               create event_revenue_transfers and event_revenue_audit_logs tables,
--               and record_revenue_split_audit RPC function (#3182).

-- 1. Add revenue_splits JSONB column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS revenue_splits JSONB DEFAULT '[]'::jsonb;

-- 2. Create event_revenue_transfers table
CREATE TABLE IF NOT EXISTS public.event_revenue_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    stripe_charge_id TEXT NOT NULL,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    stripe_account_id TEXT NOT NULL,
    amount_cents INT NOT NULL,
    pct FLOAT NOT NULL,
    transfer_id TEXT,
    status TEXT NOT NULL DEFAULT 'completed', -- completed, refunded, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create event_revenue_audit_logs table
CREATE TABLE IF NOT EXISTS public.event_revenue_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    stripe_charge_id TEXT NOT NULL,
    total_net_cents INT NOT NULL,
    split_details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_revenue_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_revenue_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins and organizers can view revenue transfers"
    ON public.event_revenue_transfers FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Club admins and organizers can view revenue audit logs"
    ON public.event_revenue_audit_logs FOR SELECT
    USING (auth.role() = 'authenticated');

-- 4. RPC Function to record revenue split transfers and audit logs
CREATE OR REPLACE FUNCTION public.record_revenue_split_audit(
    p_event_id UUID,
    p_charge_id TEXT,
    p_total_net_cents INT,
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
BEGIN
    -- Record master audit log
    INSERT INTO public.event_revenue_audit_logs (
        event_id,
        stripe_charge_id,
        total_net_cents,
        split_details
    )
    VALUES (
        p_event_id,
        p_charge_id,
        p_total_net_cents,
        p_transfers
    )
    RETURNING id INTO v_audit_id;

    -- Record individual transfer line items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_transfers)
    LOOP
        INSERT INTO public.event_revenue_transfers (
            event_id,
            stripe_charge_id,
            club_id,
            stripe_account_id,
            amount_cents,
            pct,
            transfer_id,
            status
        )
        VALUES (
            p_event_id,
            p_charge_id,
            (v_item->>'club_id')::UUID,
            v_item->>'stripe_account_id',
            (v_item->>'amount_cents')::INT,
            (v_item->>'pct')::FLOAT,
            v_item->>'transfer_id',
            COALESCE(v_item->>'status', 'completed')
        );
    END LOOP;

    RETURN QUERY SELECT TRUE, 'Revenue split audit log recorded successfully.', v_audit_id;
END;
$$;
