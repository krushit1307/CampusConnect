-- Migration: 20270320000000_event_waste_diversion_audit.sql
-- Description: Schema and functions for the Event Waste Diversion Audit &
--              Contamination Scorecard (#4387).
--
-- A diversion rate taken at face value lies: a recycling bag with food scraps
-- in it is landfill, whatever the bin said. Every computation below reclassifies
-- the contaminated fraction of a diverted stream into landfill before taking the
-- ratio, and reports the naive figure alongside so the cost is legible.

-- 1. Weighed disposal streams. The same stream type may be recorded more than
--    once for a large event, so these accumulate rather than overwrite.
CREATE TABLE IF NOT EXISTS event_waste_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stream_type VARCHAR(16) NOT NULL
    CHECK (stream_type IN ('LANDFILL', 'RECYCLING', 'COMPOST', 'DONATED')),
  gross_weight_kg NUMERIC(10, 3) NOT NULL CHECK (gross_weight_kg >= 0),
  contamination_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (contamination_percent >= 0 AND contamination_percent <= 100),
  container_count INTEGER NOT NULL DEFAULT 0 CHECK (container_count >= 0),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Everything in the landfill stream is already going to landfill, so a
  -- contamination figure on it is meaningless and almost always a data slip.
  CONSTRAINT landfill_is_never_contaminated
    CHECK (stream_type <> 'LANDFILL' OR contamination_percent = 0)
);

CREATE INDEX IF NOT EXISTS idx_waste_streams_event
  ON event_waste_streams (event_id, stream_type);

-- 2. The computed audit. Finalised audits are reported upward, so once one is
--    locked the underlying weights must stop moving.
CREATE TABLE IF NOT EXISTS event_waste_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  attendance INTEGER NOT NULL CHECK (attendance >= 0),
  total_waste_kg NUMERIC(12, 3) NOT NULL CHECK (total_waste_kg >= 0),
  diverted_kg NUMERIC(12, 3) NOT NULL CHECK (diverted_kg >= 0),
  landfill_kg NUMERIC(12, 3) NOT NULL CHECK (landfill_kg >= 0),
  diversion_rate NUMERIC(5, 3) NOT NULL CHECK (diversion_rate >= 0 AND diversion_rate <= 1),
  naive_diversion_rate NUMERIC(5, 3) NOT NULL,
  grade CHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  intensity_kg_per_attendee NUMERIC(8, 3) NOT NULL CHECK (intensity_kg_per_attendee >= 0),
  flags TEXT[] NOT NULL DEFAULT '{}',
  finalized BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES auth.users(id),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Mass must balance: what was diverted plus what went to landfill is the total.
  CONSTRAINT waste_mass_balances
    CHECK (ABS((diverted_kg + landfill_kg) - total_waste_kg) < 0.01),
  CONSTRAINT finalized_carries_a_timestamp
    CHECK (finalized = FALSE OR finalized_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_waste_audits_club_finalized
  ON event_waste_audits (club_id, finalized_at DESC)
  WHERE finalized;

-- 3. Guard: a finalised audit freezes its streams.
CREATE OR REPLACE FUNCTION reject_finalized_waste_stream_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);

  IF EXISTS (
    SELECT 1 FROM event_waste_audits a
    WHERE a.event_id = v_event_id AND a.finalized
  ) THEN
    RAISE EXCEPTION
      'The audit for event % is finalized and its streams can no longer be edited.',
      v_event_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_waste_streams_frozen ON event_waste_streams;
CREATE TRIGGER trg_waste_streams_frozen
  BEFORE INSERT OR UPDATE OR DELETE ON event_waste_streams
  FOR EACH ROW EXECUTE FUNCTION reject_finalized_waste_stream_edit();

