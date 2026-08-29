-- Issue #5159: Event Insurance Cover Adequacy
--
-- What is stored here is the schedule of activities the insurer has agreed to
-- pay for, rather than the PDF the finance officer renews each September. Cover
-- is per-activity: an event is a bundle of a bar, a band, an inflatable and
-- somebody abseiling off the sports hall, and the event is covered only if
-- every one of those is.
--
-- Amounts are BIGINT pence throughout. Limits of indemnity are compared, summed
-- and subtracted, and doing that in a floating-point money column produces a
-- shortfall of a hundredth of a penny on an event that is fully covered.
--
-- Periods are half-open. A policy running to 31 August and an event on 3
-- September are the case this table exists to catch, and a renewal beginning
-- the day the previous policy ends must not read as two policies in force.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Activities are classified because the insurer classifies them. The hazard
-- band is what decides whether an unlisted activity can be added by endorsement
-- for a premium or cannot be bought at all.
CREATE TABLE IF NOT EXISTS public.insurance_activity_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hazard_band SMALLINT NOT NULL CHECK (hazard_band BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  insurer TEXT NOT NULL,
  -- Half-open, so a renewal starting on the day the previous policy ends does
  -- not overlap it.
  period_of_cover TSTZRANGE NOT NULL,
  per_claim_limit_pence BIGINT NOT NULL CHECK (per_claim_limit_pence > 0),
  aggregate_limit_pence BIGINT NOT NULL CHECK (aggregate_limit_pence > 0),
  -- The highest hazard band the insurer will consider adding by endorsement.
  max_endorsable_band SMALLINT NOT NULL CHECK (max_endorsable_band BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT isempty(period_of_cover)),
  CHECK (aggregate_limit_pence >= per_claim_limit_pence),
  -- Two policies in force at once is not a redundancy, it is a data error that
  -- would make "the policy in force on the event date" ambiguous.
  EXCLUDE USING GIST (period_of_cover WITH &&)
);

-- The schedule is the list of activities the insurer has agreed to. An inner
-- limit is the insurer agreeing to a smaller number for one class than the
-- headline figure on the certificate.
CREATE TABLE IF NOT EXISTS public.policy_schedule_items (
  policy_id UUID NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  activity_class_id UUID NOT NULL REFERENCES public.insurance_activity_classes(id) ON DELETE CASCADE,
  inner_limit_pence BIGINT CHECK (inner_limit_pence IS NULL OR inner_limit_pence > 0),
  PRIMARY KEY (policy_id, activity_class_id)
);

-- An exclusion is written to defeat exactly the argument that the activity was
-- obviously covered, so the wording is stored rather than a flag.
CREATE TABLE IF NOT EXISTS public.policy_exclusions (
  policy_id UUID NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  activity_class_id UUID NOT NULL REFERENCES public.insurance_activity_classes(id) ON DELETE CASCADE,
  wording TEXT NOT NULL,
  PRIMARY KEY (policy_id, activity_class_id)
);

-- An unlisted activity is not a refused one. It has not been asked about, and
-- the endorsement is what asking looks like when the answer is yes.
CREATE TABLE IF NOT EXISTS public.policy_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  activity_class_id UUID NOT NULL REFERENCES public.insurance_activity_classes(id) ON DELETE CASCADE,
  effective_period TSTZRANGE NOT NULL,
  limit_pence BIGINT NOT NULL CHECK (limit_pence > 0),
  premium_pence BIGINT NOT NULL CHECK (premium_pence >= 0),
  purchased_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT isempty(effective_period))
);

CREATE INDEX IF NOT EXISTS policy_endorsements_lookup_idx
  ON public.policy_endorsements USING GIST (effective_period);

-- Claims are here for one reason: they erode the aggregate. A claim in November
-- is why an event in March is uncoverable, and no per-claim check will find it.
CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  incurred_at TIMESTAMPTZ NOT NULL,
  amount_incurred_pence BIGINT NOT NULL CHECK (amount_incurred_pence >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS insurance_claims_erosion_idx
  ON public.insurance_claims (policy_id, incurred_at);

-- A contractor's own cover discharges the risk only where it is in force on the
-- day, at a high enough limit, and names the union. Two out of three transfers
-- the whole risk back without anybody noticing, which is why all three are
-- columns rather than an assumption.
CREATE TABLE IF NOT EXISTS public.contractor_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  contractor_name TEXT NOT NULL,
  validity TSTZRANGE NOT NULL,
  limit_pence BIGINT NOT NULL CHECK (limit_pence > 0),
  names_union_as_interested BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_url TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT isempty(validity))
);

CREATE TABLE IF NOT EXISTS public.contractor_certificate_classes (
  certificate_id UUID NOT NULL REFERENCES public.contractor_certificates(id) ON DELETE CASCADE,
  activity_class_id UUID NOT NULL REFERENCES public.insurance_activity_classes(id) ON DELETE CASCADE,
  PRIMARY KEY (certificate_id, activity_class_id)
);

