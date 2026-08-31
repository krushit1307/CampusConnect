-- Migration: 20270905000000_out_of_hours_energy_recharge.sql
-- Description: Schema and functions for the Out-of-Hours Venue Energy Recharge —
--              plant window derivation from the lead-in, degree-day gating,
--              shared-plant apportionment and the commitment horizon (#4706).
--
-- The recharge currently arrives as a line on the club's account four months
-- later reading EST-OOH RECHARGE 148.50, by which point the committee that
-- incurred it has graduated. A treasurer cannot decline a cost they will not
-- see until March.
--
-- Two things make quoting it non-trivial and both make the naive version wrong
-- in a specific direction.
--
-- The plant runs before the booking starts. A hall booked from nine to ten at
-- night does not become usable at nine by magic; the plant fires up an hour and
-- a half earlier. A charge computed from the booking window undercharges every
-- single time.
--
-- The cost is shared, not duplicated. Two clubs in one building on overlapping
-- evenings make the plant run once. Charging each of them the full cost bills
-- the university twice for one unit of gas.
--
-- Money is BIGINT cents and the apportionments sum to exactly the plant cost.
-- A recharge that does not reconcile to the estates invoice is a recharge that
-- gets disputed and written off.
--
-- Core hours are minutes from midnight UTC.

-- 1. What the building's plant is and how it behaves.
CREATE TABLE IF NOT EXISTS building_energy_profiles (
  building_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  core_start_minute INT NOT NULL DEFAULT 480,
  core_end_minute INT NOT NULL DEFAULT 1080,
  -- How long the plant runs before a booking to reach temperature. This is why
  -- the charge starts before the booking does.
  lead_in_minutes INT NOT NULL DEFAULT 90,
  heating_plant_kw NUMERIC(10,2) NOT NULL,
  cooling_plant_kw NUMERIC(10,2) NOT NULL,
  -- Bringing the plant up from cold. Once per run, not once per booking.
  startup_kwh NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- The plant cannot be run for twenty minutes.
  minimum_block_minutes INT NOT NULL DEFAULT 60,
  standing_charge_cents BIGINT NOT NULL DEFAULT 0,
  rate_per_kwh_cents BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT core_hours_are_ordered CHECK (core_start_minute < core_end_minute),
  CONSTRAINT core_hours_stay_within_the_day CHECK (
    core_start_minute >= 0 AND core_end_minute <= 1440
  ),
  CONSTRAINT energy_intervals_are_not_negative CHECK (
    lead_in_minutes >= 0 AND minimum_block_minutes >= 0
  ),
  CONSTRAINT energy_rates_are_not_negative CHECK (
    heating_plant_kw >= 0 AND cooling_plant_kw >= 0
    AND startup_kwh >= 0 AND standing_charge_cents >= 0 AND rate_per_kwh_cents >= 0
  )
);

-- 2. The weather. Heating is not a season, it is a temperature, and a flat rate
--    per hour charges for heating in a heatwave.
CREATE TABLE IF NOT EXISTS degree_day_observations (
  observed_on DATE PRIMARY KEY,
  heating_degree_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  cooling_degree_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'met-office',
  CONSTRAINT degree_days_are_not_negative CHECK (
    heating_degree_days >= 0 AND cooling_degree_days >= 0
  )
);

-- 3. Quotes, held so that a booking amended later can be re-quoted against what
--    it was told at the time.
CREATE TABLE IF NOT EXISTS out_of_hours_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES room_bookings(id) ON DELETE CASCADE,
  quoted_at TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(24) NOT NULL
    CHECK (outcome IN ('QUOTED', 'UNSERVICEABLE', 'NO_PLANT_REQUIRED')),
  plant_mode VARCHAR(8) NOT NULL CHECK (plant_mode IN ('HEATING', 'COOLING', 'NONE')),
  plant_from TIMESTAMPTZ,
  plant_to TIMESTAMPTZ,
  chargeable_minutes INT NOT NULL DEFAULT 0,
  core_hours_minutes INT NOT NULL DEFAULT 0,
  minimum_block_padding_minutes INT NOT NULL DEFAULT 0,
  running_kwh NUMERIC(12,3) NOT NULL DEFAULT 0,
  -- What this booking would cost on its own, before anybody else in the
  -- building is taken into account. Kept because the difference between this
  -- and the apportioned figure is the thing worth showing a treasurer.
  standalone_cents BIGINT NOT NULL DEFAULT 0,
  -- Past this instant cancelling saves nothing. The gas was burned.
  commit_at TIMESTAMPTZ,
  CONSTRAINT charge_window_is_ordered CHECK (plant_to IS NULL OR plant_to > plant_from),
  CONSTRAINT charge_minutes_are_not_negative CHECK (
    chargeable_minutes >= 0 AND core_hours_minutes >= 0
    AND minimum_block_padding_minutes >= 0
  ),
  UNIQUE (booking_id, quoted_at)
);

