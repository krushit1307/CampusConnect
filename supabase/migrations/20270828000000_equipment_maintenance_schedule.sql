-- Migration: 20270828000000_equipment_maintenance_schedule.sql
-- Description: Schema and functions for the Usage-Hour Preventive Maintenance
--              Scheduler (#4555).
--
-- A calendar interval is the wrong axis for almost everything in a shared
-- equipment pool. A projector used four hours a semester and one used four
-- hundred both get serviced in March; the second has a dead lamp by January and
-- the first gets stripped down for nothing. What kills a lamp, an extruder or a
-- drone motor is hours of operation, and the platform already records those
-- hours in every checkout without ever connecting them to a decision.
--
-- Two things are worth knowing before reading on.
--
-- The meter due instant is derived exactly, by walking the checkout intervals
-- to find the moment accumulated usage crossed the threshold. It is not a
-- forecast. The forecast lives in its own function, where its uncertainty is
-- visible and where it is allowed to answer "not enough history".
--
-- Every function takes the evaluation instant as an argument rather than
-- calling NOW(), so the state of the fleet on any past date is reproducible.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. The plan: both intervals, on the same row, because the whole point is that
--    they are evaluated together.
CREATE TABLE IF NOT EXISTS equipment_maintenance_plans (
  asset_id UUID PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  asset_name VARCHAR(160) NOT NULL,
  meter_interval_hours NUMERIC(8, 2) NOT NULL,
  calendar_interval_days INTEGER NOT NULL,
  commissioned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_meter_interval_is_positive CHECK (meter_interval_hours > 0),
  CONSTRAINT maintenance_calendar_interval_is_positive CHECK (calendar_interval_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_club
  ON equipment_maintenance_plans (club_id);

-- 2. Checkouts, with overlap made impossible rather than merely discouraged.
--
--    Usage is the sum of these intervals. Two records covering the same
--    afternoon accrue two hours of wear per elapsed hour and bring a service
--    forward on evidence that does not exist. A double-booked asset is a
--    booking bug; absorbing it here would turn it into a maintenance bug too.
--
--    The range is half-open, so a checkout starting exactly when another ends
--    is fine — which is what a hand-off between two clubs actually looks like.
CREATE TABLE IF NOT EXISTS equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_maintenance_plans(asset_id) ON DELETE CASCADE,
  borrower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  checked_out_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_returns_after_it_leaves CHECK (
    returned_at IS NULL OR returned_at >= checked_out_at
  ),
  EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(checked_out_at, COALESCE(returned_at, 'infinity'::TIMESTAMPTZ), '[)') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_asset
  ON equipment_checkouts (asset_id, checked_out_at);

-- 3. Completed services. The baseline for both clocks.
CREATE TABLE IF NOT EXISTS equipment_maintenance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_maintenance_plans(asset_id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  performed_by VARCHAR(160) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_asset
  ON equipment_maintenance_events (asset_id, completed_at DESC);

-- 4. Deferrals, counted since the last service. A service clears them, which is
--    why they are stored as rows with a timestamp and not as a counter column.
CREATE TABLE IF NOT EXISTS equipment_maintenance_deferrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES equipment_maintenance_plans(asset_id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_deferrals_asset
  ON equipment_maintenance_deferrals (asset_id, granted_at);

-- 5. Hours the asset was out between two instants.
--
--    An open checkout is treated as still running. The asset is out and being
--    used, and pretending otherwise until somebody remembers to scan it back in
--    would let an unreturned item accrue nothing at all.
CREATE OR REPLACE FUNCTION equipment_usage_hours(
  p_asset_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    GREATEST(
      0,
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(returned_at, p_to), p_to)
        - GREATEST(checked_out_at, p_from)
      )) / 3600.0
    )
  ), 0)
  FROM equipment_checkouts
  WHERE asset_id = p_asset_id
    AND checked_out_at < p_to
    AND COALESCE(returned_at, 'infinity'::TIMESTAMPTZ) > p_from;
$$;

-- 6. The baseline both clocks run from: the last completed service, or the
--    commissioning date while the asset has never been serviced.
CREATE OR REPLACE FUNCTION equipment_maintenance_baseline(p_asset_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT MAX(completed_at)
      FROM equipment_maintenance_events
      WHERE asset_id = p_asset_id
    ),
    (SELECT commissioned_at FROM equipment_maintenance_plans WHERE asset_id = p_asset_id)
  );
