-- =============================================================================
-- Migration: Club Sponsorship Tier Management
-- Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
-- Description: Creates sponsorship_tiers (club-defined Bronze/Silver/Gold
-- packages with price + perks) and sponsorship_tier_purchases (Stripe
-- checkout tracking). Includes a concurrency-safe reservation RPC (FOR UPDATE
-- row lock) so two sponsors can never buy the last unit of a limited tier
-- (e.g. a single $5000 Title Sponsor slot).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sponsorship_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INT NOT NULL CHECK (price >= 0), -- In cents
    perks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    available_quantity INT, -- NULL = unlimited
    sold_quantity INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sponsorship_tiers_quantity_check CHECK (
        available_quantity IS NULL OR sold_quantity <= available_quantity
    )
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_club_id ON public.sponsorship_tiers(club_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_active ON public.sponsorship_tiers(is_active);

CREATE TABLE IF NOT EXISTS public.sponsorship_tier_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id UUID NOT NULL REFERENCES public.sponsorship_tiers(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT,
    amount_paid INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'completed', 'failed', 'refunded')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_tier_purchases_tier_id ON public.sponsorship_tier_purchases(tier_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tier_purchases_sponsor_id ON public.sponsorship_tier_purchases(sponsor_id);

-- =============================================================================
-- Concurrency-safe inventory reservation (prevents double-selling)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reserve_sponsorship_tier(
    p_tier_id UUID,
    p_sponsor_id UUID
) RETURNS TABLE (
    purchase_id UUID,
    tier_name TEXT,
    tier_price INT
) AS $$
DECLARE
    v_tier public.sponsorship_tiers%ROWTYPE;
    v_purchase_id UUID;
BEGIN
    -- Lock the tier row so two concurrent buyers can't both claim the last unit
    SELECT * INTO v_tier
    FROM public.sponsorship_tiers
    WHERE id = p_tier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sponsorship tier not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_tier.is_active THEN
        RAISE EXCEPTION 'This sponsorship tier is no longer available';
    END IF;

    IF v_tier.available_quantity IS NOT NULL AND v_tier.sold_quantity >= v_tier.available_quantity THEN
        RAISE EXCEPTION 'This sponsorship tier is sold out' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.sponsorship_tiers
    SET sold_quantity = sold_quantity + 1
    WHERE id = p_tier_id;

    INSERT INTO public.sponsorship_tier_purchases (tier_id, sponsor_id, amount_paid, status)
    VALUES (p_tier_id, p_sponsor_id, v_tier.price, 'pending')
    RETURNING id INTO v_purchase_id;

    RETURN QUERY SELECT v_purchase_id, v_tier.name, v_tier.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reserve_sponsorship_tier(UUID, UUID) TO authenticated, service_role;

-- Releases a reserved unit back to inventory (e.g. Stripe session creation fails/expires)
CREATE OR REPLACE FUNCTION public.release_sponsorship_tier(p_purchase_id UUID) RETURNS VOID AS $$
DECLARE
    v_tier_id UUID;
BEGIN
    SELECT tier_id INTO v_tier_id
    FROM public.sponsorship_tier_purchases
    WHERE id = p_purchase_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.sponsorship_tiers
    SET sold_quantity = GREATEST(0, sold_quantity - 1)
    WHERE id = v_tier_id;

    UPDATE public.sponsorship_tier_purchases
    SET status = 'failed'
    WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.release_sponsorship_tier(UUID) TO authenticated, service_role;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.sponsorship_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_tier_purchases ENABLE ROW LEVEL SECURITY;

-- Anyone (including sponsors, who aren't club members) can view active tiers
CREATE POLICY "Anyone can view active sponsorship tiers" ON public.sponsorship_tiers
    FOR SELECT USING (is_active = TRUE);

-- Club admins (e.g. Treasurer) can fully manage their own club's tiers
CREATE POLICY "Club admins can manage sponsorship tiers" ON public.sponsorship_tiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = sponsorship_tiers.club_id
                AND cm.user_id = auth.uid()
                AND cm.role = 'admin'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = sponsorship_tiers.club_id
                AND cm.user_id = auth.uid()
                AND cm.role = 'admin'
        )
    );

-- Sponsors can view their own purchases; club admins can view purchases of their tiers
CREATE POLICY "Sponsors can view own purchases" ON public.sponsorship_tier_purchases
    FOR SELECT USING (
        sponsor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.sponsorship_tiers st
            JOIN public.club_members cm ON cm.club_id = st.club_id
            WHERE st.id = sponsorship_tier_purchases.tier_id
                AND cm.user_id = auth.uid()
                AND cm.role = 'admin'
        )
    );