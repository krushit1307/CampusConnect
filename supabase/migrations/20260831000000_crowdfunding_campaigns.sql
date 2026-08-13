-- Migration: 20260831000000_crowdfunding_campaigns.sql
-- Issue: Develop a 'Crowdfunding / Goal Progress' Bar for Clubs
-- Description: Adds crowdfunding_campaigns + campaign_donations tables, a trigger that
-- keeps campaigns.current_amount in sync with successful/refunded/disputed donations,
-- and a "Top Donors" leaderboard view that respects donor anonymity.

-- =============================================================================
-- 1. crowdfunding_campaigns
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crowdfunding_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_amount_cents INTEGER NOT NULL CHECK (target_amount_cents > 0),
    -- Denormalized running total, maintained exclusively by the trigger below.
    -- Never write to this column directly from application code.
    current_amount_cents INTEGER NOT NULL DEFAULT 0,
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_club ON public.crowdfunding_campaigns(club_id);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_status ON public.crowdfunding_campaigns(status);

-- =============================================================================
-- 2. campaign_donations
-- One-off Stripe Checkout donations linked to a specific campaign_id.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.crowdfunding_campaigns(id) ON DELETE CASCADE,
    donor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT, -- snapshot of donor's name at time of donation, for anonymous-safe leaderboards
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    stripe_checkout_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    -- succeeded: counted toward current_amount_cents.
    -- refunded/disputed: excluded, and current_amount_cents is decremented if it had counted before.
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'refunded', 'disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_donations_campaign ON public.campaign_donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_donor ON public.campaign_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_status ON public.campaign_donations(status);

-- =============================================================================
-- 3. Trigger: keep current_amount_cents mathematically accurate
--
-- Fires on INSERT (a donation is logged already-succeeded, or moves into
-- succeeded) and on UPDATE (status transitions, e.g. succeeded -> refunded /
-- disputed on a chargeback webhook). Only the *delta* between the old and
-- new "counts toward total" state is applied, so this is safe to call from
-- both the initial webhook insert and any later refund/dispute update.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_campaign_donation_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_was_counted BOOLEAN := FALSE;
    v_is_counted BOOLEAN := FALSE;
    v_delta INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_is_counted := (NEW.status = 'succeeded');
        v_delta := CASE WHEN v_is_counted THEN NEW.amount_cents ELSE 0 END;
    ELSIF TG_OP = 'UPDATE' THEN
        v_was_counted := (OLD.status = 'succeeded');
        v_is_counted := (NEW.status = 'succeeded');

        IF v_was_counted AND NOT v_is_counted THEN
            -- e.g. succeeded -> refunded / disputed: remove the previously-counted amount
            v_delta := -OLD.amount_cents;
        ELSIF NOT v_was_counted AND v_is_counted THEN
            -- e.g. pending -> succeeded
            v_delta := NEW.amount_cents;
        ELSIF v_was_counted AND v_is_counted AND NEW.amount_cents <> OLD.amount_cents THEN
            -- amount corrected (e.g. partial refund) while remaining counted
            v_delta := NEW.amount_cents - OLD.amount_cents;
        ELSE
            v_delta := 0;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_delta := CASE WHEN OLD.status = 'succeeded' THEN -OLD.amount_cents ELSE 0 END;
    ELSE
        v_delta := 0;
    END IF;

    IF v_delta <> 0 THEN
        UPDATE public.crowdfunding_campaigns
        SET current_amount_cents = GREATEST(0, current_amount_cents + v_delta),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_donation_insert ON public.campaign_donations;
CREATE TRIGGER trg_campaign_donation_insert
    AFTER INSERT ON public.campaign_donations
    FOR EACH ROW EXECUTE FUNCTION public.apply_campaign_donation_delta();

DROP TRIGGER IF EXISTS trg_campaign_donation_update ON public.campaign_donations;
CREATE TRIGGER trg_campaign_donation_update
    AFTER UPDATE OF status, amount_cents ON public.campaign_donations
    FOR EACH ROW EXECUTE FUNCTION public.apply_campaign_donation_delta();

DROP TRIGGER IF EXISTS trg_campaign_donation_delete ON public.campaign_donations;
CREATE TRIGGER trg_campaign_donation_delete
    AFTER DELETE ON public.campaign_donations
    FOR EACH ROW EXECUTE FUNCTION public.apply_campaign_donation_delta();

-- =============================================================================
-- 4. Top Donors leaderboard view — anonymous donors are aggregated under a
-- single "Anonymous" row rather than exposing per-donor identity.
-- =============================================================================
CREATE OR REPLACE VIEW public.campaign_top_donors AS
SELECT
    campaign_id,
    CASE WHEN is_anonymous THEN NULL ELSE donor_id END AS donor_id,
    CASE WHEN is_anonymous THEN 'Anonymous' ELSE COALESCE(display_name, 'Anonymous') END AS display_name,
    is_anonymous,
    SUM(amount_cents) AS total_donated_cents,
    COUNT(*) AS donation_count,
    MAX(created_at) AS last_donation_at
FROM public.campaign_donations
WHERE status = 'succeeded'
GROUP BY campaign_id, CASE WHEN is_anonymous THEN NULL ELSE donor_id END,
         CASE WHEN is_anonymous THEN 'Anonymous' ELSE COALESCE(display_name, 'Anonymous') END,
         is_anonymous;

-- =============================================================================
-- 5. RLS
-- =============================================================================
ALTER TABLE public.crowdfunding_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_donations ENABLE ROW LEVEL SECURITY;

-- Campaigns are public (they're displayed on the club's public profile).
CREATE POLICY "Anyone can view crowdfunding campaigns"
ON public.crowdfunding_campaigns FOR SELECT
USING (true);

-- Only club admins/officers can create or edit campaigns for their club.
CREATE POLICY "Club admins can manage their campaigns"
ON public.crowdfunding_campaigns FOR INSERT
TO authenticated
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Club admins can update their campaigns"
ON public.crowdfunding_campaigns FOR UPDATE
TO authenticated
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Club admins can delete their campaigns"
ON public.crowdfunding_campaigns FOR DELETE
TO authenticated
USING (public.is_club_admin(club_id, auth.uid()));

-- IMPORTANT: the raw campaign_donations table is intentionally NOT broadly
-- readable — it stores donor_id/display_name even for anonymous donations.
-- Public consumers (the progress bar, the Top Donors leaderboard) must read
-- through the campaign_top_donors view below instead, which strips donor
-- identity for anonymous rows via its CASE logic. Views in Postgres execute
-- with the privileges of their owner rather than the querying role, so the
-- view can safely stay readable even while the underlying table is locked
-- down here.
CREATE POLICY "Donors can view their own donations"
ON public.campaign_donations FOR SELECT
TO authenticated
USING (donor_id = auth.uid());

CREATE POLICY "Club admins can view all donations to their campaigns"
ON public.campaign_donations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.crowdfunding_campaigns c
        WHERE c.id = campaign_donations.campaign_id
          AND public.is_club_admin(c.club_id, auth.uid())
    )
);

-- All writes (insert on successful checkout, update on refund/dispute) come
-- exclusively from the payment-webhook edge function running as service_role,
-- so donations can never be forged or tampered with by a client.
CREATE POLICY "Service role manages donations"
ON public.campaign_donations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.campaign_top_donors TO anon, authenticated;
