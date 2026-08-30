-- Issue #5258: Gift Aid declaration validity and claim eligibility
--
-- There is deliberately no is_gift_aid column on the donation. Eligibility is a
-- property of the declaration, and the declaration covers a span of time, so
-- the only durable question is whether one was in force on the day the donation
-- was made. A boolean on the donation records an answer given at a moment when
-- the answer was not yet knowable — and an enduring declaration signed today
-- changes the answer for donations eighteen months old.
--
-- Cancellation is stored as a date rather than as a status because it is not
-- retrospective. A cancelled declaration still covers everything given while it
-- was live, and a status column invites the sweep that reverses good claims.

CREATE TABLE IF NOT EXISTS public.gift_aid_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  signed_on DATE NOT NULL,
  -- An enduring declaration reaches back four tax years; a single-donation one
  -- does not reach back at all.
  enduring BOOLEAN NOT NULL DEFAULT TRUE,
  method TEXT NOT NULL CHECK (method IN ('WRITTEN', 'ONLINE', 'VERBAL_CONFIRMED')),
  -- Retained for audit: what the donor confirmed, in the words shown to them.
  statement_version TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  cancelled_on DATE,
  -- Set when a declaration turns out never to have been valid, which is a
  -- different thing from a donor cancelling and reverses claims already made.
  invalidated_on DATE,
  invalidation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cancelled_on IS NULL OR cancelled_on >= signed_on),
  CHECK ((invalidated_on IS NULL) = (invalidation_reason IS NULL))
);

CREATE INDEX IF NOT EXISTS gift_aid_declarations_donor_idx
  ON public.gift_aid_declarations (donor_id, signed_on);

CREATE INDEX IF NOT EXISTS gift_aid_declarations_live_idx
  ON public.gift_aid_declarations (donor_id)
  WHERE cancelled_on IS NULL AND invalidated_on IS NULL;

