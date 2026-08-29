-- Migration: 20270904000000_driver_duty_hours.sql
-- Description: Schema and functions for Minibus Driver Duty Hours — duty period
--              folding, the split-break ordering rule, consumable allowances
--              over a rolling window, and the earliest lawful departure
--              (#4705).
--
-- The booking form treats the driver as a name field. The rules that govern
-- this are about accumulated fatigue, and every one of them is invisible to a
-- check that looks at a single trip.
--
-- That is the failure mode this schema is built against: a trip that is
-- perfectly legal in isolation is illegal because of the trip before it. A
-- driver returning at one in the morning and leaving again at eight has taken
-- seven hours of rest, and no check that looks only at the second booking will
-- ever notice. That is exactly the away fixture on Saturday followed by the
-- field trip on Sunday.
--
-- Two details reliably get implemented wrong and are pinned here. The split
-- break has an order — the shorter part first, the longer part second — and an
-- implementation that only totals the minutes passes the non-compliant
-- ordering every time. And duty is not driving: loading the kit, waiting at the
-- ground and sitting in the passenger seat as the second driver are all duty,
-- they do not count toward the driving limits, and they do count against the
-- rest.
--
-- The allowances are consumable over a rolling window rather than per trip. A
-- calendar-week implementation of a rolling-window rule is a bug that only
-- shows up on Mondays, so every window here is derived from the departure.

-- 1. The rule set, held as data so the numbers can be corrected without a
--    deploy and so that a historical assessment can say which rules it applied.
CREATE TABLE IF NOT EXISTS driver_duty_rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  effective_from TIMESTAMPTZ NOT NULL,
  max_continuous_driving_minutes INT NOT NULL DEFAULT 270,
  required_break_minutes INT NOT NULL DEFAULT 45,
  split_break_first_minutes INT NOT NULL DEFAULT 15,
  split_break_second_minutes INT NOT NULL DEFAULT 30,
  max_daily_driving_minutes INT NOT NULL DEFAULT 540,
  extended_daily_driving_minutes INT NOT NULL DEFAULT 600,
  extensions_per_window INT NOT NULL DEFAULT 2,
  minimum_daily_rest_minutes INT NOT NULL DEFAULT 660,
  reduced_daily_rest_minutes INT NOT NULL DEFAULT 540,
  reductions_per_window INT NOT NULL DEFAULT 3,
  rolling_window_days INT NOT NULL DEFAULT 7,
  -- The whole point of the split rule is that the shorter part comes first.
  -- A ruleset that inverts it would silently pass the ordering this feature
  -- exists to catch, so the constraint refuses to store one.
  CONSTRAINT ruleset_split_break_is_shorter_first CHECK (
    split_break_first_minutes <= split_break_second_minutes
  ),
  CONSTRAINT ruleset_reduced_rest_is_shorter CHECK (
    reduced_daily_rest_minutes <= minimum_daily_rest_minutes
  ),
  CONSTRAINT ruleset_extended_day_is_longer CHECK (
    max_daily_driving_minutes <= extended_daily_driving_minutes
  ),
  CONSTRAINT ruleset_window_is_positive CHECK (rolling_window_days > 0)
);

INSERT INTO driver_duty_rulesets (code, effective_from)
VALUES ('DEFAULT', '2000-01-01T00:00:00Z')
ON CONFLICT (code) DO NOTHING;

