-- Migration: 20270827000000_food_safety_hold_log.sql
-- Description: Schema and functions for the Catered Event Food Safety Time &
--              Temperature Hold Log (#4554).
--
-- Health code counts cumulative exposure to the danger zone across the entire
-- service, not the length of any one continuous stretch. That distinction is
-- where a clipboard gets it wrong, and it gets it wrong in a predictable
-- direction: food that went out at 11:00, back to the fridge at 12:00 and out
-- again at 14:00 has accrued in both stretches, but a paper log with a
-- "returned to fridge" line reads as though the clock reset.
--
-- Exposure between two readings is interpolated rather than rounded. A tray
-- read at 3°C and then at 9°C half an hour later did not spend the whole half
-- hour in the zone, nor none of it, and finding the crossing instant is the
-- entire point of having readings rather than a checkbox.
--
-- Every function here takes the assessment instant as an argument rather than
-- calling NOW(), so "was this tray servable at 13:40?" has one answer during an
-- inspection three weeks later.

-- 1. Thresholds, kept as functions rather than inline literals so the service
--    and the database cannot drift apart on what "in the zone" means.
--
--    One threshold per holding type, not a shared 5-60 band. A hot dish at 3°C
--    would be outside a shared band and counted safe, which is true of the
--    bacteria and false of everything else about a tray of curry that has been
--    in a fridge for an hour and is about to go back out.
CREATE OR REPLACE FUNCTION food_hold_threshold_celsius(p_holding_type VARCHAR)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_holding_type WHEN 'COLD' THEN 5.0 ELSE 60.0 END;
$$;

CREATE OR REPLACE FUNCTION food_is_in_danger_zone(
  p_holding_type VARCHAR,
  p_celsius NUMERIC
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_holding_type
    WHEN 'COLD' THEN p_celsius > 5.0
    ELSE p_celsius < 60.0
  END;
$$;

-- 2. One row per dish on the table.
CREATE TABLE IF NOT EXISTS event_food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  holding_type VARCHAR(8) NOT NULL CHECK (holding_type IN ('HOT', 'COLD')),
  prepared_at TIMESTAMPTZ NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'IN_SERVICE'
    CHECK (state IN ('IN_SERVICE', 'IN_REFRIGERATION', 'DISCARDED')),
  reheats_used SMALLINT NOT NULL DEFAULT 0,
  discarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Hot-held TCS food gets one reheat. A dish that has fallen out of
  -- temperature twice in one service is being held somewhere that cannot hold
  -- it, and a second reheat treats a room problem as a tray problem.
  CONSTRAINT food_item_reheat_allowance CHECK (reheats_used BETWEEN 0 AND 1),
  CONSTRAINT food_item_cold_is_never_reheated CHECK (
    holding_type = 'HOT' OR reheats_used = 0
  ),
  CONSTRAINT food_item_discard_is_stamped CHECK (
    (state = 'DISCARDED') = (discarded_at IS NOT NULL)
  ),
  CONSTRAINT food_item_has_a_name CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_food_items_event
  ON event_food_items (event_id, state);

-- 3. Readings, in order. Interpolation assumes the temperature moved
--    monotonically between two consecutive readings; inserting one into the
--    middle of an interval after the fact would silently re-derive an exposure
--    figure somebody has already acted on, so it is refused.
CREATE TABLE IF NOT EXISTS food_temperature_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES event_food_items(id) ON DELETE CASCADE,
  celsius NUMERIC(5, 2) NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL,
  taken_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_reading_is_plausible CHECK (celsius BETWEEN -40 AND 250)
);

CREATE INDEX IF NOT EXISTS idx_food_readings_item_time
  ON food_temperature_readings (item_id, taken_at);

CREATE OR REPLACE FUNCTION food_readings_arrive_in_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_prepared TIMESTAMPTZ;
BEGIN
  SELECT prepared_at INTO v_prepared FROM event_food_items WHERE id = NEW.item_id;
  IF NEW.taken_at < v_prepared THEN
    RAISE EXCEPTION 'Reading predates the dish being prepared at %.', v_prepared;
  END IF;

  SELECT MAX(taken_at) INTO v_last
  FROM food_temperature_readings
  WHERE item_id = NEW.item_id;

  IF v_last IS NOT NULL AND NEW.taken_at < v_last THEN
    RAISE EXCEPTION 'Readings must be recorded in order; the last one was at %.', v_last;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_food_readings_in_order ON food_temperature_readings;
CREATE TRIGGER trg_food_readings_in_order
BEFORE INSERT ON food_temperature_readings
FOR EACH ROW EXECUTE FUNCTION food_readings_arrive_in_order();

-- 4. Corrective actions. Separate from readings because a reading observes the
--    dish and an action moves it, and only the second changes its state.
CREATE TABLE IF NOT EXISTS food_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES event_food_items(id) ON DELETE CASCADE,
  action_type VARCHAR(32) NOT NULL
    CHECK (action_type IN ('MOVED_TO_REFRIGERATION', 'ICE_BATH', 'REHEATED', 'DISCARDED')),
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_actions_item
  ON food_corrective_actions (item_id, occurred_at);

-- 5. Danger-zone seconds between two consecutive readings.
--
--    Three cases, and the third is the one worth having readings for:
--    both in the zone counts the whole interval, both out counts none of it,
--    and a crossing is interpolated to the instant the threshold was passed.
--    Rounding the third to either of the first two is the clipboard's error.
CREATE OR REPLACE FUNCTION food_exposure_seconds_between(
  p_holding_type VARCHAR,
  p_from_celsius NUMERIC,
  p_from_at TIMESTAMPTZ,
  p_to_celsius NUMERIC,
  p_to_at TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_span NUMERIC;
  v_from_in BOOLEAN;
  v_to_in BOOLEAN;
  v_threshold NUMERIC;
  v_fraction NUMERIC;
BEGIN
  v_span := EXTRACT(EPOCH FROM (p_to_at - p_from_at));
  IF v_span <= 0 THEN
    RETURN 0;
  END IF;

  v_from_in := food_is_in_danger_zone(p_holding_type, p_from_celsius);
  v_to_in := food_is_in_danger_zone(p_holding_type, p_to_celsius);

  IF v_from_in AND v_to_in THEN
    RETURN v_span;
  END IF;
  IF NOT v_from_in AND NOT v_to_in THEN
    RETURN 0;
  END IF;

  v_threshold := food_hold_threshold_celsius(p_holding_type);
  -- A crossing implies the two readings differ, so this cannot divide by zero.
  v_fraction := (v_threshold - p_from_celsius) / (p_to_celsius - p_from_celsius);
  v_fraction := LEAST(1, GREATEST(0, v_fraction));

  RETURN CASE WHEN v_from_in THEN v_span * v_fraction ELSE v_span * (1 - v_fraction) END;
END;
$$;

-- 6. Cumulative exposure for one dish as of an instant.
--
--    Exposure after the last reading is carried forward at that reading's
--    temperature rather than assumed away. An untouched tray last read at 45°C
--    two hours ago has been in the zone for two hours, and reporting zero for
--    that stretch because nobody wrote anything down is worse than no log at
--    all. The carried portion is returned separately so a large value reads as
--    "somebody needs to take a reading" and not as measured fact.
CREATE OR REPLACE FUNCTION food_cumulative_exposure(
  p_item_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  measured_minutes NUMERIC,
  carried_forward_minutes NUMERIC,
  cumulative_minutes NUMERIC,
  last_reading_at TIMESTAMPTZ,
  last_reading_celsius NUMERIC,
  in_danger_zone_now BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_item RECORD;
  v_measured NUMERIC := 0;
  v_carried NUMERIC := 0;
  v_last RECORD;
  v_horizon TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_item FROM event_food_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown food item %', p_item_id;
  END IF;

  SELECT COALESCE(SUM(
    food_exposure_seconds_between(
      v_item.holding_type, prev_celsius, prev_at, celsius, taken_at
    )
  ), 0) / 60.0
  INTO v_measured
  FROM (
    SELECT
      celsius,
      taken_at,
      LAG(celsius) OVER (ORDER BY taken_at, id) AS prev_celsius,
      LAG(taken_at) OVER (ORDER BY taken_at, id) AS prev_at
    FROM food_temperature_readings
    WHERE item_id = p_item_id AND taken_at <= p_assessed_at
  ) paired
  WHERE prev_at IS NOT NULL;

  SELECT celsius, taken_at INTO v_last
  FROM food_temperature_readings
  WHERE item_id = p_item_id AND taken_at <= p_assessed_at
  ORDER BY taken_at DESC, id DESC
  LIMIT 1;

  IF FOUND AND food_is_in_danger_zone(v_item.holding_type, v_last.celsius) THEN
    v_horizon := LEAST(p_assessed_at, COALESCE(v_item.discarded_at, p_assessed_at));
    v_carried := GREATEST(0, EXTRACT(EPOCH FROM (v_horizon - v_last.taken_at)) / 60.0);
  END IF;

  measured_minutes := ROUND(v_measured, 2);
  carried_forward_minutes := ROUND(v_carried, 2);
  cumulative_minutes := ROUND(v_measured + v_carried, 2);
  last_reading_at := v_last.taken_at;
  last_reading_celsius := v_last.celsius;
  in_danger_zone_now := COALESCE(
    food_is_in_danger_zone(v_item.holding_type, v_last.celsius), FALSE
  );
  RETURN NEXT;
END;
$$;

-- 7. The decision a volunteer actually reads.
CREATE OR REPLACE FUNCTION food_hold_decision(
  p_item_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  decision TEXT,
  cumulative_minutes NUMERIC,
  remaining_minutes NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_state VARCHAR;
  v_exposure NUMERIC;
BEGIN
  SELECT state INTO v_state FROM event_food_items WHERE id = p_item_id;
  SELECT e.cumulative_minutes INTO v_exposure
  FROM food_cumulative_exposure(p_item_id, p_assessed_at) e;

  cumulative_minutes := v_exposure;
  remaining_minutes := GREATEST(0, 240 - v_exposure);
  decision := CASE
    WHEN v_state = 'DISCARDED' OR v_exposure >= 240 THEN 'DISCARD'
    WHEN v_exposure >= 120 THEN 'WARN_APPROACHING_LIMIT'
    ELSE 'SERVABLE'
  END;
  RETURN NEXT;
END;
$$;

-- 8. Reheat a hot dish back into service.
--
--    Recorded as two readings at the same instant: the last known temperature
--    pinned forward, then the post-reheat temperature. Without the first,
--    interpolating from 45°C an hour ago straight to 78°C now would model the
--    tray as having climbed steadily all hour and would hand back most of the
--    accrued exposure — in the unsafe direction, for a dish that in fact sat at
--    45°C until somebody turned a burner on.
--
--    The clock does not reset. Reheating kills what grew in the zone but does
--    nothing about the toxins some of it left behind, which is exactly why the
--    cumulative limit sits alongside the temperature rule rather than being
--    replaced by it.
CREATE OR REPLACE FUNCTION reheat_food_item(
  p_item_id UUID,
  p_celsius NUMERIC,
  p_at TIMESTAMPTZ,
  p_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_decision TEXT;
  v_exposure NUMERIC;
  v_previous NUMERIC;
BEGIN
  SELECT * INTO v_item FROM event_food_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown food item %', p_item_id;
  END IF;

  IF v_item.state = 'DISCARDED' THEN
    RETURN 'REFUSED_ALREADY_DISCARDED';
  END IF;
  IF v_item.holding_type = 'COLD' THEN
    -- Cooling a cold dish back down is a corrective action, not a reheat, and
    -- calling it one would spend an allowance that does not apply to it.
    RETURN 'REFUSED_COLD_ITEM';
  END IF;
  IF v_item.reheats_used >= 1 THEN
    RETURN 'REFUSED_REHEAT_ALLOWANCE_SPENT';
  END IF;
  IF p_celsius < 74 THEN
    RETURN 'REFUSED_BELOW_REHEAT_TEMPERATURE';
  END IF;

  SELECT d.decision, d.cumulative_minutes INTO v_decision, v_exposure
  FROM food_hold_decision(p_item_id, p_at) d;

  IF v_decision = 'DISCARD' THEN
    -- Past the cumulative limit the temperature is no longer the question.
    RETURN 'REFUSED_PAST_CUMULATIVE_LIMIT';
  END IF;

  SELECT celsius INTO v_previous
  FROM food_temperature_readings
  WHERE item_id = p_item_id
  ORDER BY taken_at DESC, id DESC
  LIMIT 1;

  IF v_previous IS NOT NULL THEN
    INSERT INTO food_temperature_readings (item_id, celsius, taken_at, taken_by)
    VALUES (p_item_id, v_previous, p_at, p_by);
  END IF;

  INSERT INTO food_temperature_readings (item_id, celsius, taken_at, taken_by)
  VALUES (p_item_id, p_celsius, p_at, p_by);

  INSERT INTO food_corrective_actions (item_id, action_type, occurred_at, note, recorded_by)
  VALUES (
    p_item_id, 'REHEATED', p_at,
    format('Reheated to %s°C; %s minutes of exposure carried forward', p_celsius, v_exposure),
    p_by
  );

  UPDATE event_food_items
  SET reheats_used = reheats_used + 1, state = 'IN_SERVICE'
  WHERE id = p_item_id;

  RETURN 'RETURNED_TO_SERVICE';
END;
$$;

-- 9. The hourly sweep a catering lead runs across a whole event, worst first.
CREATE OR REPLACE FUNCTION sweep_event_food_holds(
  p_event_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  item_id UUID,
  item_name VARCHAR,
  decision TEXT,
  cumulative_minutes NUMERIC,
  remaining_minutes NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    i.id,
    i.name,
    d.decision,
    d.cumulative_minutes,
    d.remaining_minutes
  FROM event_food_items i
  CROSS JOIN LATERAL food_hold_decision(i.id, p_assessed_at) d
  WHERE i.event_id = p_event_id
  ORDER BY d.cumulative_minutes DESC, i.name ASC;
$$;

-- 10. Row level security. The hold log is operational rather than personal, so
--     any authenticated volunteer working the event can read it; writes go
--     through the functions above.
ALTER TABLE event_food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_corrective_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_items_authenticated_read ON event_food_items;
CREATE POLICY food_items_authenticated_read ON event_food_items
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS food_readings_authenticated_read ON food_temperature_readings;
CREATE POLICY food_readings_authenticated_read ON food_temperature_readings
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS food_readings_volunteer_insert ON food_temperature_readings;
CREATE POLICY food_readings_volunteer_insert ON food_temperature_readings
  FOR INSERT TO authenticated
  WITH CHECK (taken_by = auth.uid());

DROP POLICY IF EXISTS food_actions_authenticated_read ON food_corrective_actions;
CREATE POLICY food_actions_authenticated_read ON food_corrective_actions
  FOR SELECT TO authenticated
  USING (TRUE);

GRANT EXECUTE ON FUNCTION food_hold_threshold_celsius(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION food_is_in_danger_zone(VARCHAR, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION food_exposure_seconds_between(
  VARCHAR, NUMERIC, TIMESTAMPTZ, NUMERIC, TIMESTAMPTZ
) TO authenticated;
GRANT EXECUTE ON FUNCTION food_cumulative_exposure(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION food_hold_decision(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION sweep_event_food_holds(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION reheat_food_item(UUID, NUMERIC, TIMESTAMPTZ, UUID) TO authenticated;

COMMENT ON FUNCTION food_exposure_seconds_between(
  VARCHAR, NUMERIC, TIMESTAMPTZ, NUMERIC, TIMESTAMPTZ
) IS
  'Interpolates the crossing instant between two readings rather than rounding the interval in or out. Rounding it is the error a paper log makes.';
COMMENT ON FUNCTION food_cumulative_exposure(UUID, TIMESTAMPTZ) IS
  'Cumulative across the whole service; a gap in refrigeration pauses accrual and never resets it. Pure over the supplied assessment instant.';
