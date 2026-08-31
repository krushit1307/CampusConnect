-- Migration: 20270902000000_rigging_load_budget.sql
-- Description: Schema and functions for the Stage Rigging Load Budget — the
--              per-point and whole-structure limits, bridle leg tension, and
--              certification that governs capacity rather than annotating it
--              (#4703).
--
-- A roof beam has two limits and the one people quote is the one that rarely
-- fails. A beam rated for 500 kg total will hold 500 kg spread over eight
-- points and fail at 300 kg concentrated on one. The per-point limit is what
-- actually breaks, and it is the one nobody writes on the booking form.
--
-- The number that goes into the calculation is usually wrong before the
-- calculation starts. Hang 100 kg from two legs and people assume 50 kg each.
-- That is only true if the legs hang straight down. Spread them to an included
-- angle of 120 degrees and each leg carries the full 100 kg.
--
-- Hence the asymmetry this schema is built around: the structure's *total* sees
-- the vertical component, which is just the weight, while each *point* sees the
-- leg tension, which is not. Rating both against the same figure gets one of
-- them wrong, and which one depends on the angle.
--
-- Certification is not a warning here. An element whose inspection has expired
-- has an effective SWL of zero, because a warning printed next to a green total
-- is a warning that gets scrolled past.
--
-- Loads are NUMERIC(10,1) kilogrammes throughout. Rigging is quoted to a tenth
-- of a kilogramme and a binary float that disagrees with the printed plan by a
-- gram is a discrepancy somebody has to stop and explain on a get-in.

-- 1. Structures. The two limits are separate columns because they are separate
--    limits, and the constraint stops the transcription error that reads as
--    generous rather than as wrong.
CREATE TABLE IF NOT EXISTS rigging_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  structure_kind VARCHAR(16) NOT NULL DEFAULT 'BEAM'
    CHECK (structure_kind IN ('BEAM', 'TRUSS', 'BAR', 'GRID')),
  total_swl_kg NUMERIC(10,1) NOT NULL,
  per_point_swl_kg NUMERIC(10,1) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT structure_swl_is_positive CHECK (
    total_swl_kg > 0 AND per_point_swl_kg > 0
  ),
  CONSTRAINT structure_point_does_not_outrank_the_whole CHECK (
    per_point_swl_kg <= total_swl_kg
  ),
  UNIQUE (venue_id, label)
);

CREATE INDEX IF NOT EXISTS idx_rigging_structures_venue
  ON rigging_structures (venue_id);

-- 2. Hardware in a load path. Each element carries its own rating, and the
--    weakest one governs the point it sits in.
CREATE TABLE IF NOT EXISTS rigging_hardware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  hardware_kind VARCHAR(16) NOT NULL
    CHECK (hardware_kind IN ('HOIST', 'SLING', 'SHACKLE')),
  label VARCHAR(160) NOT NULL,
  asset_tag VARCHAR(64) NOT NULL UNIQUE,
  swl_kg NUMERIC(10,1) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hardware_swl_is_positive CHECK (swl_kg > 0)
);

CREATE INDEX IF NOT EXISTS idx_rigging_hardware_venue
  ON rigging_hardware (venue_id);

-- 3. Inspections. One row per certificate, for structures and for hardware
--    alike, so that "is this rated?" is the same question for both.
--
--    Deliberately not a validity flag on the element. A flag has to be updated
--    by somebody noticing, and nobody notices; an expiry date answers on its
--    own the moment it is asked about a particular night.
CREATE TABLE IF NOT EXISTS rigging_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID REFERENCES rigging_structures(id) ON DELETE CASCADE,
  hardware_id UUID REFERENCES rigging_hardware(id) ON DELETE CASCADE,
  certificate_ref VARCHAR(64) NOT NULL,
  inspected_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  inspector_name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inspection_names_exactly_one_element CHECK (
    (structure_id IS NOT NULL)::INT + (hardware_id IS NOT NULL)::INT = 1
  ),
  CONSTRAINT inspection_is_valid_for_some_time CHECK (valid_until > inspected_at)
);

CREATE INDEX IF NOT EXISTS idx_rigging_inspections_structure
  ON rigging_inspections (structure_id, valid_until DESC);
CREATE INDEX IF NOT EXISTS idx_rigging_inspections_hardware
  ON rigging_inspections (hardware_id, valid_until DESC);

