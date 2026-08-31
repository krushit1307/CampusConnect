-- Issue #4922: Radio Mic Frequency Coordination
--
-- Frequencies are stored as integer kilohertz. Storing megahertz as a float
-- puts 606.1 at 606.0999999999999, which makes the exact-hit intermodulation
-- test unreliable in the one case it exists to catch.
--
-- A plan is only correct relative to everything else live at the same time in
-- the same venue, so committed assignments are readable across plans while
-- draft assignments are not.

CREATE TABLE IF NOT EXISTS public.rf_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('EXEMPT', 'LICENSED')),
  start_khz INTEGER NOT NULL,
  end_khz INTEGER NOT NULL,
  -- Receivers tune on a grid. A frequency off the grid is not selectable.
  step_khz INTEGER NOT NULL CHECK (step_khz > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_khz > start_khz)
);

-- A licence belongs to a venue and a band over a window. It is not a property
-- of any transmitter, which is why the same handheld is compliant in one part
-- of the band and an offence in another.
CREATE TABLE IF NOT EXISTS public.rf_venue_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  band_id UUID NOT NULL REFERENCES public.rf_bands(id) ON DELETE CASCADE,
  licence_reference TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  issued_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS public.rf_transmitters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  owner_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  -- What the pack can actually tune to. Clean, legal and untunable is not a
  -- frequency, so this is a hard constraint rather than a hint.
  tuning_start_khz INTEGER NOT NULL,
  tuning_end_khz INTEGER NOT NULL,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tuning_end_khz >= tuning_start_khz)
);

CREATE TABLE IF NOT EXISTS public.rf_frequency_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SIGNED_OFF', 'VOIDED')),
  -- The signature refers to a specific set of channels. Retuning clears it.
  signed_off_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_off_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end > window_start),
  CHECK (
    (status = 'SIGNED_OFF' AND signed_off_by IS NOT NULL AND signed_off_at IS NOT NULL)
    OR (status <> 'SIGNED_OFF' AND signed_off_by IS NULL AND signed_off_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.rf_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.rf_frequency_plans(id) ON DELETE CASCADE,
  transmitter_id UUID NOT NULL REFERENCES public.rf_transmitters(id) ON DELETE RESTRICT,
  band_id UUID NOT NULL REFERENCES public.rf_bands(id) ON DELETE RESTRICT,
  frequency_khz INTEGER NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One transmitter cannot be on two frequencies in the same plan.
  UNIQUE (plan_id, transmitter_id),
  UNIQUE (plan_id, frequency_khz)
);

-- Refusals are kept so a coordinator can see why a channel they expected to be
-- free was not. "610.000 is unavailable" sends somebody hunting; the recorded
-- pair tells them which of three channels to move.
CREATE TABLE IF NOT EXISTS public.rf_assignment_refusals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.rf_frequency_plans(id) ON DELETE CASCADE,
  transmitter_id UUID REFERENCES public.rf_transmitters(id) ON DELETE SET NULL,
  requested_khz INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (
    outcome IN (
      'REFUSED_UNKNOWN_TRANSMITTER',
      'REFUSED_TRANSMITTER_ALREADY_ASSIGNED',
      'REFUSED_OUT_OF_TUNING_RANGE',
      'REFUSED_OUTSIDE_ANY_BAND',
      'REFUSED_OFF_STEP',
      'REFUSED_UNLICENSED_BAND',
      'REFUSED_CO_CHANNEL',
      'REFUSED_ADJACENT_CHANNEL',
      'REFUSED_INTERMODULATION',
      'REFUSED_PLAN_NOT_DRAFT'
    )
  ),
  -- Populated for intermodulation refusals: the pair that made the product and
  -- the channel it lands on.
  product_khz INTEGER,
  source_a_khz INTEGER,
  source_b_khz INTEGER,
  victim_khz INTEGER,
  detail TEXT NOT NULL,
  refused_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rf_licences_lookup
  ON public.rf_venue_licences(venue_id, band_id, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_rf_plans_venue_window
  ON public.rf_frequency_plans(venue_id, window_start, window_end)
  WHERE status = 'SIGNED_OFF';

CREATE INDEX IF NOT EXISTS idx_rf_assignments_plan
  ON public.rf_plan_assignments(plan_id, frequency_khz);

CREATE INDEX IF NOT EXISTS idx_rf_refusals_plan
  ON public.rf_assignment_refusals(plan_id, refused_at DESC);

-- A view of everything in the air under a committed plan. Draft plans are
-- excluded on purpose: a draft is somebody thinking out loud, and reserving
-- spectrum against it would let an abandoned plan block a real one.
CREATE OR REPLACE VIEW public.rf_committed_channels AS
SELECT
  p.id AS plan_id,
  p.venue_id,
  p.window_start,
  p.window_end,
  a.transmitter_id,
  t.label AS transmitter_label,
  a.band_id,
  a.frequency_khz
FROM public.rf_frequency_plans p
JOIN public.rf_plan_assignments a ON a.plan_id = p.id
JOIN public.rf_transmitters t ON t.id = a.transmitter_id
WHERE p.status = 'SIGNED_OFF';

ALTER TABLE public.rf_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_venue_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_transmitters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_frequency_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rf_assignment_refusals ENABLE ROW LEVEL SECURITY;

-- Band and licence definitions are reference data. Everybody planning an event
-- needs to read them; nobody but an administrator may change them.
DROP POLICY IF EXISTS "Bands are readable by authenticated users" ON public.rf_bands;
CREATE POLICY "Bands are readable by authenticated users"
  ON public.rf_bands FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Licences are readable by authenticated users" ON public.rf_venue_licences;
CREATE POLICY "Licences are readable by authenticated users"
  ON public.rf_venue_licences FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Transmitters are readable by authenticated users" ON public.rf_transmitters;
CREATE POLICY "Transmitters are readable by authenticated users"
  ON public.rf_transmitters FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Plan owners can view their plans" ON public.rf_frequency_plans;
CREATE POLICY "Plan owners can view their plans"
  ON public.rf_frequency_plans FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    -- Committed plans are visible to every coordinator, because a plan that
    -- nobody else can see cannot be coordinated against.
    OR status = 'SIGNED_OFF'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Plan owners can draft plans" ON public.rf_frequency_plans;
CREATE POLICY "Plan owners can draft plans"
  ON public.rf_frequency_plans FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status = 'DRAFT');

DROP POLICY IF EXISTS "Assignments follow their plan" ON public.rf_plan_assignments;
CREATE POLICY "Assignments follow their plan"
  ON public.rf_plan_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rf_frequency_plans p
      WHERE p.id = rf_plan_assignments.plan_id
        AND (
          p.created_by = auth.uid()
          OR p.status = 'SIGNED_OFF'
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid() AND pr.role::TEXT IN ('admin', 'system_admin', 'owner')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Refusals are visible to the plan owner" ON public.rf_assignment_refusals;
CREATE POLICY "Refusals are visible to the plan owner"
  ON public.rf_assignment_refusals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rf_frequency_plans p
      WHERE p.id = rf_assignment_refusals.plan_id AND p.created_by = auth.uid()
    )
  );

-- Assignment, sign-off and refusal recording all run server side, because each
-- one depends on the state of every other plan in the venue.
REVOKE INSERT, UPDATE, DELETE ON public.rf_bands FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rf_venue_licences FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rf_transmitters FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.rf_frequency_plans FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rf_plan_assignments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rf_assignment_refusals FROM anon, authenticated;
REVOKE ALL ON public.rf_committed_channels FROM anon;
