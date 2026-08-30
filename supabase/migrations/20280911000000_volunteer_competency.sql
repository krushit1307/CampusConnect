-- Issue #5160: Volunteer Competency Currency
--
-- What is stored here is the award and the rule, not the conclusion. Holding a
-- certificate and being current are different facts: the certificate has an
-- award date, and the currency it confers has a validity period, a grace period
-- and sometimes a refresher booked for next Tuesday. A boolean "qualified"
-- column records the first fact and answers questions about the second one
-- wrongly, which is how somebody works a year past their safeguarding renewal.
--
-- Currency is therefore always derived as at a date. Rosters are built weeks
-- ahead, and the question is never "is this person current now" but "will they
-- be current on the night".

CREATE TABLE IF NOT EXISTS public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  validity_months SMALLINT NOT NULL CHECK (validity_months > 0),
  -- Zero means currency stops dead on expiry. Non-zero is a real arrangement
  -- for a real competency, not a default.
  grace_days SMALLINT NOT NULL DEFAULT 0 CHECK (grace_days >= 0),
  supervisable BOOLEAN NOT NULL DEFAULT FALSE,
  -- How many lapsed holders one current holder can supervise at once. Without a
  -- bound, a shift is nominally compliant with one current person notionally
  -- supervising nine lapsed ones.
  supervision_ratio SMALLINT NOT NULL DEFAULT 0 CHECK (supervision_ratio >= 0),
  -- Whether supervised holders count towards a requirement's floor. False for
  -- the competencies where the floor exists so that somebody on site holds it.
  supervision_covers_floor BOOLEAN NOT NULL DEFAULT FALSE,
  safety_critical BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A supervisable competency with a ratio of zero would silently supervise
  -- nobody, which reads as a configuration that works.
  CHECK (NOT supervisable OR supervision_ratio > 0),
  CHECK (supervisable OR NOT supervision_covers_floor)
);

CREATE TABLE IF NOT EXISTS public.competency_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  awarded_on DATE NOT NULL,
  awarding_body TEXT,
  certificate_reference TEXT,
  evidence_url TEXT,
  -- A self-declared certificate nobody has looked at is not the same fact as
  -- one a member of staff has seen, and roles differ in which they accept.
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (awarded_on <= CURRENT_DATE),
  CHECK ((verified_by IS NULL) = (verified_at IS NULL))
);

-- The latest award is the one that counts, so lookups are by holder and
-- competency in descending award order.
CREATE INDEX IF NOT EXISTS competency_awards_holder_idx
  ON public.competency_awards (volunteer_id, competency_id, awarded_on DESC);

-- A refresher sat before the shift restores currency from the day it is taken,
-- which is the whole reason it was booked. A booking after the shift does not.
CREATE TABLE IF NOT EXISTS public.competency_refresher_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  provider TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS competency_refresher_bookings_lookup_idx
  ON public.competency_refresher_bookings (volunteer_id, competency_id, scheduled_for DESC)
  WHERE cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.volunteer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A floor and a ratio at once. One first aider per hundred attendees, minimum
-- one, and the minimum does not scale down for a small crowd.
CREATE TABLE IF NOT EXISTS public.role_competency_requirements (
  role_id UUID NOT NULL REFERENCES public.volunteer_roles(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  minimum_count SMALLINT NOT NULL DEFAULT 1 CHECK (minimum_count >= 1),
  -- NULL where the requirement does not scale with the size of the event.
  one_per_attendees INTEGER CHECK (one_per_attendees IS NULL OR one_per_attendees > 0),
  accepts_unverified_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  supervision_permitted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id, competency_id)
);

