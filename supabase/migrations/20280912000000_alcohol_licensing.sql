-- Issue #5161: Alcohol Licensing Compliance
--
-- What is stored here is the licence and its conditions, rather than the
-- two-page annex nobody has read since the last review hearing, and the
-- Temporary Event Notices with the counters they consume.
--
-- Permitted hours are held as minutes from midnight with an end that may run
-- past 1440, because 11:00 to 02:00 is one period and not two. Stored as a pair
-- of clock times, the event running 22:00 to 01:00 reads as being outside the
-- period it is plainly inside, and the one starting at 03:00 reads as being
-- inside it.
--
-- Capacity lives in three places on purpose: the licence condition here, the
-- venue's physical capacity, and the allocation put on sale. The smallest binds
-- and none of the three is derivable from the others.

CREATE TABLE IF NOT EXISTS public.premises_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premises_id UUID NOT NULL UNIQUE,
  reference TEXT NOT NULL UNIQUE,
  licensing_authority TEXT NOT NULL,
  granted_on DATE NOT NULL,
  surrendered_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (surrendered_on IS NULL OR surrendered_on > granted_on)
);

-- start_day is the day the period *begins*; end_minute may exceed 1440, which
-- is how a period that runs into the small hours is expressed without splitting
-- it into two rows that no longer know they were one period.
CREATE TABLE IF NOT EXISTS public.licence_permitted_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id UUID NOT NULL REFERENCES public.premises_licences(id) ON DELETE CASCADE,
  start_day SMALLINT NOT NULL CHECK (start_day BETWEEN 0 AND 6),
  start_minute SMALLINT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute SMALLINT NOT NULL CHECK (end_minute BETWEEN 1 AND 2879),
  licensable_activity TEXT NOT NULL DEFAULT 'SALE_OF_ALCOHOL',
  CHECK (end_minute > start_minute)
);

CREATE INDEX IF NOT EXISTS licence_permitted_periods_licence_idx
  ON public.licence_permitted_periods (licence_id, start_day);

-- Conditions are typed rather than free text, because a condition nobody can
-- evaluate is a condition that gets breached.
CREATE TABLE IF NOT EXISTS public.licence_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id UUID NOT NULL REFERENCES public.premises_licences(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('CAPACITY', 'DPS_PRESENT', 'DOOR_SUPERVISORS', 'ACTIVITY_RESTRICTION')
  ),
  wording TEXT NOT NULL,
  max_occupancy INTEGER CHECK (max_occupancy IS NULL OR max_occupancy > 0),
  threshold_headcount INTEGER CHECK (threshold_headcount IS NULL OR threshold_headcount >= 0),
  one_per_headcount INTEGER CHECK (one_per_headcount IS NULL OR one_per_headcount > 0),
  restricted_activity TEXT,
  not_after_minute SMALLINT CHECK (not_after_minute IS NULL OR not_after_minute BETWEEN 0 AND 2879),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Each kind carries exactly the columns it needs. A door supervisor condition
  -- without a ratio is a condition that silently requires nobody.
  CHECK (kind <> 'CAPACITY' OR max_occupancy IS NOT NULL),
  CHECK (
    kind <> 'DOOR_SUPERVISORS'
    OR (threshold_headcount IS NOT NULL AND one_per_headcount IS NOT NULL)
  ),
  CHECK (
    kind <> 'ACTIVITY_RESTRICTION'
    OR (restricted_activity IS NOT NULL AND not_after_minute IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS licence_conditions_licence_idx
  ON public.licence_conditions (licence_id, kind);

-- A licence held by somebody on holiday is not a DPS on the premises, so the
-- holder and the validity are both here and the roster is checked against them.
CREATE TABLE IF NOT EXISTS public.personal_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  issuing_authority TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS personal_licences_holder_idx
  ON public.personal_licences (holder_id, valid_to DESC);

CREATE TABLE IF NOT EXISTS public.event_licensing_roster (
  event_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DPS', 'DOOR_SUPERVISOR', 'BAR_STAFF')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, person_id, role)
);

-- The counters. A notice is a range because both the number of notices and the
-- number of days they cover are separately limited, and counting one without
-- the other produces a different wrong answer each time.
CREATE TABLE IF NOT EXISTS public.temporary_event_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  premises_id UUID NOT NULL,
  event_id UUID,
  given_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- Denormalised deliberately: the ceiling that applied is the one that applied
  -- when the notice was given, not the one that applies when it is counted.
  giver_held_personal_licence BOOLEAN NOT NULL,
  covered_days DATERANGE NOT NULL,
  given_on DATE NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT isempty(covered_days))
);

CREATE INDEX IF NOT EXISTS temporary_event_notices_premises_idx
  ON public.temporary_event_notices (premises_id, given_on)
  WHERE withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS temporary_event_notices_giver_idx
  ON public.temporary_event_notices (given_by, given_on)
  WHERE withdrawn_at IS NULL;

