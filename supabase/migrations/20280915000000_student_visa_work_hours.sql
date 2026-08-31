-- Issue #5257: Student visa work-hour compliance across rotas
--
-- What is stored is the immigration status, the programme's own term calendar,
-- the right-to-work checks and the shifts. The weekly position is derived from
-- those, not stored, because a stored "hours this week" counter is wrong the
-- moment a shift is cancelled on another rota and is the thing that quietly
-- stops being maintained.
--
-- The term calendar hangs off the programme rather than the institution. A
-- student whose vacation starts a fortnight early is unrestricted in a week
-- where their coursemates are capped, and an institution-wide calendar cannot
-- represent that at all.

CREATE TABLE IF NOT EXISTS public.worker_immigration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('STUDENT_VISA', 'SHORT_TERM_STUDY', 'UNRESTRICTED')
  ),
  study_level TEXT NOT NULL CHECK (study_level IN ('DEGREE_OR_ABOVE', 'BELOW_DEGREE')),
  -- Status changes; the history is what an audit asks for. Superseding rather
  -- than updating keeps the position as at any past shift recoverable.
  effective_from DATE NOT NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_immigration_status_current_idx
  ON public.worker_immigration_status (worker_id)
  WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS public.programme_term_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TERM', 'VACATION')),
  starts_on TIMESTAMPTZ NOT NULL,
  -- Exclusive. A period ending on the 1st does not include the 1st, which
  -- removes the off-by-one that otherwise appears at every boundary.
  ends_on TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'ACADEMIC_REGISTRY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE INDEX IF NOT EXISTS programme_term_periods_lookup_idx
  ON public.programme_term_periods (programme_id, starts_on, ends_on);

-- Overlapping periods for one programme would make "is this term time" depend
-- on row order, so they are excluded outright.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.programme_term_periods
  DROP CONSTRAINT IF EXISTS programme_term_periods_no_overlap;

ALTER TABLE public.programme_term_periods
  ADD CONSTRAINT programme_term_periods_no_overlap
  EXCLUDE USING gist (
    programme_id WITH =,
    tstzrange(starts_on, ends_on, '[)') WITH &&
  );

CREATE TABLE IF NOT EXISTS public.right_to_work_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('PASSPORT', 'BIOMETRIC_RESIDENCE_PERMIT', 'SHARE_CODE', 'VISA_VIGNETTE')
  ),
  -- The date the check was actually performed, not the date it was typed in.
  checked_on DATE NOT NULL,
  checked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- Null for evidence that does not expire, such as settled status.
  expires_on DATE,
  evidence_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_on IS NULL OR expires_on > checked_on)
);

CREATE INDEX IF NOT EXISTS right_to_work_checks_worker_idx
  ON public.right_to_work_checks (worker_id, checked_on DESC);

CREATE TABLE IF NOT EXISTS public.work_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- Separate cost centres inside one institution are still separate rotas, and
  -- the aggregate across them is the number that matters.
  cost_centre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, cost_centre)
);

CREATE TABLE IF NOT EXISTS public.work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.work_employers(id) ON DELETE RESTRICT,
  rota_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'ROSTERED' CHECK (state IN ('ROSTERED', 'WORKED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS work_shifts_worker_window_idx
  ON public.work_shifts (worker_id, starts_at)
  WHERE state <> 'CANCELLED';

-- Recorded, not derived, because the decision taken at the time is a fact even
-- once the underlying hours change. A week reassessed after a cancellation
-- should not erase the record that a shift was confirmed over the cap.
CREATE TABLE IF NOT EXISTS public.work_hour_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  restricted_hours NUMERIC(6, 3) NOT NULL CHECK (restricted_hours >= 0),
  cap_hours NUMERIC(6, 3) NOT NULL CHECK (cap_hours >= 0),
  excess_hours NUMERIC(6, 3) NOT NULL CHECK (excess_hours > 0),
  timing TEXT NOT NULL CHECK (timing IN ('ALREADY_WORKED', 'STILL_PREVENTABLE')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A breach already worked is a sponsor-duty decision; one still in the future
  -- is a rota to change. Only the first can be reported, so the column is
  -- constrained rather than left to the caller.
  reported_to_sponsor_at TIMESTAMPTZ,
  resolution_note TEXT,
  UNIQUE (worker_id, week_start),
  CHECK (reported_to_sponsor_at IS NULL OR timing = 'ALREADY_WORKED')
);

CREATE INDEX IF NOT EXISTS work_hour_breaches_unreported_idx
  ON public.work_hour_breaches (week_start)
  WHERE timing = 'ALREADY_WORKED' AND reported_to_sponsor_at IS NULL;

-- The term-time hours of an arbitrary window for a programme. Uncovered time
-- counts as term time: a missing calendar must not read as compliance.
CREATE OR REPLACE FUNCTION public.programme_restricted_hours(
  p_programme_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
) RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT GREATEST(
    0,
    EXTRACT(EPOCH FROM (p_to - p_from)) / 3600
    - COALESCE((
        SELECT SUM(
          EXTRACT(EPOCH FROM (
            LEAST(tp.ends_on, p_to) - GREATEST(tp.starts_on, p_from)
          )) / 3600
        )
        FROM public.programme_term_periods tp
        WHERE tp.programme_id = p_programme_id
          AND tp.kind = 'VACATION'
          AND tp.starts_on < p_to
          AND tp.ends_on > p_from
      ), 0)
  );
$$;

ALTER TABLE public.worker_immigration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.right_to_work_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_hour_breaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_immigration_status_self_read ON public.worker_immigration_status;
CREATE POLICY worker_immigration_status_self_read
  ON public.worker_immigration_status
  FOR SELECT
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS right_to_work_checks_self_read ON public.right_to_work_checks;
CREATE POLICY right_to_work_checks_self_read
  ON public.right_to_work_checks
  FOR SELECT
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS work_shifts_self_read ON public.work_shifts;
CREATE POLICY work_shifts_self_read
  ON public.work_shifts
  FOR SELECT
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS work_hour_breaches_self_read ON public.work_hour_breaches;
CREATE POLICY work_hour_breaches_self_read
  ON public.work_hour_breaches
  FOR SELECT
  USING (worker_id = auth.uid());

COMMENT ON TABLE public.programme_term_periods IS
  'Per-programme term calendar. The cap resolves against the student''s own programme, never an institution-wide calendar.';
COMMENT ON COLUMN public.work_hour_breaches.timing IS
  'ALREADY_WORKED is a sponsor-duty reporting decision; STILL_PREVENTABLE is a rota to change.';
COMMENT ON FUNCTION public.programme_restricted_hours(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Term-time hours in a window. Time the calendar does not cover counts as term time.';