-- 2. Entitlement to drive. Checked against the journey, never the booking.
CREATE TABLE IF NOT EXISTS driver_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(16) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entitlement_is_valid_for_some_time CHECK (valid_until > valid_from),
  UNIQUE (driver_id, category, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_driver_entitlements_driver
  ON driver_entitlements (driver_id, valid_until DESC);

-- 3. Duty segments. Driving, other duty, and time in the passenger seat as the
--    second driver, which is duty and is not driving.
CREATE TABLE IF NOT EXISTS driver_duty_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES events(id) ON DELETE SET NULL,
  duty_kind VARCHAR(16) NOT NULL
    CHECK (duty_kind IN ('DRIVING', 'OTHER_DUTY', 'SECOND_DRIVER')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT duty_segment_ends_after_it_starts CHECK (ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_duty_segments_driver
  ON driver_duty_segments (driver_id, started_at);

-- A driver cannot be in two places at once, and an overlap would double-count
-- their driving in the fold below.
CREATE OR REPLACE FUNCTION duty_segments_do_not_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM driver_duty_segments s
  WHERE s.driver_id = NEW.driver_id
    AND s.id <> NEW.id
    AND s.started_at < NEW.ended_at
    AND s.ended_at > NEW.started_at;

  IF FOUND THEN
    RAISE EXCEPTION 'Driver % already has duty recorded overlapping % to %.',
      NEW.driver_id, NEW.started_at, NEW.ended_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duty_segments_no_overlap ON driver_duty_segments;
CREATE TRIGGER trg_duty_segments_no_overlap
BEFORE INSERT OR UPDATE ON driver_duty_segments
FOR EACH ROW EXECUTE FUNCTION duty_segments_do_not_overlap();

-- 4. Assignments, and the assessment that let one through.
CREATE TABLE IF NOT EXISTS trip_driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role VARCHAR(16) NOT NULL DEFAULT 'PRIMARY' CHECK (role IN ('PRIMARY', 'SECOND_DRIVER')),
  departs_at TIMESTAMPTZ NOT NULL,
  returns_at TIMESTAMPTZ NOT NULL,
  assessed_at TIMESTAMPTZ,
  assessment_lawful BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignment_returns_after_it_departs CHECK (returns_at > departs_at),
  UNIQUE (trip_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_assignments_driver
  ON trip_driver_assignments (driver_id, departs_at);

CREATE TABLE IF NOT EXISTS duty_assessment_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES trip_driver_assignments(id) ON DELETE CASCADE,
  rule_id VARCHAR(32) NOT NULL CHECK (rule_id IN (
    'CONTINUOUS_DRIVING', 'DAILY_DRIVING', 'DAILY_REST', 'ENTITLEMENT_EXPIRED'
  )),
  detail TEXT NOT NULL,
  limit_minutes INT NOT NULL,
  actual_minutes INT NOT NULL,
  -- Null where no amount of waiting fixes it. A trip that is simply too long
  -- to drive does not become shorter by leaving later, and saying so is the
  -- useful answer.
  lawful_from TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_duty_breaches_assignment
  ON duty_assessment_breaches (assignment_id);

-- 5. Fold a driver's segments into duty periods.
--
--    A period ends where a gap long enough to count as a daily rest opens up.
--    A shorter gap is neither a break nor a rest — it is a long gap inside one
--    duty period, and treating it as a boundary is how a seven-hour overnight
--    turns into two lawful days.
CREATE OR REPLACE FUNCTION driver_duty_periods(
  p_driver_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS TABLE (
  period_index INT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  driving_minutes INT,
  duty_minutes INT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rules driver_duty_rulesets;
  v_row RECORD;
  v_index INT := 0;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_driving INT := 0;
  v_duty INT := 0;
  v_gap INT;
BEGIN
  SELECT * INTO v_rules FROM driver_duty_rulesets WHERE code = p_ruleset;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown duty ruleset %', p_ruleset;
  END IF;

  FOR v_row IN
    SELECT duty_kind, started_at, ended_at
    FROM driver_duty_segments
    WHERE driver_id = p_driver_id
      AND ended_at > p_from
      AND started_at < p_to
    ORDER BY started_at
  LOOP
    IF v_start IS NULL THEN
      v_start := v_row.started_at;
    ELSE
      v_gap := EXTRACT(EPOCH FROM (v_row.started_at - v_end))::INT / 60;

      IF v_gap >= v_rules.reduced_daily_rest_minutes THEN
        v_index := v_index + 1;
        period_index := v_index;
        period_start := v_start;
        period_end := v_end;
        driving_minutes := v_driving;
        duty_minutes := v_duty;
        RETURN NEXT;

        v_start := v_row.started_at;
        v_driving := 0;
        v_duty := 0;
      END IF;
    END IF;

    v_end := v_row.ended_at;
    v_duty := v_duty + EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::INT / 60;

    IF v_row.duty_kind = 'DRIVING' THEN
      v_driving := v_driving
        + EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::INT / 60;
    END IF;
  END LOOP;

  IF v_start IS NOT NULL THEN
    v_index := v_index + 1;
    period_index := v_index;
    period_start := v_start;
    period_end := v_end;
    driving_minutes := v_driving;
    duty_minutes := v_duty;
    RETURN NEXT;
  END IF;
END;
$$;

-- 6. The longest run of driving in a window that is not properly broken.
--
--    A break in one piece resets it. A split break resets it only in the right
--    order: the shorter part first, the longer part second. Thirty minutes then
--    fifteen totals the same forty-five and is not compliant, and an
--    implementation that adds the minutes up passes it every time.
CREATE OR REPLACE FUNCTION driver_longest_unbroken_driving(
  p_driver_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rules driver_duty_rulesets;
  v_row RECORD;
  v_running INT := 0;
  v_longest INT := 0;
  v_first_part_taken BOOLEAN := FALSE;
  v_previous_end TIMESTAMPTZ;
  v_gap INT;
BEGIN
  SELECT * INTO v_rules FROM driver_duty_rulesets WHERE code = p_ruleset;

  FOR v_row IN
    SELECT duty_kind, started_at, ended_at
    FROM driver_duty_segments
    WHERE driver_id = p_driver_id
      AND ended_at > p_from
      AND started_at < p_to
    ORDER BY started_at
  LOOP
    IF v_previous_end IS NOT NULL THEN
      v_gap := EXTRACT(EPOCH FROM (v_row.started_at - v_previous_end))::INT / 60;

      IF v_gap >= v_rules.required_break_minutes THEN
        v_running := 0;
        v_first_part_taken := FALSE;
      ELSIF v_gap >= v_rules.split_break_second_minutes AND v_first_part_taken THEN
        -- The longer part, arriving second. The only way a split completes.
        v_running := 0;
        v_first_part_taken := FALSE;
      ELSIF v_gap >= v_rules.split_break_first_minutes THEN
        -- Long enough to be the first part and nothing more. A second gap of
        -- this size does not complete the break.
        v_first_part_taken := TRUE;
      END IF;
    END IF;

    IF v_row.duty_kind = 'DRIVING' THEN
      v_running := v_running
        + EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::INT / 60;
      v_longest := GREATEST(v_longest, v_running);
    END IF;

    v_previous_end := v_row.ended_at;
  END LOOP;

  RETURN v_longest;
END;
$$;

-- 7. Extensions and reductions already spent inside the rolling window.
--
--    Rolling from the departure, not from the start of a calendar week.
CREATE OR REPLACE FUNCTION driver_duty_allowances(
  p_driver_id UUID,
  p_departure TIMESTAMPTZ,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS TABLE (
  extensions_used INT,
  extensions_remaining INT,
  reductions_used INT,
  reductions_remaining INT,
  window_from TIMESTAMPTZ,
  window_to TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rules driver_duty_rulesets;
  v_from TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_rules FROM driver_duty_rulesets WHERE code = p_ruleset;
  v_from := p_departure - (v_rules.rolling_window_days || ' days')::INTERVAL;

  SELECT
    COUNT(*) FILTER (WHERE driving_minutes > v_rules.max_daily_driving_minutes)::INT
  INTO extensions_used
  FROM driver_duty_periods(p_driver_id, v_from, p_departure, p_ruleset);

  SELECT COUNT(*)::INT INTO reductions_used
  FROM (
    SELECT
      period_start - LAG(period_end) OVER (ORDER BY period_index) AS rest_interval
    FROM driver_duty_periods(p_driver_id, v_from, p_departure, p_ruleset)
  ) r
  WHERE rest_interval IS NOT NULL
    AND EXTRACT(EPOCH FROM rest_interval)::INT / 60 >= v_rules.reduced_daily_rest_minutes
    AND EXTRACT(EPOCH FROM rest_interval)::INT / 60 < v_rules.minimum_daily_rest_minutes;

  extensions_remaining := GREATEST(0, v_rules.extensions_per_window - extensions_used);
  reductions_remaining := GREATEST(0, v_rules.reductions_per_window - reductions_used);
  window_from := v_from;
  window_to := p_departure;
  RETURN NEXT;
END;
$$;

-- 8. Assess a proposed assignment against everything the driver has already
--    done.
--
--    There is deliberately no way to assess a trip in isolation. The isolated
--    answer is the wrong answer often enough to be dangerous, and a function
--    that offers it is a function somebody will call.
CREATE OR REPLACE FUNCTION assess_driver_assignment(
  p_driver_id UUID,
  p_departs_at TIMESTAMPTZ,
  p_returns_at TIMESTAMPTZ,
  p_proposed_driving_minutes INT,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS TABLE (
  rule_id TEXT,
  detail TEXT,
  limit_minutes INT,
  actual_minutes INT,
  lawful_from TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rules driver_duty_rulesets;
  v_allow RECORD;
  v_previous_end TIMESTAMPTZ;
  v_rest INT;
  v_required INT;
  v_period_driving INT;
BEGIN
  SELECT * INTO v_rules FROM driver_duty_rulesets WHERE code = p_ruleset;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown duty ruleset %', p_ruleset;
  END IF;

  -- Entitlement, judged against the journey. A licence that lapses between
  -- booking and travel is the case this exists for, and waiting only makes it
  -- worse, so there is no lawful-from to offer.
  IF NOT EXISTS (
    SELECT 1 FROM driver_entitlements
    WHERE driver_id = p_driver_id
      AND valid_from <= p_departs_at
      AND valid_until >= p_returns_at
  ) THEN
    rule_id := 'ENTITLEMENT_EXPIRED';
    detail := 'Driver is not entitled to drive for the whole journey';
    limit_minutes := 0;
    actual_minutes := 0;
    lawful_from := NULL;
    RETURN NEXT;
  END IF;

  SELECT * INTO v_allow FROM driver_duty_allowances(p_driver_id, p_departs_at, p_ruleset);

  -- Daily rest, measured from the end of the last duty rather than from
  -- midnight. This is the rule a per-trip check can never see.
  SELECT MAX(period_end) INTO v_previous_end
  FROM driver_duty_periods(
    p_driver_id,
    p_departs_at - (v_rules.rolling_window_days || ' days')::INTERVAL,
    p_departs_at,
    p_ruleset
  )
  WHERE period_end <= p_departs_at;

  IF v_previous_end IS NOT NULL THEN
    v_rest := EXTRACT(EPOCH FROM (p_departs_at - v_previous_end))::INT / 60;
    v_required := CASE WHEN v_allow.reductions_remaining > 0
                       THEN v_rules.reduced_daily_rest_minutes
                       ELSE v_rules.minimum_daily_rest_minutes END;

    IF v_rest < v_required THEN
      rule_id := 'DAILY_REST';
      detail := 'Only ' || v_rest || ' minutes since the last duty ended, against '
                || v_required;
      limit_minutes := v_required;
      actual_minutes := v_rest;
      lawful_from := v_previous_end + (v_required || ' minutes')::INTERVAL;
      RETURN NEXT;
    END IF;
  END IF;

  -- Daily driving. Where the rest above was short the previous duty period is
  -- still open, so its driving counts toward the same daily limit.
  SELECT COALESCE(
    (
      SELECT driving_minutes
      FROM driver_duty_periods(
        p_driver_id,
        p_departs_at - (v_rules.rolling_window_days || ' days')::INTERVAL,
        p_returns_at,
        p_ruleset
      )
      WHERE period_end > p_departs_at - (v_rules.reduced_daily_rest_minutes || ' minutes')::INTERVAL
      ORDER BY period_index DESC
      LIMIT 1
    ), 0
  ) + p_proposed_driving_minutes
  INTO v_period_driving;

  IF v_period_driving > v_rules.extended_daily_driving_minutes THEN
    rule_id := 'DAILY_DRIVING';
    detail := v_period_driving || ' minutes of driving, past even an extended day';
    limit_minutes := v_rules.extended_daily_driving_minutes;
    actual_minutes := v_period_driving;
    lawful_from := NULL;
    RETURN NEXT;
  ELSIF v_period_driving > v_rules.max_daily_driving_minutes
        AND v_allow.extensions_remaining = 0 THEN
    rule_id := 'DAILY_DRIVING';
    detail := v_period_driving || ' minutes needs an extension, and all are spent in the window';
    limit_minutes := v_rules.max_daily_driving_minutes;
    actual_minutes := v_period_driving;
    lawful_from := NULL;
    RETURN NEXT;
  END IF;

  -- Continuous driving. Leaving later does not make the drive shorter, so the
  -- fix is a break or a second driver and there is no lawful-from.
  IF p_proposed_driving_minutes > v_rules.max_continuous_driving_minutes THEN
    rule_id := 'CONTINUOUS_DRIVING';
    detail := p_proposed_driving_minutes
              || ' minutes of driving without a break taken in the right order';
    limit_minutes := v_rules.max_continuous_driving_minutes;
    actual_minutes := p_proposed_driving_minutes;
    lawful_from := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

-- 9. The earliest departure that clears every breach.
--
--    Null where any breach cannot be cured by waiting. A refusal without this
--    tells the person planning the trip nothing they can act on, and they will
--    drive anyway.
CREATE OR REPLACE FUNCTION earliest_lawful_departure(
  p_driver_id UUID,
  p_departs_at TIMESTAMPTZ,
  p_returns_at TIMESTAMPTZ,
  p_proposed_driving_minutes INT,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_breaches INT;
  v_uncurable INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE lawful_from IS NULL)
  INTO v_breaches, v_uncurable
  FROM assess_driver_assignment(
    p_driver_id, p_departs_at, p_returns_at, p_proposed_driving_minutes, p_ruleset
  );

  IF v_breaches = 0 THEN RETURN p_departs_at; END IF;
  IF v_uncurable > 0 THEN RETURN NULL; END IF;

  RETURN (
    SELECT MAX(lawful_from)
    FROM assess_driver_assignment(
      p_driver_id, p_departs_at, p_returns_at, p_proposed_driving_minutes, p_ruleset
    )
  );
END;
$$;

-- 10. Record an assignment, refusing an unlawful one and keeping the breaches
--     that explain the refusal.
CREATE OR REPLACE FUNCTION assign_trip_driver(
  p_trip_id UUID,
  p_driver_id UUID,
  p_role VARCHAR,
  p_departs_at TIMESTAMPTZ,
  p_returns_at TIMESTAMPTZ,
  p_proposed_driving_minutes INT,
  p_at TIMESTAMPTZ,
  p_ruleset VARCHAR DEFAULT 'DEFAULT'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
  v_breaches INT;
BEGIN
  SELECT COUNT(*) INTO v_breaches
  FROM assess_driver_assignment(
    p_driver_id, p_departs_at, p_returns_at, p_proposed_driving_minutes, p_ruleset
  );

  INSERT INTO trip_driver_assignments (
    trip_id, driver_id, role, departs_at, returns_at, assessed_at, assessment_lawful
  )
  VALUES (
    p_trip_id, p_driver_id, p_role, p_departs_at, p_returns_at, p_at, v_breaches = 0
  )
  ON CONFLICT (trip_id, driver_id) DO UPDATE
  SET role = EXCLUDED.role,
      departs_at = EXCLUDED.departs_at,
      returns_at = EXCLUDED.returns_at,
      assessed_at = EXCLUDED.assessed_at,
      assessment_lawful = EXCLUDED.assessment_lawful
  RETURNING id INTO v_assignment_id;

  DELETE FROM duty_assessment_breaches WHERE assignment_id = v_assignment_id;

  INSERT INTO duty_assessment_breaches (
    assignment_id, rule_id, detail, limit_minutes, actual_minutes, lawful_from
  )
  SELECT v_assignment_id, a.rule_id, a.detail, a.limit_minutes, a.actual_minutes, a.lawful_from
  FROM assess_driver_assignment(
    p_driver_id, p_departs_at, p_returns_at, p_proposed_driving_minutes, p_ruleset
  ) a;

  RETURN CASE WHEN v_breaches = 0 THEN 'ASSIGNED' ELSE 'REFUSED_DUTY_HOURS' END;
END;
$$;

-- 11. Row level security.
--
--     A driver's duty record is personal data about their working time. They
--     see their own; a trip organiser sees the assignment they made.
ALTER TABLE driver_duty_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_duty_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_assessment_breaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duty_rulesets_authenticated_read ON driver_duty_rulesets;
CREATE POLICY duty_rulesets_authenticated_read ON driver_duty_rulesets
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS entitlements_own_read ON driver_entitlements;
CREATE POLICY entitlements_own_read ON driver_entitlements
  FOR SELECT TO authenticated USING (driver_id = auth.uid());

DROP POLICY IF EXISTS duty_segments_own_read ON driver_duty_segments;
CREATE POLICY duty_segments_own_read ON driver_duty_segments
  FOR SELECT TO authenticated USING (driver_id = auth.uid());

DROP POLICY IF EXISTS assignments_driver_or_organiser_read ON trip_driver_assignments;
CREATE POLICY assignments_driver_or_organiser_read ON trip_driver_assignments
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = trip_driver_assignments.trip_id AND e.organizer_id = auth.uid()
    )
  );

-- The breach is why the assignment was refused. The organiser needs it to plan
-- around, and it says nothing about the driver beyond that refusal.
DROP POLICY IF EXISTS breaches_assignment_read ON duty_assessment_breaches;
CREATE POLICY breaches_assignment_read ON duty_assessment_breaches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_driver_assignments a
      WHERE a.id = duty_assessment_breaches.assignment_id
        AND (
          a.driver_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = a.trip_id AND e.organizer_id = auth.uid()
          )
        )
    )
  );

GRANT EXECUTE ON FUNCTION driver_duty_periods(UUID, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR)
  TO authenticated;
GRANT EXECUTE ON FUNCTION driver_longest_unbroken_driving(UUID, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR)
  TO authenticated;
GRANT EXECUTE ON FUNCTION driver_duty_allowances(UUID, TIMESTAMPTZ, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_driver_assignment(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, VARCHAR)
  TO authenticated;
GRANT EXECUTE ON FUNCTION earliest_lawful_departure(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, VARCHAR)
  TO authenticated;
GRANT EXECUTE ON FUNCTION assign_trip_driver(
  UUID, UUID, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, INT, TIMESTAMPTZ, VARCHAR
) TO authenticated;

COMMENT ON CONSTRAINT ruleset_split_break_is_shorter_first ON driver_duty_rulesets IS
  'The shorter part of a split break comes first. Fifteen then thirty is compliant; thirty then fifteen totals the same and is not.';
COMMENT ON FUNCTION driver_duty_periods(UUID, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR) IS
  'A period ends only at a gap long enough to be a daily rest. A seven-hour overnight leaves one period open, which is what makes Saturday and Sunday count against the same daily limit.';
COMMENT ON FUNCTION driver_duty_allowances(UUID, TIMESTAMPTZ, VARCHAR) IS
  'Rolling from the departure. A calendar-week reading of this rule is a bug that only shows up on Mondays.';
COMMENT ON COLUMN duty_assessment_breaches.lawful_from IS
  'Null where waiting cannot cure the breach. A refusal that does not say when they may leave tells the organiser nothing they can act on.';