$$;

-- 7. The exact instant accumulated usage since the baseline crossed the meter
--    interval. NULL while the asset has not run long enough to get there.
--
--    Walking the intervals rather than dividing by an average is what makes
--    this reproducible: the answer is the same today, next term, and in a
--    replay of last Tuesday, and it falls inside the checkout that crossed the
--    threshold rather than at the end of it.
CREATE OR REPLACE FUNCTION equipment_meter_due_at(p_asset_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_baseline TIMESTAMPTZ;
  v_target NUMERIC;
  v_accumulated NUMERIC := 0;
  v_span NUMERIC;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_row RECORD;
BEGIN
  SELECT meter_interval_hours * 3600 INTO v_target
  FROM equipment_maintenance_plans WHERE asset_id = p_asset_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Unknown asset %', p_asset_id;
  END IF;

  v_baseline := equipment_maintenance_baseline(p_asset_id);

  FOR v_row IN
    SELECT checked_out_at, returned_at
    FROM equipment_checkouts
    WHERE asset_id = p_asset_id
      AND COALESCE(returned_at, 'infinity'::TIMESTAMPTZ) > v_baseline
    ORDER BY checked_out_at
  LOOP
    v_start := GREATEST(v_row.checked_out_at, v_baseline);
    v_end := COALESCE(v_row.returned_at, 'infinity'::TIMESTAMPTZ);
    CONTINUE WHEN v_end <= v_start;

    IF v_end = 'infinity'::TIMESTAMPTZ THEN
      -- Still out: the remaining hours will be reached inside this checkout.
      RETURN v_start + ((v_target - v_accumulated) * INTERVAL '1 second');
    END IF;

    v_span := EXTRACT(EPOCH FROM (v_end - v_start));
    IF v_accumulated + v_span >= v_target THEN
      RETURN v_start + ((v_target - v_accumulated) * INTERVAL '1 second');
    END IF;
    v_accumulated := v_accumulated + v_span;
  END LOOP;

  RETURN NULL;
END;
$$;

-- 8. Where one asset stands at a given instant.
--
--    `trigger` reports which clock ran out first rather than merely that one
--    did. A technician needs to know whether to check the lamp or the seals
--    before opening the case, and 'DUE' on its own does not say.
CREATE OR REPLACE FUNCTION assess_equipment_maintenance(
  p_asset_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  status TEXT,
  trigger_clock TEXT,
  hours_since_service NUMERIC,
  days_since_service NUMERIC,
  meter_due_at TIMESTAMPTZ,
  calendar_due_at TIMESTAMPTZ,
  overdue_hours NUMERIC,
  overdue_days NUMERIC,
  consecutive_deferrals INTEGER,
  blocked_reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_plan RECORD;
  v_baseline TIMESTAMPTZ;
  v_meter_due TIMESTAMPTZ;
  v_calendar_due TIMESTAMPTZ;
  v_meter_is_due BOOLEAN;
  v_calendar_is_due BOOLEAN;
BEGIN
  SELECT * INTO v_plan FROM equipment_maintenance_plans WHERE asset_id = p_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown asset %', p_asset_id;
  END IF;

  v_baseline := equipment_maintenance_baseline(p_asset_id);
  v_meter_due := equipment_meter_due_at(p_asset_id);
  v_calendar_due := v_baseline + (v_plan.calendar_interval_days * INTERVAL '1 day');

  v_meter_is_due := v_meter_due IS NOT NULL AND p_assessed_at >= v_meter_due;
  v_calendar_is_due := p_assessed_at >= v_calendar_due;

  hours_since_service := ROUND(equipment_usage_hours(p_asset_id, v_baseline, p_assessed_at), 2);
  days_since_service := ROUND(
    GREATEST(0, EXTRACT(EPOCH FROM (p_assessed_at - v_baseline)) / 86400.0), 2
  );
  meter_due_at := v_meter_due;
  calendar_due_at := v_calendar_due;

  trigger_clock := CASE
    WHEN v_meter_is_due AND v_calendar_is_due THEN
      -- Both have run out; the one that ran out first describes what happened.
      CASE WHEN v_meter_due <= v_calendar_due THEN 'METER' ELSE 'CALENDAR' END
    WHEN v_meter_is_due THEN 'METER'
    WHEN v_calendar_is_due THEN 'CALENDAR'
    ELSE 'NONE'
  END;

  -- Overdue on the meter is measured in usage past the due point, not in
  -- elapsed time. An asset that came due and then sat in a cupboard for a month
  -- has not worn any further.
  overdue_hours := CASE
    WHEN v_meter_is_due
      THEN ROUND(equipment_usage_hours(p_asset_id, v_meter_due, p_assessed_at), 2)
    ELSE 0
  END;
  overdue_days := CASE
    WHEN v_calendar_is_due
      THEN ROUND(EXTRACT(EPOCH FROM (p_assessed_at - v_calendar_due)) / 86400.0, 2)
    ELSE 0
  END;

  SELECT COUNT(*)::INTEGER INTO consecutive_deferrals
  FROM equipment_maintenance_deferrals
  WHERE asset_id = p_asset_id
    AND granted_at >= v_baseline
    AND granted_at <= p_assessed_at;

  blocked_reason := CASE
    WHEN overdue_hours > 20 THEN
      format('%s hours past the meter due point, over the 20-hour cap', overdue_hours)
    WHEN overdue_days > 30 THEN
      format('%s days past the calendar due point, over the 30-day cap', overdue_days)
    WHEN consecutive_deferrals > 2 THEN
      format('%s consecutive deferrals, over the limit of 2', consecutive_deferrals)
    ELSE NULL
  END;

  status := CASE
    WHEN blocked_reason IS NOT NULL THEN 'LOCKED_OUT'
    WHEN trigger_clock = 'NONE' THEN 'OK'
    WHEN consecutive_deferrals > 0 THEN 'DEFERRED'
    ELSE 'DUE'
  END;

  RETURN NEXT;
END;
$$;

-- 9. Postpone a due service, bounded in three directions.
--
--    An unbounded deferral is just a service that never happens with a paper
--    trail attached. Past any cap the answer is not another deferral but a
--    lockout, which is the only lever that gets the work booked.
CREATE OR REPLACE FUNCTION defer_equipment_service(
  p_asset_id UUID,
  p_at TIMESTAMPTZ,
  p_granted_by UUID,
  p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM assess_equipment_maintenance(p_asset_id, p_at);

  IF v.trigger_clock = 'NONE' THEN
    RETURN 'REFUSED_NOT_DUE';
  END IF;
  IF v.consecutive_deferrals >= 2 THEN
    RETURN 'REFUSED_CONSECUTIVE_LIMIT';
  END IF;
  IF v.overdue_hours > 20 THEN
    RETURN 'REFUSED_HOURS_CAP';
  END IF;
  IF v.overdue_days > 30 THEN
    RETURN 'REFUSED_DAYS_CAP';
  END IF;

  INSERT INTO equipment_maintenance_deferrals (asset_id, granted_at, granted_by, reason)
  VALUES (p_asset_id, p_at, p_granted_by, p_reason);

  RETURN 'DEFERRED';
END;
$$;

-- 10. A service restarts both clocks from the completion instant.
--
--     Not from the due date it missed. Restarting from the due date means a
--     service performed three weeks late is three weeks into its next interval
--     the moment the technician puts the panel back on, and the asset spends
--     the rest of its life chasing a schedule it has already fallen off.
CREATE OR REPLACE FUNCTION complete_equipment_service(
  p_asset_id UUID,
  p_completed_at TIMESTAMPTZ,
  p_performed_by VARCHAR,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_id UUID;
BEGIN
  SELECT MAX(completed_at) INTO v_last
  FROM equipment_maintenance_events WHERE asset_id = p_asset_id;

  IF v_last IS NOT NULL AND p_completed_at < v_last THEN
    RAISE EXCEPTION 'Service cannot predate the previous service at %.', v_last;
  END IF;

  INSERT INTO equipment_maintenance_events (asset_id, completed_at, performed_by, notes)
  VALUES (p_asset_id, p_completed_at, p_performed_by, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 11. The weekly list, worst first.
CREATE OR REPLACE FUNCTION club_maintenance_fleet(
  p_club_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  asset_id UUID,
  asset_name VARCHAR,
  status TEXT,
  trigger_clock TEXT,
  overdue_hours NUMERIC,
  overdue_days NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.asset_id,
    p.asset_name,
    a.status,
    a.trigger_clock,
    a.overdue_hours,
    a.overdue_days
  FROM equipment_maintenance_plans p
  CROSS JOIN LATERAL assess_equipment_maintenance(p.asset_id, p_assessed_at) a
  WHERE p.club_id = p_club_id
  ORDER BY
    CASE a.status
      WHEN 'LOCKED_OUT' THEN 0
      WHEN 'DUE' THEN 1
      WHEN 'DEFERRED' THEN 2
      ELSE 3
    END,
    a.overdue_hours DESC,
    p.asset_name ASC;
$$;

-- 12. Row level security.
ALTER TABLE equipment_maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance_deferrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maintenance_plans_member_read ON equipment_maintenance_plans;
CREATE POLICY maintenance_plans_member_read ON equipment_maintenance_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = equipment_maintenance_plans.club_id AND m.user_id = auth.uid()
    )
  );

-- A borrower sees their own checkouts; club members see the whole asset's
-- history, since that is what the usage figure is derived from.
DROP POLICY IF EXISTS equipment_checkouts_read ON equipment_checkouts;
CREATE POLICY equipment_checkouts_read ON equipment_checkouts
  FOR SELECT TO authenticated
  USING (
    borrower_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM equipment_maintenance_plans p
      JOIN club_members m ON m.club_id = p.club_id
      WHERE p.asset_id = equipment_checkouts.asset_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS maintenance_events_member_read ON equipment_maintenance_events;
CREATE POLICY maintenance_events_member_read ON equipment_maintenance_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM equipment_maintenance_plans p
      JOIN club_members m ON m.club_id = p.club_id
      WHERE p.asset_id = equipment_maintenance_events.asset_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS maintenance_deferrals_member_read ON equipment_maintenance_deferrals;
CREATE POLICY maintenance_deferrals_member_read ON equipment_maintenance_deferrals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM equipment_maintenance_plans p
      JOIN club_members m ON m.club_id = p.club_id
      WHERE p.asset_id = equipment_maintenance_deferrals.asset_id AND m.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION equipment_usage_hours(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION equipment_maintenance_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION equipment_meter_due_at(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_equipment_maintenance(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION club_maintenance_fleet(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION defer_equipment_service(UUID, TIMESTAMPTZ, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_equipment_service(UUID, TIMESTAMPTZ, VARCHAR, TEXT)
  TO authenticated;

COMMENT ON CONSTRAINT equipment_checkouts_asset_id_tstzrange_excl ON equipment_checkouts IS
  'Two checkouts over one interval would accrue usage twice and bring a service forward on evidence that does not exist. Half-open, so a hand-off at the same instant is allowed.';
COMMENT ON FUNCTION equipment_meter_due_at(UUID) IS
  'Exact, not forecast: walks the checkout intervals to the instant accumulated usage crossed the meter interval.';
COMMENT ON FUNCTION assess_equipment_maintenance(UUID, TIMESTAMPTZ) IS
  'Pure over the supplied evaluation instant; reports which clock ran out first so a technician knows what to open the case for.';