-- 4. Points, and the ordered load path hanging under each.
CREATE TABLE IF NOT EXISTS rigging_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES rigging_structures(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (structure_id, label)
);

CREATE TABLE IF NOT EXISTS rigging_point_hardware (
  point_id UUID NOT NULL REFERENCES rigging_points(id) ON DELETE CASCADE,
  hardware_id UUID NOT NULL REFERENCES rigging_hardware(id) ON DELETE RESTRICT,
  path_order SMALLINT NOT NULL,
  PRIMARY KEY (point_id, path_order),
  CONSTRAINT point_hardware_order_is_positive CHECK (path_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_point_hardware_point
  ON rigging_point_hardware (point_id, path_order);

-- 5. Riggers competent to sign a plan off. Competency expires the same way a
--    certificate does and is checked at the moment of signing.
CREATE TABLE IF NOT EXISTS rigging_competencies (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(160) NOT NULL,
  qualification VARCHAR(120) NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL
);

-- 6. Plans and the loads on them.
CREATE TABLE IF NOT EXISTS rigging_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SIGNED_OFF', 'VOIDED')),
  signed_off_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  signed_off_at TIMESTAMPTZ,
  -- The arrangement the signature refers to. A signature that does not name
  -- what it approved is a signature that survives the plan being changed.
  load_fingerprint TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plan_signature_is_complete CHECK (
    (status = 'SIGNED_OFF') =
    (signed_off_by IS NOT NULL AND signed_off_at IS NOT NULL AND load_fingerprint IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rigging_plans_venue ON rigging_plans (venue_id, status);
CREATE INDEX IF NOT EXISTS idx_rigging_plans_event ON rigging_plans (event_id);

CREATE TABLE IF NOT EXISTS rigged_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES rigging_plans(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  weight_kg NUMERIC(10,1) NOT NULL,
  attachment VARCHAR(8) NOT NULL CHECK (attachment IN ('STATIC', 'HOISTED')),
  -- Degrees between the legs. NULL for a straight single pick.
  included_angle_degrees NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT load_has_weight CHECK (weight_kg > 0),
  -- At 180 degrees the legs are horizontal and the tension is unbounded. That
  -- is not a heavy rig, it is an impossible geometry, and a very large number
  -- invites somebody to argue about the margin.
  CONSTRAINT load_bridle_angle_is_possible CHECK (
    included_angle_degrees IS NULL
    OR (included_angle_degrees > 0 AND included_angle_degrees < 180)
  )
);

CREATE INDEX IF NOT EXISTS idx_rigged_loads_plan ON rigged_loads (plan_id);

CREATE TABLE IF NOT EXISTS rigged_load_legs (
  load_id UUID NOT NULL REFERENCES rigged_loads(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES rigging_points(id) ON DELETE RESTRICT,
  PRIMARY KEY (load_id, point_id)
);

CREATE INDEX IF NOT EXISTS idx_load_legs_point ON rigged_load_legs (point_id);

-- A bridle is one or two legs. Three-leg bridles are refused rather than
-- approximated: the even-share assumption that makes a three-leg calculation
-- tractable is the same assumption this feature exists to disprove.
CREATE OR REPLACE FUNCTION rigged_load_leg_count_is_supported()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_legs INT;
  v_angle NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_legs
  FROM rigged_load_legs WHERE load_id = NEW.load_id;

  IF v_legs > 2 THEN
    RAISE EXCEPTION
      'Load % has % legs. One or two are modelled; a wider bridle needs an engineered calculation.',
      NEW.load_id, v_legs;
  END IF;

  SELECT included_angle_degrees INTO v_angle FROM rigged_loads WHERE id = NEW.load_id;

  IF v_legs = 2 AND v_angle IS NULL THEN
    RAISE EXCEPTION 'Load % is bridled across two points and must state an included angle.',
      NEW.load_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_load_leg_count ON rigged_load_legs;
CREATE TRIGGER trg_load_leg_count
AFTER INSERT ON rigged_load_legs
FOR EACH ROW EXECUTE FUNCTION rigged_load_leg_count_is_supported();

-- 7. Leg tension.
--
--    Returns the tension along one leg and the vertical component that same leg
--    carries. These diverge as the angle opens, and keeping them apart is the
--    whole point: the structure's total sees the vertical sum, each point sees
--    the tension.
CREATE OR REPLACE FUNCTION rigging_leg_tension(
  p_weight_kg NUMERIC,
  p_attachment TEXT,
  p_leg_count INT,
  p_included_angle_degrees NUMERIC,
  p_dynamic_factor NUMERIC DEFAULT 1.4
)
RETURNS TABLE (
  leg_tension_kg NUMERIC,
  vertical_per_leg_kg NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rated NUMERIC;
BEGIN
  IF p_leg_count NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Only one- and two-leg bridles are modelled; got %.', p_leg_count;
  END IF;

  -- Anything on a powered hoist applies more than its own weight while it
  -- accelerates. The rating has to cover the worst instant, not the state you
  -- happen to see it in.
  v_rated := CASE WHEN p_attachment = 'HOISTED'
                  THEN p_weight_kg * p_dynamic_factor
                  ELSE p_weight_kg END;

  IF p_leg_count = 1 THEN
    leg_tension_kg := ROUND(v_rated, 1);
    vertical_per_leg_kg := ROUND(v_rated, 1);
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_included_angle_degrees IS NULL
     OR p_included_angle_degrees <= 0
     OR p_included_angle_degrees >= 180 THEN
    RAISE EXCEPTION 'Included angle % is not a possible bridle geometry.',
      p_included_angle_degrees;
  END IF;

  leg_tension_kg := ROUND(
    v_rated / (2 * COS(RADIANS(p_included_angle_degrees / 2))), 1
  );
  vertical_per_leg_kg := ROUND(v_rated / 2, 1);
  RETURN NEXT;
END;
$$;

-- 8. Whether an element is rated at a given instant.
--
--    An expired or absent certificate returns zero rather than the plated SWL.
--    It is not rated if it is not certified.
CREATE OR REPLACE FUNCTION rigging_certified_swl(
  p_structure_id UUID,
  p_hardware_id UUID,
  p_plated_swl_kg NUMERIC,
  p_as_of TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM rigging_inspections i
    WHERE (
            (p_structure_id IS NOT NULL AND i.structure_id = p_structure_id)
         OR (p_hardware_id IS NOT NULL AND i.hardware_id = p_hardware_id)
          )
      AND i.inspected_at <= p_as_of
      AND i.valid_until >= p_as_of
  ) INTO v_valid;

  RETURN CASE WHEN v_valid THEN p_plated_swl_kg ELSE 0 END;
END;
$$;

-- 9. What a point will actually carry, and which element decides.
--
--    The minimum across the whole path. "Reduce the load" and "swap the sling"
--    are different jobs, so the governing element is returned alongside the
--    number rather than left to be worked out.
CREATE OR REPLACE FUNCTION rigging_effective_capacity(
  p_point_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  capacity_kg NUMERIC,
  governing_element_id UUID,
  governing_kind TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_structure RECORD;
  v_item RECORD;
  v_swl NUMERIC;
BEGIN
  SELECT s.id, s.per_point_swl_kg
  INTO v_structure
  FROM rigging_points p
  JOIN rigging_structures s ON s.id = p.structure_id
  WHERE p.id = p_point_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown point %', p_point_id;
  END IF;

  capacity_kg := rigging_certified_swl(v_structure.id, NULL, v_structure.per_point_swl_kg, p_as_of);
  governing_element_id := v_structure.id;
  governing_kind := 'STRUCTURE';

  FOR v_item IN
    SELECT h.id, h.hardware_kind, h.swl_kg
    FROM rigging_point_hardware ph
    JOIN rigging_hardware h ON h.id = ph.hardware_id
    WHERE ph.point_id = p_point_id
    ORDER BY ph.path_order
  LOOP
    v_swl := rigging_certified_swl(NULL, v_item.id, v_item.swl_kg, p_as_of);
    IF v_swl < capacity_kg THEN
      capacity_kg := v_swl;
      governing_element_id := v_item.id;
      governing_kind := v_item.hardware_kind;
    END IF;
  END LOOP;

  capacity_kg := ROUND(capacity_kg, 1);
  RETURN NEXT;
END;
$$;

-- 10. Loading at every point on a plan.
--
--     Points see leg tension. A bridle at 120 degrees puts the entire load
--     through each of two legs, which is the case the halving misses.
CREATE OR REPLACE FUNCTION rigging_plan_point_loading(
  p_plan_id UUID,
  p_as_of TIMESTAMPTZ,
  p_dynamic_factor NUMERIC DEFAULT 1.4
)
RETURNS TABLE (
  point_id UUID,
  structure_id UUID,
  applied_kg NUMERIC,
  effective_swl_kg NUMERIC,
  governing_element_id UUID,
  governing_kind TEXT,
  overloaded BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH legs AS (
    SELECT
      l.point_id,
      (rigging_leg_tension(
        d.weight_kg,
        d.attachment,
        (SELECT COUNT(*)::INT FROM rigged_load_legs x WHERE x.load_id = d.id),
        d.included_angle_degrees,
        p_dynamic_factor
      )).*
    FROM rigged_loads d
    JOIN rigged_load_legs l ON l.load_id = d.id
    WHERE d.plan_id = p_plan_id
  ),
  applied AS (
    SELECT point_id, ROUND(SUM(leg_tension_kg), 1) AS applied_kg
    FROM legs GROUP BY point_id
  )
  SELECT
    a.point_id,
    p.structure_id,
    a.applied_kg,
    c.capacity_kg,
    c.governing_element_id,
    c.governing_kind,
    a.applied_kg > c.capacity_kg
  FROM applied a
  JOIN rigging_points p ON p.id = a.point_id
  CROSS JOIN LATERAL rigging_effective_capacity(a.point_id, p_as_of) c
  ORDER BY p.label;
$$;

-- 11. Loading on every structure a plan touches.
--
--     Structures see the vertical component, which is the plain share whatever
--     the angle. A bridle raises tension, not weight, and a total computed from
--     leg tensions would double-count the geometry.
CREATE OR REPLACE FUNCTION rigging_plan_structure_loading(
  p_plan_id UUID,
  p_as_of TIMESTAMPTZ,
  p_dynamic_factor NUMERIC DEFAULT 1.4
)
RETURNS TABLE (
  structure_id UUID,
  applied_kg NUMERIC,
  total_swl_kg NUMERIC,
  overloaded BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH legs AS (
    SELECT
      p.structure_id,
      (rigging_leg_tension(
        d.weight_kg,
        d.attachment,
        (SELECT COUNT(*)::INT FROM rigged_load_legs x WHERE x.load_id = d.id),
        d.included_angle_degrees,
        p_dynamic_factor
      )).vertical_per_leg_kg AS vertical_kg
    FROM rigged_loads d
    JOIN rigged_load_legs l ON l.load_id = d.id
    JOIN rigging_points p ON p.id = l.point_id
    WHERE d.plan_id = p_plan_id
  ),
  applied AS (
    SELECT structure_id, ROUND(SUM(vertical_kg), 1) AS applied_kg
    FROM legs GROUP BY structure_id
  )
  SELECT
    a.structure_id,
    a.applied_kg,
    ROUND(rigging_certified_swl(s.id, NULL, s.total_swl_kg, p_as_of), 1),
    a.applied_kg > rigging_certified_swl(s.id, NULL, s.total_swl_kg, p_as_of)
  FROM applied a
  JOIN rigging_structures s ON s.id = a.structure_id
  ORDER BY s.label;
$$;

-- 12. Every breach on a plan, not the first.
--
--     A cabinet-full of problems reported one at a time gets three visits, and
--     the second and third get reported as new problems by somebody who thought
--     they had fixed it.
CREATE OR REPLACE FUNCTION rigging_plan_breaches(
  p_plan_id UUID,
  p_as_of TIMESTAMPTZ,
  p_dynamic_factor NUMERIC DEFAULT 1.4
)
RETURNS TABLE (
  breach_kind TEXT,
  subject_id UUID,
  detail TEXT,
  applied_kg NUMERIC,
  capacity_kg NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE WHEN pl.effective_swl_kg = 0 THEN 'UNCERTIFIED_ELEMENT' ELSE 'POINT_OVERLOAD' END,
    pl.point_id,
    CASE WHEN pl.effective_swl_kg = 0
         THEN 'Element ' || pl.governing_element_id || ' is not in inspection, so the point is not rated'
         ELSE 'Point is governed by ' || pl.governing_element_id || ' (' || pl.governing_kind || ')'
    END,
    pl.applied_kg,
    pl.effective_swl_kg
  FROM rigging_plan_point_loading(p_plan_id, p_as_of, p_dynamic_factor) pl
  WHERE pl.overloaded

  UNION ALL

  SELECT
    CASE WHEN sl.total_swl_kg = 0 THEN 'UNCERTIFIED_ELEMENT' ELSE 'STRUCTURE_OVERLOAD' END,
    sl.structure_id,
    CASE WHEN sl.total_swl_kg = 0
         THEN 'Structure is not in inspection, so the beam is not rated'
         ELSE 'Structure carries ' || sl.applied_kg || ' kg against ' || sl.total_swl_kg || ' kg'
    END,
    sl.applied_kg,
    sl.total_swl_kg
  FROM rigging_plan_structure_loading(p_plan_id, p_as_of, p_dynamic_factor) sl
  WHERE sl.overloaded

  ORDER BY 1, 2;
$$;

-- 13. The fingerprint a signature refers to.
CREATE OR REPLACE FUNCTION rigging_plan_fingerprint(p_plan_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(STRING_AGG(entry, '|' ORDER BY entry), '')
  FROM (
    SELECT
      d.id || ':' || d.weight_kg || ':' || d.attachment || ':' ||
      COALESCE((
        SELECT STRING_AGG(l.point_id::TEXT, '+' ORDER BY l.point_id)
        FROM rigged_load_legs l WHERE l.load_id = d.id
      ), '') || ':' || COALESCE(d.included_angle_degrees::TEXT, '0') AS entry
    FROM rigged_loads d
    WHERE d.plan_id = p_plan_id
  ) entries;
$$;

-- 14. Sign a plan off.
--
--     The competency is checked at the instant of signing and the assessment is
--     run at the same instant, so a certificate that lapses between drafting and
--     the get-in is the case this catches rather than the case it misses.
CREATE OR REPLACE FUNCTION sign_off_rigging_plan(
  p_plan_id UUID,
  p_rigger_id UUID,
  p_at TIMESTAMPTZ,
  p_dynamic_factor NUMERIC DEFAULT 1.4
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_loads INT;
  v_competent BOOLEAN;
  v_breaches INT;
BEGIN
  SELECT status INTO v_status FROM rigging_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown plan %', p_plan_id;
  END IF;

  IF v_status = 'SIGNED_OFF' THEN RETURN 'REFUSED_ALREADY_SIGNED_OFF'; END IF;

  SELECT COUNT(*) INTO v_loads FROM rigged_loads WHERE plan_id = p_plan_id;
  IF v_loads = 0 THEN RETURN 'REFUSED_NO_LOADS'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM rigging_competencies
    WHERE user_id = p_rigger_id AND valid_until >= p_at
  ) INTO v_competent;
  IF NOT v_competent THEN RETURN 'REFUSED_RIGGER_NOT_COMPETENT'; END IF;

  SELECT COUNT(*) INTO v_breaches
  FROM rigging_plan_breaches(p_plan_id, p_at, p_dynamic_factor);
  IF v_breaches > 0 THEN RETURN 'REFUSED_OVERLOADED'; END IF;

  UPDATE rigging_plans
  SET status = 'SIGNED_OFF',
      signed_off_by = p_rigger_id,
      signed_off_at = p_at,
      load_fingerprint = rigging_plan_fingerprint(p_plan_id),
      void_reason = NULL
  WHERE id = p_plan_id;

  RETURN 'SIGNED_OFF';
END;
$$;

-- 15. Changing a signed plan voids the signature.
--
--     The signature refers to a specific arrangement, and an arrangement that
--     has changed is one nobody has approved. Enforced by trigger rather than
--     by the service so that a change arriving by any route is caught.
CREATE OR REPLACE FUNCTION rigging_plan_change_voids_sign_off()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan UUID;
BEGIN
  v_plan := COALESCE(NEW.plan_id, OLD.plan_id);

  UPDATE rigging_plans
  SET status = 'VOIDED',
      signed_off_by = NULL,
      signed_off_at = NULL,
      load_fingerprint = NULL,
      void_reason = 'Loads changed after sign-off (' || TG_OP || ')'
  WHERE id = v_plan AND status = 'SIGNED_OFF';

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rigged_loads_void_sign_off ON rigged_loads;
CREATE TRIGGER trg_rigged_loads_void_sign_off
AFTER INSERT OR UPDATE OR DELETE ON rigged_loads
FOR EACH ROW EXECUTE FUNCTION rigging_plan_change_voids_sign_off();

-- 16. Row level security.
--
--     Load figures and certificate dates are the evidence in an incident
--     investigation, so reads are broad among the people running the event and
--     writes go through the functions above.
ALTER TABLE rigging_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_point_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigged_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigged_load_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigging_competencies ENABLE ROW LEVEL SECURITY;

-- Structures, hardware and their certificates describe the building. Anybody
-- planning an event needs to see what is rated for what, and an SWL is
-- meaningless without the certificate behind it.
DROP POLICY IF EXISTS rigging_structures_authenticated_read ON rigging_structures;
CREATE POLICY rigging_structures_authenticated_read ON rigging_structures
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_hardware_authenticated_read ON rigging_hardware;
CREATE POLICY rigging_hardware_authenticated_read ON rigging_hardware
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_inspections_authenticated_read ON rigging_inspections;
CREATE POLICY rigging_inspections_authenticated_read ON rigging_inspections
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_points_authenticated_read ON rigging_points;
CREATE POLICY rigging_points_authenticated_read ON rigging_points
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_point_hardware_authenticated_read ON rigging_point_hardware;
CREATE POLICY rigging_point_hardware_authenticated_read ON rigging_point_hardware
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_competencies_authenticated_read ON rigging_competencies;
CREATE POLICY rigging_competencies_authenticated_read ON rigging_competencies
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS rigging_plans_organiser_read ON rigging_plans;
CREATE POLICY rigging_plans_organiser_read ON rigging_plans
  FOR SELECT TO authenticated
  USING (
    signed_off_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = rigging_plans.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM rigging_competencies c WHERE c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS rigged_loads_plan_read ON rigged_loads;
CREATE POLICY rigged_loads_plan_read ON rigged_loads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rigging_plans p
      WHERE p.id = rigged_loads.plan_id
        AND (
          p.signed_off_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = p.event_id AND e.organizer_id = auth.uid()
          )
          OR EXISTS (SELECT 1 FROM rigging_competencies c WHERE c.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS rigged_load_legs_plan_read ON rigged_load_legs;
CREATE POLICY rigged_load_legs_plan_read ON rigged_load_legs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rigged_loads d
      JOIN rigging_plans p ON p.id = d.plan_id
      WHERE d.id = rigged_load_legs.load_id
        AND (
          p.signed_off_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = p.event_id AND e.organizer_id = auth.uid()
          )
          OR EXISTS (SELECT 1 FROM rigging_competencies c WHERE c.user_id = auth.uid())
        )
    )
  );

GRANT EXECUTE ON FUNCTION rigging_leg_tension(NUMERIC, TEXT, INT, NUMERIC, NUMERIC)
  TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_certified_swl(UUID, UUID, NUMERIC, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_effective_capacity(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_plan_point_loading(UUID, TIMESTAMPTZ, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_plan_structure_loading(UUID, TIMESTAMPTZ, NUMERIC)
  TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_plan_breaches(UUID, TIMESTAMPTZ, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION rigging_plan_fingerprint(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sign_off_rigging_plan(UUID, UUID, TIMESTAMPTZ, NUMERIC) TO authenticated;

COMMENT ON FUNCTION rigging_leg_tension(NUMERIC, TEXT, INT, NUMERIC, NUMERIC) IS
  'Leg tension and vertical component. They diverge with the angle: at 120 degrees each of two legs carries the entire load while the vertical share stays at half.';
COMMENT ON FUNCTION rigging_certified_swl(UUID, UUID, NUMERIC, TIMESTAMPTZ) IS
  'Zero where the inspection has lapsed or was never recorded. An element is not rated if it is not certified, and a warning beside a green total gets scrolled past.';
COMMENT ON COLUMN rigging_structures.per_point_swl_kg IS
  'What any single point carries. The limit that actually fails, and the one that never reaches the booking form.';
COMMENT ON TABLE rigged_load_legs IS
  'One or two legs. Wider bridles are refused rather than approximated, because the even-share assumption behind an approximation is the one this feature exists to disprove.';