-- 4. Collapse an event's streams into one row per type, applying the
--    contamination reclassification.
--
--    A 40 kg recycling stream at 25% contamination contributes 30 kg diverted
--    and 10 kg landfill. Contamination across repeated skips of the same type is
--    mass-weighted, so a 100 kg skip at 5% is not averaged flat against a 2 kg
--    bin at 90%.
CREATE OR REPLACE FUNCTION build_waste_stream_breakdown(p_event_id UUID)
RETURNS TABLE (
  stream_type VARCHAR(16),
  gross_weight_kg NUMERIC,
  contamination_percent NUMERIC,
  effective_diverted_kg NUMERIC,
  reclassified_to_landfill_kg NUMERIC,
  container_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH classified AS (
    SELECT
      s.stream_type,
      s.gross_weight_kg,
      s.container_count,
      s.stream_type <> 'LANDFILL' AS is_diverted,
      CASE
        WHEN s.stream_type = 'LANDFILL' THEN s.gross_weight_kg
        ELSE s.gross_weight_kg * (s.contamination_percent / 100.0)
      END AS to_landfill_kg,
      CASE
        WHEN s.stream_type = 'LANDFILL' THEN 0
        ELSE s.gross_weight_kg * (1 - s.contamination_percent / 100.0)
      END AS diverted_kg
    FROM event_waste_streams s
    WHERE s.event_id = p_event_id
  )
  SELECT
    c.stream_type,
    ROUND(SUM(c.gross_weight_kg), 3) AS gross_weight_kg,
    CASE
      WHEN bool_or(c.is_diverted) AND SUM(c.gross_weight_kg) > 0
        THEN ROUND(SUM(c.to_landfill_kg) / SUM(c.gross_weight_kg) * 100, 2)
      ELSE 0
    END AS contamination_percent,
    ROUND(SUM(c.diverted_kg), 3) AS effective_diverted_kg,
    ROUND(SUM(c.to_landfill_kg), 3) AS reclassified_to_landfill_kg,
    SUM(c.container_count)::INTEGER AS container_count
  FROM classified c
  GROUP BY c.stream_type
  ORDER BY SUM(c.gross_weight_kg) DESC;
$$;

-- 5. Compute (and upsert) the audit for an event.
CREATE OR REPLACE FUNCTION compute_event_waste_audit(
  p_event_id UUID,
  p_club_id UUID,
  p_attendance INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC := 0;
  v_diverted NUMERIC := 0;
  v_landfill NUMERIC := 0;
  v_naive_diverted NUMERIC := 0;
  v_rate NUMERIC := 0;
  v_naive_rate NUMERIC := 0;
  v_intensity NUMERIC := 0;
  v_grade CHAR(1);
  v_flags TEXT[] := '{}';
  v_worst_contamination NUMERIC := 0;
  v_audit_id UUID;
BEGIN
  IF p_attendance < 0 THEN
    RAISE EXCEPTION 'Attendance must be a non-negative whole number.';
  END IF;

  IF EXISTS (SELECT 1 FROM event_waste_audits WHERE event_id = p_event_id AND finalized) THEN
    RAISE EXCEPTION 'The audit for event % is finalized.', p_event_id;
  END IF;

  SELECT
    COALESCE(SUM(b.gross_weight_kg), 0),
    COALESCE(SUM(b.effective_diverted_kg), 0),
    COALESCE(SUM(b.gross_weight_kg) FILTER (WHERE b.stream_type <> 'LANDFILL'), 0),
    COALESCE(MAX(b.contamination_percent) FILTER (WHERE b.stream_type <> 'LANDFILL'), 0)
  INTO v_total, v_diverted, v_naive_diverted, v_worst_contamination
  FROM build_waste_stream_breakdown(p_event_id) b;

  v_landfill := v_total - v_diverted;

  IF v_total > 0 THEN
    v_rate := ROUND(v_diverted / v_total, 3);
    v_naive_rate := ROUND(v_naive_diverted / v_total, 3);
  END IF;

  -- Normalising by attendance is what makes a 2000-person fest comparable to a
  -- 30-person workshop.
  IF p_attendance > 0 THEN
    v_intensity := ROUND(v_total / p_attendance, 3);
  END IF;

  v_grade := CASE
    WHEN v_rate >= 0.80 THEN 'A'
    WHEN v_rate >= 0.65 THEN 'B'
    WHEN v_rate >= 0.50 THEN 'C'
    WHEN v_rate >= 0.30 THEN 'D'
    ELSE 'F'
  END;

  IF v_total = 0 THEN
    v_flags := ARRAY['NO_MEASUREMENT'];
  ELSE
    IF v_worst_contamination > 20 THEN
      v_flags := array_append(v_flags, 'CONTAMINATION_CRITICAL');
    END IF;
    IF v_intensity > 1.5 THEN
      v_flags := array_append(v_flags, 'HIGH_INTENSITY');
    END IF;
  END IF;

  INSERT INTO event_waste_audits (
    event_id, club_id, attendance, total_waste_kg, diverted_kg, landfill_kg,
    diversion_rate, naive_diversion_rate, grade, intensity_kg_per_attendee,
    flags, computed_at
  )
  VALUES (
    p_event_id, p_club_id, p_attendance, ROUND(v_total, 3), ROUND(v_diverted, 3),
    ROUND(v_landfill, 3), v_rate, v_naive_rate, v_grade, v_intensity, v_flags, NOW()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    club_id = EXCLUDED.club_id,
    attendance = EXCLUDED.attendance,
    total_waste_kg = EXCLUDED.total_waste_kg,
    diverted_kg = EXCLUDED.diverted_kg,
    landfill_kg = EXCLUDED.landfill_kg,
    diversion_rate = EXCLUDED.diversion_rate,
    naive_diversion_rate = EXCLUDED.naive_diversion_rate,
    grade = EXCLUDED.grade,
    intensity_kg_per_attendee = EXCLUDED.intensity_kg_per_attendee,
    flags = EXCLUDED.flags,
    computed_at = NOW()
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- 6. Lock an audit. An audit with nothing weighed cannot be finalised, because
--    a reported zero and an unmeasured zero are not the same claim.
CREATE OR REPLACE FUNCTION finalize_event_waste_audit(
  p_event_id UUID,
  p_finalized_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit RECORD;
BEGIN
  SELECT * INTO v_audit FROM event_waste_audits WHERE event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No audit has been computed for event %.', p_event_id;
  END IF;
  IF v_audit.finalized THEN
    RAISE EXCEPTION 'The audit for event % is already finalized.', p_event_id;
  END IF;
  IF v_audit.total_waste_kg = 0 THEN
    RAISE EXCEPTION 'An audit with no measured waste cannot be finalized.';
  END IF;

  UPDATE event_waste_audits
  SET finalized = TRUE, finalized_at = NOW(), finalized_by = p_finalized_by
  WHERE event_id = p_event_id;

  RETURN TRUE;
END;
$$;

-- 7. A club measured against itself. Only finalised audits count: letting a
--    draft move the trend line makes the chart jump while someone is still
--    typing weights in.
CREATE OR REPLACE FUNCTION get_club_waste_trend(
  p_club_id UUID,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  event_id UUID,
  diversion_rate NUMERIC,
  grade CHAR(1),
  intensity_kg_per_attendee NUMERIC,
  delta_vs_previous NUMERIC,
  finalized_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH window_audits AS (
    SELECT a.event_id, a.diversion_rate, a.grade,
           a.intensity_kg_per_attendee, a.finalized_at
    FROM event_waste_audits a
    WHERE a.club_id = p_club_id AND a.finalized
    ORDER BY a.finalized_at DESC
    LIMIT p_limit
  )
  SELECT
    w.event_id,
    w.diversion_rate,
    w.grade,
    w.intensity_kg_per_attendee,
    ROUND(
      w.diversion_rate - LAG(w.diversion_rate) OVER (ORDER BY w.finalized_at ASC),
      3
    ) AS delta_vs_previous,
    w.finalized_at
  FROM window_audits w
  ORDER BY w.finalized_at ASC;
$$;

-- 8. Row level security.
ALTER TABLE event_waste_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waste_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waste_streams_read ON event_waste_streams;
CREATE POLICY waste_streams_read ON event_waste_streams
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS waste_streams_organizer_write ON event_waste_streams;
CREATE POLICY waste_streams_organizer_write ON event_waste_streams
  FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());

DROP POLICY IF EXISTS waste_audits_read ON event_waste_audits;
CREATE POLICY waste_audits_read ON event_waste_audits
  FOR SELECT TO authenticated USING (TRUE);

GRANT EXECUTE ON FUNCTION build_waste_stream_breakdown(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_event_waste_audit(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_event_waste_audit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_club_waste_trend(UUID, INTEGER) TO authenticated;

COMMENT ON COLUMN event_waste_audits.naive_diversion_rate IS
  'The rate before contamination reclassification. Kept so the cost of a badly sorted bin is visible next to the honest figure.';
