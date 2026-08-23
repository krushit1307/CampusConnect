-- =============================================================================
-- Migration: 20261231000030_dynamic_pricing_flash_sale.sql
-- Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
-- Description: Schema for flash sale campaigns, Stripe price mutation logs,
--              automatic rollback triggers, and financial liquidation stored procedures.
-- =============================================================================

-- 1. Flash Sale Campaigns Table
CREATE TABLE IF NOT EXISTS public.flash_sale_campaigns (
    id TEXT PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_tier_id TEXT NOT NULL,
    original_price_usd NUMERIC(10, 2) NOT NULL,
    discount_percentage INT NOT NULL CHECK (discount_percentage BETWEEN 5 AND 90),
    discounted_price_usd NUMERIC(10, 2) NOT NULL,
    original_stripe_price_id TEXT,
    active_dynamic_stripe_price_id TEXT,
    duration_minutes INT NOT NULL DEFAULT 60,
    total_flash_tickets_cap INT NOT NULL DEFAULT 50,
    tickets_sold INT NOT NULL DEFAULT 0,
    gross_revenue_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',
        'active',
        'paused',
        'expired',
        'reverted',
        'sold_out'
    )),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_flash_sale_campaigns_event_id ON public.flash_sale_campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_campaigns_status ON public.flash_sale_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_flash_sale_campaigns_expires_at ON public.flash_sale_campaigns(expires_at);

-- 2. Stripe Price Mutation Audit Logs Table
CREATE TABLE IF NOT EXISTS public.stripe_price_mutation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'mutate_discount',
    original_price_id TEXT NOT NULL,
    dynamic_price_id TEXT NOT NULL,
    executed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row Level Security
ALTER TABLE public.flash_sale_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_price_mutation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active flash sales"
    ON public.flash_sale_campaigns
    FOR SELECT
    USING (true);

CREATE POLICY "Organizers can manage flash sales"
    ON public.flash_sale_campaigns
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.club_members cm ON cm.club_id = e.club_id
            WHERE e.id = flash_sale_campaigns.event_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'president', 'officer')
        )
    );

CREATE POLICY "Admins can view mutation logs"
    ON public.stripe_price_mutation_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Stored Procedure: Trigger Flash Sale & Schedule Rollback
CREATE OR REPLACE FUNCTION public.trigger_flash_sale_rpc(
    p_campaign_id TEXT,
    p_event_id UUID,
    p_ticket_tier_id TEXT,
    p_original_price NUMERIC,
    p_discount_percentage INT,
    p_duration_minutes INT,
    p_ticket_cap INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_discounted_price NUMERIC;
    v_expires_at TIMESTAMPTZ;
    v_record RECORD;
BEGIN
    v_discounted_price := ROUND(p_original_price * (1.0 - (p_discount_percentage::numeric / 100.0)), 2);
    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.flash_sale_campaigns (
        id, event_id, ticket_tier_id, original_price_usd,
        discount_percentage, discounted_price_usd, duration_minutes,
        total_flash_tickets_cap, status, starts_at, expires_at
    )
    VALUES (
        p_campaign_id, p_event_id, p_ticket_tier_id, p_original_price,
        p_discount_percentage, v_discounted_price, p_duration_minutes,
        p_ticket_cap, 'active', NOW(), v_expires_at
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        discount_percentage = EXCLUDED.discount_percentage,
        discounted_price_usd = EXCLUDED.discounted_price_usd,
        status = 'active',
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
        'success', true,
        'campaign_id', v_record.id,
        'discounted_price', v_record.discounted_price_usd,
        'expires_at', v_record.expires_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_flash_sale_rpc TO authenticated, anon;
