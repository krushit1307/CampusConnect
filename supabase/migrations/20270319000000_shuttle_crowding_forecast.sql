-- Migration: 20270319000000_shuttle_crowding_forecast.sql
-- Description: Schema and functions for the Campus Shuttle Crowding Forecast &
--              Surge Dispatch engine (#4386).
--
-- Privacy note: nothing in this migration stores a rider identifier. Boarding
-- telemetry is aggregate counts per stop per minute, which is all the forecast
-- needs and all that dispatch is permitted to hold.

-- 1. Shuttle stops served by the campus loop.
CREATE TABLE IF NOT EXISTS shuttle_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  scheduled_headway_minutes INTEGER NOT NULL CHECK (scheduled_headway_minutes > 0),
  seats_per_vehicle INTEGER NOT NULL CHECK (seats_per_vehicle > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Walking time from a venue to a stop. A stop with no row for a venue does
--    not serve that venue and is excluded from its forecast entirely.
CREATE TABLE IF NOT EXISTS shuttle_stop_venue_walks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID NOT NULL REFERENCES shuttle_stops(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL,
  walk_minutes NUMERIC(5, 2) NOT NULL CHECK (walk_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stop_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_shuttle_walks_venue
  ON shuttle_stop_venue_walks (venue_id);

-- 3. Aggregate boarding telemetry. observed_boardings counts riders who boarded
--    since the previous snapshot; observed_queue_length counts riders still
--    waiting at the instant of observation.
CREATE TABLE IF NOT EXISTS shuttle_boarding_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID NOT NULL REFERENCES shuttle_stops(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  observed_boardings INTEGER NOT NULL CHECK (observed_boardings >= 0),
  observed_queue_length INTEGER NOT NULL CHECK (observed_queue_length >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shuttle_snapshots_stop_time
  ON shuttle_boarding_snapshots (stop_id, observed_at DESC);

-- 4. Surge dispatch recommendations, retained so the cooldown survives a
--    restart and so dispatch has an audit trail of what it was told and when.
CREATE TABLE IF NOT EXISTS shuttle_surge_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID NOT NULL REFERENCES shuttle_stops(id) ON DELETE CASCADE,
  peak_bucket_start TIMESTAMPTZ NOT NULL,
  peak_saturation_ratio NUMERIC(6, 3) NOT NULL,
  unseated_riders INTEGER NOT NULL CHECK (unseated_riders >= 0),
  extra_vehicles_required INTEGER NOT NULL CHECK (extra_vehicles_required > 0),
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shuttle_recommendations_stop_raised
  ON shuttle_surge_recommendations (stop_id, raised_at DESC);

-- 5. Predicted boarding demand per stop per 10-minute bucket.
--
--    The crowd leaving a hall is not uniform: it peaks about a third of the way
--    into the dispersal window and tails off, so each minute of the window is
--    weighted by its distance from that apex. Riders then spend the stop's walk
--    time getting there, which shifts the whole curve later for distant stops.
CREATE OR REPLACE FUNCTION forecast_shuttle_demand(
  p_stop_code VARCHAR(64),
  p_evaluated_at TIMESTAMPTZ,
  p_dispersal_minutes INTEGER DEFAULT 20,
  p_shuttle_mode_share NUMERIC DEFAULT 0.6
)
RETURNS TABLE (
  bucket_start TIMESTAMPTZ,
  predicted_arrivals INTEGER,
  seat_supply NUMERIC,
  saturation_ratio NUMERIC,
  classification TEXT,
  unseated_riders INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop RECORD;
  v_seat_supply NUMERIC;
BEGIN
  SELECT s.id, s.seats_per_vehicle, s.scheduled_headway_minutes
  INTO v_stop
  FROM shuttle_stops s
  WHERE s.stop_code = p_stop_code AND s.is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive shuttle stop %', p_stop_code;
  END IF;

  -- Seats the standing timetable delivers inside one 10-minute bucket.
  v_seat_supply := (v_stop.seats_per_vehicle::NUMERIC * 10)
                   / v_stop.scheduled_headway_minutes::NUMERIC;

  RETURN QUERY
  WITH serving_events AS (
    -- Events whose venue this stop actually serves, inside the forecast horizon.
    SELECT
      e.id AS event_id,
      e.end_time,
      w.walk_minutes
    FROM events e
    JOIN shuttle_stop_venue_walks w
      ON w.venue_id = e.venue_id
     AND w.stop_id = v_stop.id
    WHERE e.end_time BETWEEN p_evaluated_at - INTERVAL '60 minutes'
                         AND p_evaluated_at + INTERVAL '60 minutes'
  ),
  -- One row per attendee, keeping only their earliest-ending event so a student
  -- who confirmed two concurrent events is counted once, not twice.
  deduped_attendees AS (
    SELECT DISTINCT ON (r.user_id)
      r.user_id,
      se.event_id,
      se.end_time,
      se.walk_minutes
    FROM rsvps r
    JOIN serving_events se ON se.event_id = r.event_id
    WHERE r.status = 'confirmed'
    ORDER BY r.user_id, se.end_time ASC, se.event_id ASC
  ),
  event_riders AS (
    SELECT
      d.event_id,
      d.end_time,
      d.walk_minutes,
      COUNT(*)::NUMERIC * p_shuttle_mode_share AS riders
    FROM deduped_attendees d
    GROUP BY d.event_id, d.end_time, d.walk_minutes
  ),
  -- Sample the dispersal window at one-minute resolution.
  dispersal AS (
    SELECT
      er.event_id,
      er.riders,
      er.end_time,
      er.walk_minutes,
      m.minute,
      GREATEST(
        0.05,
        1 - ABS(m.minute + 0.5 - (p_dispersal_minutes::NUMERIC / 3))
            / p_dispersal_minutes::NUMERIC
      ) AS weight
    FROM event_riders er
    CROSS JOIN generate_series(0, p_dispersal_minutes - 1) AS m(minute)
  ),
  normalized AS (
    SELECT
      d.event_id,
      d.riders,
      d.weight / SUM(d.weight) OVER (PARTITION BY d.event_id) AS share,
      to_timestamp(
        FLOOR(
          EXTRACT(EPOCH FROM (
            d.end_time + (d.minute + d.walk_minutes) * INTERVAL '1 minute'
          )) / 600
        ) * 600
      ) AS bucket_start
    FROM dispersal d
  ),
  bucketed AS (
    SELECT
      n.bucket_start,
      ROUND(SUM(n.riders * n.share))::INTEGER AS predicted_arrivals
    FROM normalized n
    GROUP BY n.bucket_start
  )
  SELECT
    b.bucket_start,
    b.predicted_arrivals,
    ROUND(v_seat_supply, 3) AS seat_supply,
    ROUND(b.predicted_arrivals::NUMERIC / v_seat_supply, 3) AS saturation_ratio,
    CASE
      WHEN b.predicted_arrivals::NUMERIC / v_seat_supply >= 1.5 THEN 'OVERFLOW'
      WHEN b.predicted_arrivals::NUMERIC / v_seat_supply >= 1.0 THEN 'SATURATED'
      WHEN b.predicted_arrivals::NUMERIC / v_seat_supply >= 0.75 THEN 'ELEVATED'
      ELSE 'NOMINAL'
    END AS classification,
    GREATEST(0, b.predicted_arrivals - FLOOR(v_seat_supply)::INTEGER) AS unseated_riders
  FROM bucketed b
  ORDER BY b.bucket_start;
END;
$$;

-- 6. Raise a surge recommendation, honouring the per-stop cooldown so dispatch
--    is not paged repeatedly for the same let-out.
CREATE OR REPLACE FUNCTION raise_shuttle_surge_recommendation(
  p_stop_code VARCHAR(64),
  p_evaluated_at TIMESTAMPTZ,
  p_cooldown_minutes INTEGER DEFAULT 20
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop_id UUID;
  v_seats INTEGER;
  v_peak RECORD;
  v_unseated INTEGER;
  v_vehicles INTEGER;
  v_last_raised TIMESTAMPTZ;
  v_recommendation_id UUID;
BEGIN
  SELECT s.id, s.seats_per_vehicle INTO v_stop_id, v_seats
  FROM shuttle_stops s
  WHERE s.stop_code = p_stop_code AND s.is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive shuttle stop %', p_stop_code;
  END IF;

  SELECT r.raised_at INTO v_last_raised
  FROM shuttle_surge_recommendations r
  WHERE r.stop_id = v_stop_id
  ORDER BY r.raised_at DESC
  LIMIT 1;

  IF v_last_raised IS NOT NULL
     AND p_evaluated_at - v_last_raised < (p_cooldown_minutes * INTERVAL '1 minute') THEN
    -- Still inside the cooldown; the caller already knows about this stop.
    RETURN NULL;
  END IF;

  SELECT f.bucket_start, f.saturation_ratio, f.classification
  INTO v_peak
  FROM forecast_shuttle_demand(p_stop_code, p_evaluated_at) f
  ORDER BY f.saturation_ratio DESC
  LIMIT 1;

  IF NOT FOUND OR v_peak.classification IN ('NOMINAL', 'ELEVATED') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(f.unseated_riders), 0)
  INTO v_unseated
  FROM forecast_shuttle_demand(p_stop_code, p_evaluated_at) f;

  v_vehicles := GREATEST(1, CEIL(v_unseated::NUMERIC / v_seats)::INTEGER);

  INSERT INTO shuttle_surge_recommendations (
    stop_id, peak_bucket_start, peak_saturation_ratio,
    unseated_riders, extra_vehicles_required, message, raised_at
  )
  VALUES (
    v_stop_id,
    v_peak.bucket_start,
    v_peak.saturation_ratio,
    v_unseated,
    v_vehicles,
    FORMAT(
      '%s is forecast to reach %s%% of scheduled seat supply at %s. %s rider(s) would be left behind; dispatch %s additional vehicle(s).',
      p_stop_code,
      ROUND(v_peak.saturation_ratio * 100),
      to_char(v_peak.bucket_start, 'HH24:MI'),
      v_unseated,
      v_vehicles
    ),
    p_evaluated_at
  )
  RETURNING id INTO v_recommendation_id;

  RETURN v_recommendation_id;
END;
$$;

-- 7. Row level security. Telemetry is written by the service role only; stop
--    definitions and recommendations are readable by authenticated staff.
ALTER TABLE shuttle_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_stop_venue_walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_boarding_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_surge_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shuttle_stops_read ON shuttle_stops;
CREATE POLICY shuttle_stops_read ON shuttle_stops
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS shuttle_walks_read ON shuttle_stop_venue_walks;
CREATE POLICY shuttle_walks_read ON shuttle_stop_venue_walks
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS shuttle_snapshots_service_write ON shuttle_boarding_snapshots;
CREATE POLICY shuttle_snapshots_service_write ON shuttle_boarding_snapshots
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS shuttle_recommendations_read ON shuttle_surge_recommendations;
CREATE POLICY shuttle_recommendations_read ON shuttle_surge_recommendations
  FOR SELECT TO authenticated USING (TRUE);

GRANT EXECUTE ON FUNCTION forecast_shuttle_demand(VARCHAR, TIMESTAMPTZ, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION raise_shuttle_surge_recommendation(VARCHAR, TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON TABLE shuttle_boarding_snapshots IS
  'Aggregate boarding counts per stop. Deliberately holds no rider identifiers.';