-- Venue and third-party minimums bind independently of the insurer. A NULL
-- class or venue means the requirement applies to everything, which is how a
-- hire agreement is actually written.
CREATE TABLE IF NOT EXISTS public.cover_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  activity_class_id UUID REFERENCES public.insurance_activity_classes(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.campus_venues(id) ON DELETE CASCADE,
  minimum_cover_pence BIGINT NOT NULL CHECK (minimum_cover_pence > 0),
  imposed_from DATE,
  imposed_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (imposed_to IS NULL OR imposed_from IS NULL OR imposed_to > imposed_from)
);

CREATE INDEX IF NOT EXISTS cover_requirements_venue_idx
  ON public.cover_requirements (venue_id)
  WHERE venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cover_requirements_class_idx
  ON public.cover_requirements (activity_class_id)
  WHERE activity_class_id IS NOT NULL;

-- The bundle. One row per activity at an event, because the event is covered
-- only if each of these is and the failing one has to be nameable.
CREATE TABLE IF NOT EXISTS public.event_insured_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  activity_class_id UUID NOT NULL REFERENCES public.insurance_activity_classes(id) ON DELETE RESTRICT,
  contractor_id UUID,
  stated_requirement_pence BIGINT CHECK (stated_requirement_pence IS NULL OR stated_requirement_pence > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULLS NOT DISTINCT because an in-house activity has no contractor, and the
  -- default treatment would let the same activity be recorded against an event
  -- twice — which doubles its determination, its entry in the blocking list and
  -- its contribution to the shortfall.
  UNIQUE NULLS NOT DISTINCT (event_id, activity_class_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS event_insured_activities_event_idx
  ON public.event_insured_activities (event_id);

-- The determination is stored rather than recomputed on demand, because the
-- question asked six months later is not "is it covered now" but "what were we
-- told when we booked it".
CREATE TABLE IF NOT EXISTS public.event_cover_determinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.event_insured_activities(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (
    status IN (
      'COVERED',
      'COVERED_BY_ENDORSEMENT',
      'COVERED_BY_CONTRACTOR',
      'ENDORSABLE',
      'LIMIT_SHORTFALL',
      'AGGREGATE_SHORTFALL',
      'EXCLUDED',
      'UNINSURED'
    )
  ),
  required_cover_pence BIGINT NOT NULL CHECK (required_cover_pence >= 0),
  available_cover_pence BIGINT NOT NULL CHECK (available_cover_pence >= 0),
  shortfall_pence BIGINT NOT NULL CHECK (shortfall_pence >= 0),
  binding_requirement TEXT NOT NULL,
  remedy_kind TEXT NOT NULL CHECK (
    remedy_kind IN (
      'NONE',
      'PURCHASE_ENDORSEMENT',
      'INCREASE_LIMIT',
      'OBTAIN_CONTRACTOR_CERTIFICATE',
      'RENEW_CONTRACTOR_CERTIFICATE',
      'PLACE_STANDALONE_COVER',
      'NONE_AVAILABLE'
    )
  ),
  remedy_detail TEXT NOT NULL,
  severity SMALLINT NOT NULL CHECK (severity >= 0),
  reason TEXT NOT NULL,
  -- A shortfall without a gap, or a gap without a shortfall figure, means the
  -- determination was written by something that had stopped agreeing with
  -- itself.
  CHECK ((shortfall_pence > 0) = (available_cover_pence < required_cover_pence))
);

CREATE INDEX IF NOT EXISTS event_cover_determinations_gaps_idx
  ON public.event_cover_determinations (severity DESC, assessed_at DESC)
  WHERE status NOT IN ('COVERED', 'COVERED_BY_ENDORSEMENT', 'COVERED_BY_CONTRACTOR');

-- A certificate marked as naming the union but never verified by anybody is the
-- state that makes the whole check worthless, so it is refused.
ALTER TABLE public.contractor_certificates
  DROP CONSTRAINT IF EXISTS contractor_certificates_named_cover_is_verified;
ALTER TABLE public.contractor_certificates
  ADD CONSTRAINT contractor_certificates_named_cover_is_verified
  CHECK (NOT names_union_as_interested OR verified_at IS NOT NULL);

ALTER TABLE public.insurance_activity_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_certificate_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_insured_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_cover_determinations ENABLE ROW LEVEL SECURITY;

-- The classification of activities and the minimums imposed by venues are what
-- an organiser needs before they book. The claims history is not.
CREATE POLICY insurance_activity_classes_public_read
  ON public.insurance_activity_classes FOR SELECT USING (TRUE);
CREATE POLICY cover_requirements_public_read
  ON public.cover_requirements FOR SELECT USING (TRUE);
CREATE POLICY event_insured_activities_public_read
  ON public.event_insured_activities FOR SELECT USING (TRUE);