CREATE INDEX IF NOT EXISTS idx_ooh_charges_booking
  ON out_of_hours_charges (booking_id, quoted_at DESC);

-- 4. Plant runs and who pays for them.
CREATE TABLE IF NOT EXISTS plant_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  plant_mode VARCHAR(8) NOT NULL CHECK (plant_mode IN ('HEATING', 'COOLING')),
  ran_from TIMESTAMPTZ NOT NULL,
  ran_to TIMESTAMPTZ NOT NULL,
  running_minutes INT NOT NULL,
  startup_cents BIGINT NOT NULL,
  running_cents BIGINT NOT NULL,
  plant_cost_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plant_run_is_ordered CHECK (ran_to > ran_from),
  CONSTRAINT plant_cost_reconciles CHECK (
    plant_cost_cents = startup_cents + running_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_plant_runs_building
  ON plant_runs (building_id, ran_from);

CREATE TABLE IF NOT EXISTS charge_apportionments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_run_id UUID NOT NULL REFERENCES plant_runs(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES room_bookings(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  -- The startup and the standing charge, carried by whoever fired the plant.
  startup_cents BIGINT NOT NULL DEFAULT 0,
  running_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL,
  weighted_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  triggered_plant BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (plant_run_id, booking_id),
  CONSTRAINT apportionment_total_reconciles CHECK (
    total_cents = startup_cents + running_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_apportionments_club
  ON charge_apportionments (club_id);

-- The apportionments must sum to exactly the plant cost. This is the invariant
-- the whole feature turns on: pennies that evaporate here are pennies the
-- estates invoice will not reconcile against, and an unreconciled recharge gets
-- disputed and then written off.
CREATE OR REPLACE FUNCTION apportionments_sum_to_the_plant_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_run UUID;
  v_sum BIGINT;
  v_cost BIGINT;
  v_startups INT;
BEGIN
  v_run := COALESCE(NEW.plant_run_id, OLD.plant_run_id);

  SELECT COALESCE(SUM(total_cents), 0), COUNT(*) FILTER (WHERE triggered_plant)
  INTO v_sum, v_startups
  FROM charge_apportionments WHERE plant_run_id = v_run;

  SELECT plant_cost_cents INTO v_cost FROM plant_runs WHERE id = v_run;

  IF v_sum <> v_cost THEN
    RAISE EXCEPTION
      'Apportionments for plant run % total % against a plant cost of %.',
      v_run, v_sum, v_cost;
  END IF;

  IF v_startups <> 1 THEN
    RAISE EXCEPTION
      'Plant run % has % bookings marked as triggering it; exactly one fired the plant.',
      v_run, v_startups;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_apportionments_reconcile ON charge_apportionments;
CREATE CONSTRAINT TRIGGER trg_apportionments_reconcile
AFTER INSERT OR UPDATE OR DELETE ON charge_apportionments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION apportionments_sum_to_the_plant_cost();

-- 5. Which way the plant ran.
--
--    An unobserved date raises rather than returning NONE. A missing
--    observation and a genuinely mild evening both produce no charge, and only
--    one of those should.
CREATE OR REPLACE FUNCTION plant_mode_for(p_on DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_obs degree_day_observations;
BEGIN
  SELECT * INTO v_obs FROM degree_day_observations WHERE observed_on = p_on;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No degree-day observation for %; the recharge cannot be quoted.', p_on;
  END IF;

  IF v_obs.heating_degree_days = 0 AND v_obs.cooling_degree_days = 0 THEN
    RETURN 'NONE';
  END IF;

  RETURN CASE WHEN v_obs.heating_degree_days >= v_obs.cooling_degree_days
              THEN 'HEATING' ELSE 'COOLING' END;
END;
$$;

-- 6. The parts of a window that fall outside core hours.
--
--    Inside core hours the space is already being conditioned for everybody
--    else, and charging a club for it would bill the same gas twice. Pieces
--    either side of midnight are merged so an overnight window is one interval.
CREATE OR REPLACE FUNCTION chargeable_plant_intervals(
  p_building_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (interval_from TIMESTAMPTZ, interval_to TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_profile building_energy_profiles;
  v_cursor TIMESTAMPTZ;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_segment_end TIMESTAMPTZ;
  v_core_start TIMESTAMPTZ;
  v_core_end TIMESTAMPTZ;
  v_prev_from TIMESTAMPTZ;
  v_prev_to TIMESTAMPTZ;
  v_piece RECORD;
BEGIN
  SELECT * INTO v_profile FROM building_energy_profiles WHERE building_id = p_building_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown building %', p_building_id;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _plant_pieces (
    piece_from TIMESTAMPTZ, piece_to TIMESTAMPTZ
  ) ON COMMIT DROP;
  DELETE FROM _plant_pieces;

  v_cursor := p_from;

  WHILE v_cursor < p_to LOOP
    v_day_start := DATE_TRUNC('day', v_cursor AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_day_end := v_day_start + INTERVAL '1 day';
    v_segment_end := LEAST(p_to, v_day_end);
    v_core_start := v_day_start + (v_profile.core_start_minute || ' minutes')::INTERVAL;
    v_core_end := v_day_start + (v_profile.core_end_minute || ' minutes')::INTERVAL;

    IF LEAST(v_segment_end, v_core_start) > v_cursor THEN
      INSERT INTO _plant_pieces VALUES (v_cursor, LEAST(v_segment_end, v_core_start));
    END IF;

    IF v_segment_end > GREATEST(v_cursor, v_core_end) THEN
      INSERT INTO _plant_pieces VALUES (GREATEST(v_cursor, v_core_end), v_segment_end);
    END IF;

    v_cursor := v_segment_end;
  END LOOP;

  -- Merge touching pieces so a window across midnight comes back as one.
  FOR v_piece IN SELECT piece_from, piece_to FROM _plant_pieces ORDER BY piece_from LOOP
    IF v_prev_from IS NULL THEN
      v_prev_from := v_piece.piece_from;
      v_prev_to := v_piece.piece_to;
    ELSIF v_piece.piece_from <= v_prev_to THEN
      v_prev_to := GREATEST(v_prev_to, v_piece.piece_to);
    ELSE
      interval_from := v_prev_from;
      interval_to := v_prev_to;
      RETURN NEXT;
      v_prev_from := v_piece.piece_from;
      v_prev_to := v_piece.piece_to;
    END IF;
  END LOOP;

  IF v_prev_from IS NOT NULL THEN
    interval_from := v_prev_from;
    interval_to := v_prev_to;
    RETURN NEXT;
  END IF;
END;
$$;

-- 7. Quote one booking on its own.
--
--    The window runs from the lead-in, not from the booking, and is padded to
--    the minimum block. What comes back is what the booking costs the
--    university before anybody else in the building is taken into account.
CREATE OR REPLACE FUNCTION quote_out_of_hours_energy(
  p_booking_id UUID,
  p_quoted_at TIMESTAMPTZ
)
RETURNS TABLE (
  outcome TEXT,
  plant_mode TEXT,
  plant_from TIMESTAMPTZ,
  plant_to TIMESTAMPTZ,
  chargeable_minutes INT,
  core_hours_minutes INT,
  minimum_block_padding_minutes INT,
  running_kwh NUMERIC,
  standalone_cents BIGINT,
  commit_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_booking RECORD;
  v_profile building_energy_profiles;
  v_mode TEXT;
  v_plant_from TIMESTAMPTZ;
  v_chargeable INT;
  v_padding INT := 0;
  v_last_to TIMESTAMPTZ;
  v_plant_kw NUMERIC;
  v_startup_cents BIGINT;
  v_running_cents BIGINT;
BEGIN
  SELECT b.id, b.venue_id AS building_id, b.starts_at, b.ends_at
  INTO v_booking
  FROM room_bookings b WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown booking %', p_booking_id;
  END IF;

  SELECT * INTO v_profile
  FROM building_energy_profiles WHERE building_id = v_booking.building_id;

  v_mode := plant_mode_for((v_booking.starts_at AT TIME ZONE 'UTC')::DATE);

  outcome := 'NO_PLANT_REQUIRED';
  plant_mode := v_mode;
  chargeable_minutes := 0;
  core_hours_minutes := 0;
  minimum_block_padding_minutes := 0;
  running_kwh := 0;
  standalone_cents := 0;

  IF v_mode = 'NONE' THEN
    RETURN NEXT;
    RETURN;
  END IF;

  v_plant_from := v_booking.starts_at - (v_profile.lead_in_minutes || ' minutes')::INTERVAL;
  commit_at := v_plant_from;

  -- The plant has to be started before the booking begins. A booking made
  -- inside that horizon cannot be serviced, and saying so at quote time is
  -- better than a charge for a room that will be cold.
  IF v_plant_from < p_quoted_at THEN
    outcome := 'UNSERVICEABLE';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (interval_to - interval_from))::INT / 60), 0),
    MAX(interval_to)
  INTO v_chargeable, v_last_to
  FROM chargeable_plant_intervals(v_booking.building_id, v_plant_from, v_booking.ends_at);

  IF v_chargeable = 0 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_chargeable < v_profile.minimum_block_minutes THEN
    v_padding := v_profile.minimum_block_minutes - v_chargeable;
    v_last_to := v_last_to + (v_padding || ' minutes')::INTERVAL;
    v_chargeable := v_profile.minimum_block_minutes;
  END IF;

  v_plant_kw := CASE WHEN v_mode = 'HEATING'
                     THEN v_profile.heating_plant_kw
                     ELSE v_profile.cooling_plant_kw END;

  v_startup_cents := ROUND(v_profile.startup_kwh * v_profile.rate_per_kwh_cents);
  v_running_cents := ROUND((v_plant_kw * v_chargeable / 60) * v_profile.rate_per_kwh_cents);

  outcome := 'QUOTED';
  plant_from := v_plant_from;
  plant_to := v_last_to;
  chargeable_minutes := v_chargeable;
  core_hours_minutes :=
    (EXTRACT(EPOCH FROM (v_booking.ends_at - v_plant_from))::INT / 60)
    - (v_chargeable - v_padding);
  minimum_block_padding_minutes := v_padding;
  running_kwh := v_plant_kw * v_chargeable / 60;
  standalone_cents := v_startup_cents + v_profile.standing_charge_cents + v_running_cents;
  RETURN NEXT;
END;
$$;

-- 8. Split a whole into integer parts by weight so that the parts sum to
--    exactly the whole.
--
--    The remainder goes to the largest fractional parts, ties broken by
--    position. Rounding each share independently loses pennies.
CREATE OR REPLACE FUNCTION allocate_by_largest_remainder(
  p_total_cents BIGINT,
  p_weights NUMERIC[]
)
RETURNS BIGINT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_result BIGINT[] := ARRAY[]::BIGINT[];
  v_exact NUMERIC[] := ARRAY[]::NUMERIC[];
  v_remainder BIGINT;
  v_index INT;
  v_row RECORD;
BEGIN
  IF ARRAY_LENGTH(p_weights, 1) IS NULL THEN
    RETURN ARRAY[]::BIGINT[];
  END IF;

  SELECT COALESCE(SUM(w), 0) INTO v_sum FROM UNNEST(p_weights) w;

  IF v_sum <= 0 THEN
    RETURN ARRAY(SELECT 0::BIGINT FROM UNNEST(p_weights));
  END IF;

  FOR v_index IN 1 .. ARRAY_LENGTH(p_weights, 1) LOOP
    v_exact := v_exact || (p_total_cents * p_weights[v_index] / v_sum);
    v_result := v_result || FLOOR(p_total_cents * p_weights[v_index] / v_sum)::BIGINT;
  END LOOP;

  SELECT p_total_cents - COALESCE(SUM(r), 0) INTO v_remainder FROM UNNEST(v_result) r;

  FOR v_row IN
    SELECT ordinality AS idx
    FROM UNNEST(v_exact) WITH ORDINALITY AS e(value, ordinality)
    ORDER BY (e.value - FLOOR(e.value)) DESC, e.ordinality
  LOOP
    EXIT WHEN v_remainder <= 0;
    v_result[v_row.idx] := v_result[v_row.idx] + 1;
    v_remainder := v_remainder - 1;
  END LOOP;

  RETURN v_result;
END;
$$;

-- 9. Row level security.
--
--     Profiles and weather are reference data a treasurer needs in order to see
--     what an evening will cost. The apportionments are club money.
ALTER TABLE building_energy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE degree_day_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE out_of_hours_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_apportionments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS energy_profiles_authenticated_read ON building_energy_profiles;
CREATE POLICY energy_profiles_authenticated_read ON building_energy_profiles
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS degree_days_authenticated_read ON degree_day_observations;
CREATE POLICY degree_days_authenticated_read ON degree_day_observations
  FOR SELECT TO authenticated USING (TRUE);

-- A plant run is a fact about the building, and the club being charged a share
-- of it can only check that share against the whole.
DROP POLICY IF EXISTS plant_runs_authenticated_read ON plant_runs;
CREATE POLICY plant_runs_authenticated_read ON plant_runs
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS ooh_charges_club_member_read ON out_of_hours_charges;
CREATE POLICY ooh_charges_club_member_read ON out_of_hours_charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM charge_apportionments a
      JOIN club_members m ON m.club_id = a.club_id
      WHERE a.booking_id = out_of_hours_charges.booking_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS apportionments_club_member_read ON charge_apportionments;
CREATE POLICY apportionments_club_member_read ON charge_apportionments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = charge_apportionments.club_id AND m.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION plant_mode_for(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION chargeable_plant_intervals(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION quote_out_of_hours_energy(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_by_largest_remainder(BIGINT, NUMERIC[]) TO authenticated;

COMMENT ON COLUMN building_energy_profiles.lead_in_minutes IS
  'The plant runs before the booking starts. A charge computed from the booking window undercharges every single time.';
COMMENT ON FUNCTION chargeable_plant_intervals(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'The parts of a window outside core hours. Inside them the space is already conditioned and charging for it bills the same gas twice.';
COMMENT ON FUNCTION plant_mode_for(DATE) IS
  'Raises on an unobserved date rather than returning NONE. A missing observation and a mild evening both produce no charge and only one of them should.';
COMMENT ON CONSTRAINT plant_cost_reconciles ON plant_runs IS
  'Startup plus running. The estates invoice line the apportionments have to add back up to.';
COMMENT ON COLUMN out_of_hours_charges.commit_at IS
  'Past this instant cancelling saves nothing, because the plant has already been committed and the gas was burned.';
