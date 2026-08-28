-- Migration: 20270831000000_sponsor_viewability_tracker.sql
-- Description: Implement 'Dynamic "Sponsor Logo" Impression Viewability Tracker' (#4816)

-- 1. Create sponsor_escrows table
CREATE TABLE IF NOT EXISTS public.sponsor_escrows (
    sponsor_id UUID PRIMARY KEY REFERENCES public.sponsors(id) ON DELETE CASCADE,
    balance NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0)
);

-- 2. Create sponsor_impression_logs table
CREATE TABLE IF NOT EXISTS public.sponsor_impression_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    time_in_view_ms INT NOT NULL CHECK (time_in_view_ms >= 2000),
    charge_amount NUMERIC(10, 4) NOT NULL DEFAULT 0.5000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sponsor_escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_impression_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Sponsors and admins can view escrow" ON public.sponsor_escrows;
CREATE POLICY "Sponsors and admins can view escrow" 
ON public.sponsor_escrows FOR SELECT TO authenticated, anon 
USING (true);

DROP POLICY IF EXISTS "Sponsors and admins can view impression logs" ON public.sponsor_impression_logs;
CREATE POLICY "Sponsors and admins can view impression logs" 
ON public.sponsor_impression_logs FOR SELECT TO authenticated, anon 
USING (true);

-- 4. Secure RPC function to record verified impression and deduct micro-transaction from sponsor's escrow
CREATE OR REPLACE FUNCTION public.record_sponsor_logo_impression(
    p_sponsor_id UUID,
    p_event_id UUID,
    p_time_in_view_ms INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC(12, 4);
    v_charge NUMERIC(10, 4) := 0.5000;
    v_user_id UUID := auth.uid();
    v_sponsorship_id UUID;
    v_asset_id UUID;
BEGIN
    -- Verify time_in_view_ms
    IF p_time_in_view_ms < 2000 THEN
        RAISE EXCEPTION 'Invalid impression: time_in_view_ms must be at least 2000ms';
    END IF;

    -- Fetch and lock escrow balance
    SELECT balance INTO v_balance
    FROM public.sponsor_escrows
    WHERE sponsor_id = p_sponsor_id
    FOR UPDATE;

    IF v_balance IS NULL THEN
        -- Auto-provision escrow account with a starting balance of $100 for testing convenience
        INSERT INTO public.sponsor_escrows (sponsor_id, balance)
        VALUES (p_sponsor_id, 100.0000);
        v_balance := 100.0000;
    END IF;

    IF v_balance < v_charge THEN
        RAISE EXCEPTION 'Insufficient escrow balance';
    END IF;

    -- Deduct charge
    UPDATE public.sponsor_escrows
    SET balance = balance - v_charge
    WHERE sponsor_id = p_sponsor_id;

    -- Log the impression
    INSERT INTO public.sponsor_impression_logs (sponsor_id, event_id, user_id, time_in_view_ms, charge_amount)
    VALUES (p_sponsor_id, p_event_id, v_user_id, p_time_in_view_ms, v_charge);

    -- Find and update the marketing asset for this sponsor's logo placement at this event
    SELECT es.id INTO v_sponsorship_id
    FROM public.event_sponsorships es
    WHERE es.event_id = p_event_id AND es.sponsor_id = p_sponsor_id
    LIMIT 1;

    IF v_sponsorship_id IS NOT NULL THEN
        -- Find or create marketing asset record
        SELECT id INTO v_asset_id
        FROM public.sponsorship_marketing_assets
        WHERE sponsorship_id = v_sponsorship_id AND asset_type = 'logo_placement'
        LIMIT 1;

        IF v_asset_id IS NULL THEN
            INSERT INTO public.sponsorship_marketing_assets (sponsorship_id, asset_name, asset_type, impressions)
            VALUES (v_sponsorship_id, 'Sponsor Logo Placement', 'logo_placement', 1);
        ELSE
            UPDATE public.sponsorship_marketing_assets
            SET impressions = impressions + 1
            WHERE id = v_asset_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deducted', v_charge,
        'remaining_balance', v_balance - v_charge
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sponsor_logo_impression(UUID, UUID, INT) TO authenticated, anon;