CREATE TABLE IF NOT EXISTS public.volunteer_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.volunteer_roles(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  expected_attendance INTEGER NOT NULL DEFAULT 0 CHECK (expected_attendance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS volunteer_shifts_upcoming_idx
  ON public.volunteer_shifts (starts_at);

CREATE TABLE IF NOT EXISTS public.volunteer_shift_assignments (
  shift_id UUID NOT NULL REFERENCES public.volunteer_shifts(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Supervisors are the ones whose currency creates supervision capacity, so
  -- the flag is on the assignment rather than on the person.
  as_supervisor BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shift_id, volunteer_id)
);

-- The determination is kept because the question asked after an incident is not
-- "is this shift compliant now" but "what did the roster say on the night".
CREATE TABLE IF NOT EXISTS public.shift_competency_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.volunteer_shifts(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  required_count SMALLINT NOT NULL CHECK (required_count >= 0),
  outright_count SMALLINT NOT NULL CHECK (outright_count >= 0),
  supervised_count SMALLINT NOT NULL CHECK (supervised_count >= 0),
  unverified_count SMALLINT NOT NULL CHECK (unverified_count >= 0),
  shortfall SMALLINT NOT NULL CHECK (shortfall >= 0),
  remedy TEXT NOT NULL CHECK (
    remedy IN ('NONE', 'VERIFY_EVIDENCE', 'ADD_SUPERVISOR', 'BOOK_REFRESHER', 'ROSTER_CURRENT_HOLDER')
  ),
  remedy_detail TEXT NOT NULL,
  severity SMALLINT NOT NULL CHECK (severity >= 0),
  -- A met requirement with a remedy attached, or a shortfall with none, means
  -- the finding was written by something that had stopped agreeing with itself.
  CHECK ((shortfall = 0) = (remedy = 'NONE')),
  UNIQUE (shift_id, competency_id, assessed_at)
);

CREATE INDEX IF NOT EXISTS shift_competency_findings_gaps_idx
  ON public.shift_competency_findings (severity DESC, assessed_at DESC)
  WHERE shortfall > 0;

-- Currency as at a date, in the database, so a roster query does not have to
-- pull every award into the application to find out who is short.
CREATE OR REPLACE FUNCTION public.competency_currency_status(
  p_volunteer_id UUID,
  p_competency_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_validity_months SMALLINT;
  v_grace_days SMALLINT;
  v_awarded_on DATE;
  v_refresher TIMESTAMPTZ;
  v_expires_on TIMESTAMPTZ;
BEGIN
  SELECT validity_months, grace_days
  INTO v_validity_months, v_grace_days
  FROM public.competencies
  WHERE id = p_competency_id;

  IF v_validity_months IS NULL THEN
    RAISE EXCEPTION 'Unknown competency %', p_competency_id;
  END IF;

  SELECT MAX(scheduled_for) INTO v_refresher
  FROM public.competency_refresher_bookings
  WHERE volunteer_id = p_volunteer_id
    AND competency_id = p_competency_id
    AND cancelled_at IS NULL
    AND scheduled_for <= p_as_of;

  IF v_refresher IS NOT NULL
     AND p_as_of < v_refresher + make_interval(months => v_validity_months) THEN
    RETURN 'CURRENT';
  END IF;

  SELECT MAX(awarded_on) INTO v_awarded_on
  FROM public.competency_awards
  WHERE volunteer_id = p_volunteer_id
    AND competency_id = p_competency_id;

  IF v_awarded_on IS NULL THEN
    RETURN 'NEVER_HELD';
  END IF;

  v_expires_on := v_awarded_on::TIMESTAMPTZ + make_interval(months => v_validity_months);

  IF p_as_of < v_expires_on THEN
    RETURN 'CURRENT';
  ELSIF v_grace_days > 0 AND p_as_of < v_expires_on + make_interval(days => v_grace_days) THEN
    RETURN 'IN_GRACE';
  END IF;

  RETURN 'LAPSED';
END;
$$;

ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_refresher_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_competency_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_competency_findings ENABLE ROW LEVEL SECURITY;

-- What a role requires is reference data a volunteer needs before they sign up
-- for a shift. What any particular volunteer holds is not.
CREATE POLICY competencies_public_read ON public.competencies FOR SELECT USING (TRUE);
CREATE POLICY volunteer_roles_public_read ON public.volunteer_roles FOR SELECT USING (TRUE);
CREATE POLICY role_competency_requirements_public_read
  ON public.role_competency_requirements FOR SELECT USING (TRUE);

-- A volunteer can see their own record, including the certificate nobody has
-- verified yet, because chasing that verification is their job as much as ours.
CREATE POLICY competency_awards_own_read
  ON public.competency_awards FOR SELECT
  USING (volunteer_id = auth.uid());
CREATE POLICY competency_refresher_bookings_own_read
  ON public.competency_refresher_bookings FOR SELECT
  USING (volunteer_id = auth.uid());