-- The allowance is configuration rather than constants in a service, because it
-- is set by statute and changes without the code changing.
CREATE TABLE IF NOT EXISTS public.ten_allowance_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL UNIQUE,
  notices_per_premises_per_year SMALLINT NOT NULL CHECK (notices_per_premises_per_year > 0),
  days_per_premises_per_year SMALLINT NOT NULL CHECK (days_per_premises_per_year > 0),
  max_days_per_notice SMALLINT NOT NULL CHECK (max_days_per_notice > 0),
  notices_per_personal_licence_holder_per_year SMALLINT NOT NULL CHECK (
    notices_per_personal_licence_holder_per_year > 0
  ),
  notices_per_other_giver_per_year SMALLINT NOT NULL CHECK (notices_per_other_giver_per_year > 0),
  minimum_interval_days SMALLINT NOT NULL CHECK (minimum_interval_days >= 0),
  -- A holder ceiling below the general one would mean holding a licence made
  -- somebody worse off, which is never what the statute says.
  CHECK (notices_per_personal_licence_holder_per_year >= notices_per_other_giver_per_year)
);

-- The determination is stored because an amendment is a fresh question and the
-- one asked afterwards is "what were we told when we published it".
CREATE TABLE IF NOT EXISTS public.event_licensing_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  licence_id UUID REFERENCES public.premises_licences(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  route TEXT NOT NULL CHECK (route IN ('PREMISES_LICENCE', 'TEN_REQUIRED', 'UNLICENSED')),
  lawful BOOLEAN NOT NULL,
  binding_capacity INTEGER NOT NULL CHECK (binding_capacity >= 0),
  binding_capacity_source TEXT NOT NULL CHECK (
    binding_capacity_source IN ('LICENCE_CONDITION', 'PHYSICAL_CAPACITY', 'TICKET_ALLOCATION')
  ),
  assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS event_licensing_assessments_event_idx
  ON public.event_licensing_assessments (event_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS public.event_licensing_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.event_licensing_assessments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'OUTSIDE_PERMITTED_HOURS',
      'CAPACITY_EXCEEDED',
      'NO_DPS_ON_PREMISES',
      'DPS_LICENCE_NOT_IN_FORCE',
      'INSUFFICIENT_DOOR_SUPERVISORS',
      'ACTIVITY_RESTRICTED',
      'NO_LICENCE_FOR_PREMISES'
    )
  ),
  condition_id UUID REFERENCES public.licence_conditions(id) ON DELETE SET NULL,
  detail TEXT NOT NULL,
  remedy TEXT NOT NULL
);

-- A lawful assessment with breaches attached is a contradiction, and the state
-- most likely to be reached by an amendment that only half re-ran.
CREATE OR REPLACE FUNCTION public.reject_breaches_on_lawful_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_lawful BOOLEAN;
BEGIN
  SELECT lawful INTO v_lawful
  FROM public.event_licensing_assessments
  WHERE id = NEW.assessment_id;

  IF v_lawful THEN
    RAISE EXCEPTION 'Assessment % is recorded as lawful and cannot carry a breach', NEW.assessment_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_licensing_breaches_consistent ON public.event_licensing_breaches;
CREATE TRIGGER event_licensing_breaches_consistent
  BEFORE INSERT OR UPDATE ON public.event_licensing_breaches
  FOR EACH ROW EXECUTE FUNCTION public.reject_breaches_on_lawful_assessment();

-- Days covered by the notices at a premises in a calendar year, counting both
-- the first day and the last of each.
CREATE OR REPLACE FUNCTION public.ten_days_used(p_premises_id UUID, p_year INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    SUM(upper(covered_days) - lower(covered_days)),
    0
  )::INTEGER
  FROM public.temporary_event_notices
  WHERE premises_id = p_premises_id
    AND withdrawn_at IS NULL
    AND EXTRACT(YEAR FROM lower(covered_days)) = p_year;
$$;

ALTER TABLE public.premises_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licence_permitted_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licence_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_licensing_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_event_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ten_allowance_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_licensing_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_licensing_breaches ENABLE ROW LEVEL SECURITY;

-- Permitted hours and the conditions attached to a licence are public documents
-- and an organiser needs them before they plan anything. Who holds a personal
-- licence is not.
CREATE POLICY premises_licences_public_read ON public.premises_licences FOR SELECT USING (TRUE);
CREATE POLICY licence_permitted_periods_public_read
  ON public.licence_permitted_periods FOR SELECT USING (TRUE);
CREATE POLICY licence_conditions_public_read ON public.licence_conditions FOR SELECT USING (TRUE);
CREATE POLICY ten_allowance_limits_public_read ON public.ten_allowance_limits FOR SELECT USING (TRUE);
CREATE POLICY personal_licences_own_read
  ON public.personal_licences FOR SELECT
  USING (holder_id = auth.uid());
