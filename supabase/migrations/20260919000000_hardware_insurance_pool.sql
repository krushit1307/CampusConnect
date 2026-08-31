-- Migration for Dynamic "Hardware Resource" Drone Liability Insurance Micro-Premiums (#5289)
--
-- Adds the actuarial layer over the hardware library: a risk tier per asset category,
-- an append-only ledger for the university self-insurance pool, and the destruction
-- claims that route replacement funds out of it.
--
-- The pool balance is never stored as a column. A running total that drifts from the
-- movements behind it is how a self-insurance pool ends up underwriting claims it
-- cannot pay, so the balance is always derived from this ledger.

-- Risk tier per hardware category. Drones = high risk, projectors = low risk.
CREATE TABLE IF NOT EXISTS public.hardware_risk_tiers (
    category VARCHAR(64) PRIMARY KEY,
    tier VARCHAR(16) NOT NULL CHECK (tier IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')),
    -- Encodes how often the category is destroyed, not how much it costs:
    -- replacement value is already priced in separately.
    risk_multiplier NUMERIC(5, 2) NOT NULL CHECK (risk_multiplier > 0),
    rationale TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.hardware_risk_tiers (category, tier, risk_multiplier, rationale) VALUES
    ('drone', 'HIGH', 3.00, 'Operator error is total loss: water landings and flyaways are unrecoverable.'),
    ('vr_headset', 'MODERATE', 1.80, 'Dropped and swung into walls by users who cannot see the room.'),
    ('camera', 'MODERATE', 1.60, 'Portable and lens-fragile, but usually repairable rather than destroyed.'),
    ('power_station', 'MODERATE', 1.50, 'Battery abuse and outdoor exposure carry a thermal write-off risk.'),
    ('sensor_kit', 'LOW', 1.10, 'Losses are typically individual components, not the kit.'),
    ('laptop', 'LOW', 1.00, 'High value, low destruction rate; liquid damage is the main write-off.'),
    ('microcontroller', 'LOW', 0.80, 'Cheap to replace and rarely destroyed beyond a shorted board.'),
    ('projector', 'LOW', 0.50, 'Cart-mounted and stationary; lamp wear is maintenance, not loss.')
ON CONFLICT (category) DO NOTHING;

-- Every movement in or out of the self-insurance pool.
CREATE TABLE IF NOT EXISTS public.hardware_insurance_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type VARCHAR(24) NOT NULL
        CHECK (entry_type IN ('PREMIUM', 'REPLACEMENT_PAYOUT', 'SUBSIDY')),
    -- Positive for premiums and subsidies, negative for payouts, so the balance
    -- is a plain SUM over this column.
    amount_usd NUMERIC(12, 2) NOT NULL,
    asset_id UUID NOT NULL REFERENCES public.rfid_hardware_assets(id) ON DELETE RESTRICT,
    -- Club charged for a premium, or the department credited by a payout.
    counterparty VARCHAR(128) NOT NULL,
    booking_id UUID REFERENCES public.rfid_hardware_bookings(id) ON DELETE SET NULL,
    claim_id UUID,
    stripe_transfer_id VARCHAR(255),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hardware_ledger_sign_matches_type CHECK (
        (entry_type = 'REPLACEMENT_PAYOUT' AND amount_usd <= 0)
        OR (entry_type <> 'REPLACEMENT_PAYOUT' AND amount_usd >= 0)
    ),
    -- A booking pays its mandatory premium exactly once; a retry must not double charge.
    CONSTRAINT hardware_ledger_one_premium_per_booking UNIQUE (booking_id, entry_type)
);

CREATE INDEX IF NOT EXISTS idx_hardware_ledger_occurred_at
    ON public.hardware_insurance_ledger (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_ledger_asset
    ON public.hardware_insurance_ledger (asset_id, entry_type);

-- An admin's "Asset Destroyed" declaration and how the pool answered it.
CREATE TABLE IF NOT EXISTS public.hardware_destruction_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.rfid_hardware_assets(id) ON DELETE RESTRICT,
    booking_id UUID REFERENCES public.rfid_hardware_bookings(id) ON DELETE SET NULL,
    declared_by UUID NOT NULL,
    incident_description TEXT NOT NULL,
    claimed_usd NUMERIC(12, 2) NOT NULL CHECK (claimed_usd >= 0),
    payout_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (payout_usd >= 0),
    shortfall_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shortfall_usd >= 0),
    decision VARCHAR(24) NOT NULL
        CHECK (decision IN ('FULLY_FUNDED', 'PARTIALLY_FUNDED', 'DECLINED_INSOLVENT')),
    payee_department VARCHAR(128) NOT NULL,
    pool_balance_before_usd NUMERIC(12, 2) NOT NULL,
    stripe_transfer_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT hardware_claim_payout_within_claim CHECK (payout_usd <= claimed_usd),
    CONSTRAINT hardware_claim_shortfall_reconciles CHECK (
        shortfall_usd = claimed_usd - payout_usd
    )
);

-- Derived pool position. Reading the balance and reading the movements can never
-- disagree because there is only one source.
CREATE OR REPLACE VIEW public.hardware_insurance_pool_state AS
SELECT
    COALESCE(SUM(amount_usd), 0) AS balance_usd,
    COALESCE(SUM(amount_usd) FILTER (WHERE entry_type = 'PREMIUM'), 0) AS premiums_collected_usd,
    COALESCE(-SUM(amount_usd) FILTER (WHERE entry_type = 'REPLACEMENT_PAYOUT'), 0) AS payouts_issued_usd,
    COALESCE(SUM(amount_usd) FILTER (WHERE entry_type = 'SUBSIDY'), 0) AS subsidies_received_usd,
    COUNT(*) FILTER (WHERE entry_type = 'PREMIUM') AS premium_count,
    COUNT(*) FILTER (WHERE entry_type = 'REPLACEMENT_PAYOUT') AS payout_count
FROM public.hardware_insurance_ledger;

-- RLS -------------------------------------------------------------------------

ALTER TABLE public.hardware_risk_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_insurance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_destruction_claims ENABLE ROW LEVEL SECURITY;

-- Clubs must be able to see why a booking costs what it costs before they pay.
CREATE POLICY "Risk tiers are readable by authenticated users"
ON public.hardware_risk_tiers
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Ledger is readable by authenticated users"
ON public.hardware_insurance_ledger
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Claims are readable by authenticated users"
ON public.hardware_destruction_claims
FOR SELECT TO authenticated USING (TRUE);

-- No INSERT, UPDATE or DELETE policy is granted to any client role. Premiums are
-- debited and payouts routed only by the hardware-insurance-settlement Edge
-- Function using the service role, so a client cannot credit the pool without a
-- Stripe movement behind it, or drain it without a recorded claim.