CREATE TABLE IF NOT EXISTS public.donation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  donor_type TEXT NOT NULL CHECK (donor_type IN ('INDIVIDUAL', 'COMPANY')),
  kind TEXT NOT NULL CHECK (
    kind IN ('DONATION', 'MEMBERSHIP_SUBSCRIPTION', 'GOODS_OR_SERVICES')
  ),
  -- Pence. Storing money as an integer removes a class of rounding argument.
  amount_pence BIGINT NOT NULL CHECK (amount_pence > 0),
  -- Tickets, priority booking, a hamper. Zero where the gift bought nothing.
  benefit_value_pence BIGINT NOT NULL DEFAULT 0 CHECK (benefit_value_pence >= 0),
  benefit_description TEXT,
  received_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (benefit_value_pence = 0 OR benefit_description IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS donation_payments_donor_idx
  ON public.donation_payments (donor_id, received_on);

CREATE TABLE IF NOT EXISTS public.gift_aid_basic_rate_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL,
  -- Exclusive. Null for the band still in force.
  effective_to DATE,
  basic_rate_percent NUMERIC(5, 2) NOT NULL CHECK (
    basic_rate_percent > 0 AND basic_rate_percent < 100
  ),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Overlapping bands would make the rate on a date depend on row order, and the
-- rate is a multiplier on every historic donation.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.gift_aid_basic_rate_bands
  DROP CONSTRAINT IF EXISTS gift_aid_basic_rate_bands_no_overlap;

ALTER TABLE public.gift_aid_basic_rate_bands
  ADD CONSTRAINT gift_aid_basic_rate_bands_no_overlap
  EXCLUDE USING gist (
    daterange(effective_from, effective_to, '[)') WITH &&
  );

CREATE TABLE IF NOT EXISTS public.gift_aid_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  assembled_on DATE NOT NULL,
  submitted_at TIMESTAMPTZ,
  total_donation_pence BIGINT NOT NULL CHECK (total_donation_pence >= 0),
  total_repayment_pence BIGINT NOT NULL CHECK (total_repayment_pence >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per donation in a claim, carrying the declaration it relied on. The
-- reliance is the reason this is a table rather than an array on the claim: a
-- declaration found invalid later has to be able to find exactly what it funded.
CREATE TABLE IF NOT EXISTS public.gift_aid_claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.gift_aid_claims(id) ON DELETE CASCADE,
  donation_id UUID NOT NULL REFERENCES public.donation_payments(id) ON DELETE RESTRICT,
  declaration_id UUID NOT NULL REFERENCES public.gift_aid_declarations(id) ON DELETE RESTRICT,
  -- The rate actually applied, kept so a later rate change cannot re-rate a
  -- historic claim by recomputation.
  basic_rate_percent NUMERIC(5, 2) NOT NULL,
  repayment_pence BIGINT NOT NULL CHECK (repayment_pence >= 0),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  CHECK ((reversed_at IS NULL) = (reversal_reason IS NULL))
);

-- A donation can be claimed once. A second live line on the same donation is a
-- duplicate claim, which is the error this schema most needs to make impossible.
CREATE UNIQUE INDEX IF NOT EXISTS gift_aid_claim_lines_one_live_idx
  ON public.gift_aid_claim_lines (donation_id)
  WHERE reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS gift_aid_claim_lines_declaration_idx
  ON public.gift_aid_claim_lines (declaration_id)
  WHERE reversed_at IS NULL;

-- 6 April opening the tax year containing the date.
CREATE OR REPLACE FUNCTION public.gift_aid_tax_year_start(p_date DATE)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_date >= MAKE_DATE(EXTRACT(YEAR FROM p_date)::INT, 4, 6)
      THEN MAKE_DATE(EXTRACT(YEAR FROM p_date)::INT, 4, 6)
    ELSE MAKE_DATE(EXTRACT(YEAR FROM p_date)::INT - 1, 4, 6)
  END;
$$;

-- The last date a claim may include a donation received on p_date: four years
-- from the end of its tax year.
CREATE OR REPLACE FUNCTION public.gift_aid_claimable_until(p_date DATE)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT (public.gift_aid_tax_year_start(p_date) + INTERVAL '5 years')::DATE;
$$;

-- The tiered benefit limit: a quarter of the first £100, a twentieth of the
-- rest, capped at £2,500. Applied as a cliff — above it the whole donation
-- fails, because above it the payment was never a gift.
CREATE OR REPLACE FUNCTION public.gift_aid_benefit_limit_pence(p_amount_pence BIGINT)
RETURNS BIGINT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT LEAST(
    FLOOR(
      LEAST(p_amount_pence, 10000) * 0.25
      + GREATEST(p_amount_pence - 10000, 0) * 0.05
    )::BIGINT,
    250000::BIGINT
  );
$$;

-- Note the absence of a CHECK enforcing the benefit limit on donation_payments.
-- A donation carrying too much benefit is a real payment that really happened
-- and must still be recorded; it is simply not claimable. Refusing to store it
-- would push the record somewhere the claim assessment cannot see it, which is
-- the opposite of what the limit is for.

ALTER TABLE public.gift_aid_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_aid_declarations_self_read ON public.gift_aid_declarations;
CREATE POLICY gift_aid_declarations_self_read
  ON public.gift_aid_declarations
  FOR SELECT
  USING (donor_id = auth.uid());

DROP POLICY IF EXISTS donation_payments_self_read ON public.donation_payments;
CREATE POLICY donation_payments_self_read
  ON public.donation_payments
  FOR SELECT
  USING (donor_id = auth.uid());

COMMENT ON COLUMN public.gift_aid_declarations.cancelled_on IS
  'Not retrospective. Donations received before this date remain claimable.';
COMMENT ON COLUMN public.gift_aid_declarations.invalidated_on IS
  'A declaration that was never valid. Unlike cancellation, this reverses claims already made.';
COMMENT ON COLUMN public.gift_aid_claim_lines.basic_rate_percent IS
  'The rate actually applied, kept so a rate change cannot silently re-rate a historic claim.';
