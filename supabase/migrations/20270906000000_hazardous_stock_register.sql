-- Migration: 20270906000000_hazardous_stock_register.sql
-- Description: Schema and functions for the Hazardous Consumable Shelf-Life and
--              Segregation Register — expiry derived from the item's state,
--              segregation evaluated over locations, aggregate class limits,
--              and disposal routing that refuses to route what must not move
--              (#4707).
--
-- Club cupboards contain things the asset table thinks are stationery. It
-- cannot express either of the two properties that actually govern them.
--
-- Shelf life runs from opening, not from manufacture. An unopened tin of
-- solvent is good for years; the same tin opened in October is scrap by spring.
-- A column copied off the label describes the sealed container and stops
-- describing anything the moment somebody breaks the seal — so both dates are
-- held, the derived one is enforced, and the label stays visible beside it.
--
-- The sharp version is the peroxide-former. Ethers react with air over time to
-- produce peroxides that concentrate as the solvent evaporates. They do not
-- become less effective with age — they become more dangerous, and past a
-- certain point the correct action is not to move the container. Every other
-- item in the cupboard has an expiry that is a use-by; this one has an expiry
-- that is a disposal deadline.
--
-- Segregation is a property of a set. Adding one item can make a cabinet that
-- was lawful yesterday unlawful today without the incoming item being unlawful
-- in itself, so the check runs over the resulting contents of the location.
--
-- Quantities are derived by folding an append-only movement log. A part-used
-- container's remaining volume is a consequence of what was taken out of it,
-- not a number somebody edits.

-- 1. Hazard classes.
CREATE TABLE IF NOT EXISTS hazard_classes (
  id VARCHAR(48) PRIMARY KEY,
  label VARCHAR(160) NOT NULL,
  quantity_unit VARCHAR(4) NOT NULL CHECK (quantity_unit IN ('ML', 'G')),
  -- Days of life once opened. NULL where opening starts no clock.
  post_opening_days INT,
  -- Gets more dangerous with age rather than merely less effective.
  peroxide_former BOOLEAN NOT NULL DEFAULT FALSE,
  -- Days past expiry beyond which the container is assessed where it stands.
  immovable_after_days INT,
  disposal_route VARCHAR(64) NOT NULL,
  CONSTRAINT class_post_opening_life_is_real CHECK (
    post_opening_days IS NULL OR post_opening_days > 0
  ),
  -- A peroxide-former governed by its label alone is the reading that leaves a
  -- bottle in a cupboard for six years.
  CONSTRAINT peroxide_former_carries_an_opening_clock CHECK (
    NOT peroxide_former OR post_opening_days IS NOT NULL
  )
);

-- 2. The segregation matrix.
--
--    Stored once per pair with the lower id first, so a matrix that has to be
--    consulted in the right order cannot be consulted in the wrong one.
CREATE TABLE IF NOT EXISTS hazard_segregation_rules (
  class_a VARCHAR(48) NOT NULL REFERENCES hazard_classes(id) ON DELETE CASCADE,
  class_b VARCHAR(48) NOT NULL REFERENCES hazard_classes(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  PRIMARY KEY (class_a, class_b),
  CONSTRAINT segregation_pair_is_ordered CHECK (class_a < class_b)
);

-- 3. Locations, and what each is rated to hold.
CREATE TABLE IF NOT EXISTS hazard_storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(48) NOT NULL UNIQUE,
  label VARCHAR(160) NOT NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  -- A licensed store carries no aggregate limit.
  licensed_store BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A class with no row here is a class the location is not rated to hold. The
-- permissive reading — unlisted means unlimited — is the one that lets a
-- cupboard fill up with something nobody chose to put there.
CREATE TABLE IF NOT EXISTS location_class_limits (
  location_id UUID NOT NULL REFERENCES hazard_storage_locations(id) ON DELETE CASCADE,
  class_id VARCHAR(48) NOT NULL REFERENCES hazard_classes(id) ON DELETE CASCADE,
  aggregate_limit NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (location_id, class_id),
  CONSTRAINT class_limit_is_not_negative CHECK (aggregate_limit >= 0)
);

-- 4. Stock.
CREATE TABLE IF NOT EXISTS hazardous_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  substance VARCHAR(160) NOT NULL,
  class_id VARCHAR(48) NOT NULL REFERENCES hazard_classes(id) ON DELETE RESTRICT,
  nominal_quantity NUMERIC(12,2) NOT NULL,
  quantity_unit VARCHAR(4) NOT NULL CHECK (quantity_unit IN ('ML', 'G')),
  manufactured_on DATE NOT NULL,
  -- What the label says. An upper bound whatever the opening clock says.
  label_expiry DATE NOT NULL,
  opened_on DATE,
  location_id UUID NOT NULL REFERENCES hazard_storage_locations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_item_has_quantity CHECK (nominal_quantity > 0),
  CONSTRAINT stock_item_opened_after_it_was_made CHECK (
    opened_on IS NULL OR opened_on >= manufactured_on
  ),
  CONSTRAINT stock_item_expires_after_it_was_made CHECK (label_expiry >= manufactured_on)
);

CREATE INDEX IF NOT EXISTS idx_hazardous_stock_location
  ON hazardous_stock_items (location_id, class_id);
CREATE INDEX IF NOT EXISTS idx_hazardous_stock_club
  ON hazardous_stock_items (club_id);

-- A limit expressed in millilitres cannot be compared against grams, and the
-- comparison would silently succeed.
CREATE OR REPLACE FUNCTION stock_unit_matches_its_class()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit VARCHAR(4);
BEGIN
  SELECT quantity_unit INTO v_unit FROM hazard_classes WHERE id = NEW.class_id;

  IF v_unit <> NEW.quantity_unit THEN
    RAISE EXCEPTION 'Item is measured in % but % is measured in %.',
      NEW.quantity_unit, NEW.class_id, v_unit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_unit_matches ON hazardous_stock_items;
CREATE TRIGGER trg_stock_unit_matches
BEFORE INSERT OR UPDATE ON hazardous_stock_items
FOR EACH ROW EXECUTE FUNCTION stock_unit_matches_its_class();

-- 5. Movements. Append-only: the remaining quantity is a fold over these and
--    never an editable column.
CREATE TABLE IF NOT EXISTS hazard_stock_movements (
  sequence BIGSERIAL PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES hazardous_stock_items(id) ON DELETE CASCADE,
  movement_kind VARCHAR(16) NOT NULL
    CHECK (movement_kind IN ('RECEIPT', 'DECANT', 'TRANSFER', 'DISPOSAL')),
  quantity_delta NUMERIC(12,2) NOT NULL,
  from_location_id UUID REFERENCES hazard_storage_locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES hazard_storage_locations(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT receipt_adds_and_disposal_removes CHECK (
    (movement_kind = 'RECEIPT' AND quantity_delta > 0)
    OR (movement_kind IN ('DECANT', 'DISPOSAL') AND quantity_delta <= 0)
    OR (movement_kind = 'TRANSFER' AND quantity_delta = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item
  ON hazard_stock_movements (item_id, occurred_at, sequence);

CREATE OR REPLACE FUNCTION hazard_movements_are_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'hazard_stock_movements is append-only; % is not permitted.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_hazard_movements_append_only ON hazard_stock_movements;
CREATE TRIGGER trg_hazard_movements_append_only
BEFORE UPDATE OR DELETE ON hazard_stock_movements
FOR EACH ROW EXECUTE FUNCTION hazard_movements_are_append_only();

-- 6. What is left in a container, folded from the log.
CREATE OR REPLACE FUNCTION hazard_remaining_quantity(
  p_item_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(quantity_delta), 0)
  FROM hazard_stock_movements
  WHERE item_id = p_item_id AND occurred_at <= p_as_of;
$$;

-- 7. When the item actually expires, from its state rather than from its label.
--
--    Where the substance defines a post-opening life and the container is open,
--    the clock starts at the open date. The label stays an upper bound: opening
--    a container never extends it past what the manufacturer put on the tin.
CREATE OR REPLACE FUNCTION hazard_assess_expiry(
  p_item_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  label_expiry DATE,
  effective_expiry DATE,
  opening_clock_applied BOOLEAN,
  label_bound_the_clock BOOLEAN,
  expired BOOLEAN,
  days_past_expiry INT,
  deadline_kind TEXT,
  immovable BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_item hazardous_stock_items;
  v_class hazard_classes;
  v_opening_expiry DATE;
  v_today DATE;
BEGIN
  SELECT * INTO v_item FROM hazardous_stock_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown item %', p_item_id;
  END IF;

  SELECT * INTO v_class FROM hazard_classes WHERE id = v_item.class_id;
  v_today := (p_as_of AT TIME ZONE 'UTC')::DATE;

  label_expiry := v_item.label_expiry;
  effective_expiry := v_item.label_expiry;
  opening_clock_applied := FALSE;
  label_bound_the_clock := FALSE;

  IF v_class.post_opening_days IS NOT NULL AND v_item.opened_on IS NOT NULL THEN
    opening_clock_applied := TRUE;
    v_opening_expiry := v_item.opened_on + v_class.post_opening_days;

    IF v_opening_expiry < v_item.label_expiry THEN
      effective_expiry := v_opening_expiry;
    ELSE
      label_bound_the_clock := TRUE;
    END IF;
  END IF;

  expired := v_today > effective_expiry;
  days_past_expiry := CASE WHEN expired THEN (v_today - effective_expiry) ELSE 0 END;

  -- Every other item in the cupboard has a use-by. This one has a deadline.
  deadline_kind := CASE WHEN v_class.peroxide_former
                        THEN 'DISPOSAL_DEADLINE' ELSE 'USE_BY' END;

  immovable := expired
    AND v_class.immovable_after_days IS NOT NULL
    AND days_past_expiry > v_class.immovable_after_days;

  RETURN NEXT;
END;
$$;

-- 8. Everything wrong with a location, not the first thing wrong with it.
--
--    A cabinet with three problems that reports one gets three separate visits,
--    and the second and third get reported as new problems by somebody who
--    thought they had fixed it.
CREATE OR REPLACE FUNCTION hazard_assess_location(
  p_location_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  breach_kind TEXT,
  item_ids UUID[],
  detail TEXT,
  quantity NUMERIC,
  quantity_limit NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH present AS (
    SELECT i.*, hazard_remaining_quantity(i.id, p_as_of) AS remaining
    FROM hazardous_stock_items i
    WHERE i.location_id = p_location_id
  ),
  stocked AS (
    SELECT * FROM present WHERE remaining > 0
  ),
  location AS (
    SELECT * FROM hazard_storage_locations WHERE id = p_location_id
  )

  -- Segregation, over the resulting set rather than over any one item.
  SELECT
    'SEGREGATION',
    ARRAY(
      SELECT s.id FROM stocked s
      WHERE s.class_id IN (r.class_a, r.class_b) ORDER BY s.id
    ),
    r.class_a || ' and ' || r.class_b || ' may not share a location: ' || r.reason,
    NULL::NUMERIC,
    NULL::NUMERIC
  FROM hazard_segregation_rules r
  WHERE EXISTS (SELECT 1 FROM stocked s WHERE s.class_id = r.class_a)
    AND EXISTS (SELECT 1 FROM stocked s WHERE s.class_id = r.class_b)

  UNION ALL

  -- A class the location is not rated to hold at all.
  SELECT
    'UNRATED_CLASS',
    ARRAY(SELECT s.id FROM stocked s WHERE s.class_id = agg.class_id ORDER BY s.id),
    'Location is not rated to hold ' || agg.class_id,
    agg.total,
    0::NUMERIC
  FROM (
    SELECT class_id, SUM(remaining) AS total FROM stocked GROUP BY class_id
  ) agg
  WHERE NOT (SELECT licensed_store FROM location)
    AND NOT EXISTS (
      SELECT 1 FROM location_class_limits l
      WHERE l.location_id = p_location_id AND l.class_id = agg.class_id
    )

  UNION ALL

  -- Aggregate limits, on the total of a class rather than on any container.
  SELECT
    'CLASS_LIMIT',
    ARRAY(SELECT s.id FROM stocked s WHERE s.class_id = agg.class_id ORDER BY s.id),
    agg.total || ' of ' || agg.class_id || ' against a limit of ' || l.aggregate_limit
      || '; this belongs in a licensed store',
    agg.total,
    l.aggregate_limit
  FROM (
    SELECT class_id, SUM(remaining) AS total FROM stocked GROUP BY class_id
  ) agg
  JOIN location_class_limits l
    ON l.location_id = p_location_id AND l.class_id = agg.class_id
  WHERE NOT (SELECT licensed_store FROM location)
    AND agg.total > l.aggregate_limit

  UNION ALL

  -- Expiry, split by whether it is a use-by or a disposal deadline.
  SELECT
    CASE WHEN e.deadline_kind = 'DISPOSAL_DEADLINE' THEN 'DISPOSAL_OVERDUE' ELSE 'EXPIRED' END,
    ARRAY[s.id],
    s.substance || CASE WHEN e.deadline_kind = 'DISPOSAL_DEADLINE'
                        THEN ' passed its disposal deadline '
                        ELSE ' expired ' END
      || e.days_past_expiry || ' days ago',
    NULL::NUMERIC,
    NULL::NUMERIC
  FROM stocked s
  CROSS JOIN LATERAL hazard_assess_expiry(s.id, p_as_of) e
  WHERE e.expired

  UNION ALL

  SELECT
    'IMMOVABLE',
    ARRAY[s.id],
    s.substance || ' must be assessed where it stands and not moved',
    NULL::NUMERIC,
    NULL::NUMERIC
  FROM stocked s
  CROSS JOIN LATERAL hazard_assess_expiry(s.id, p_as_of) e
  WHERE e.immovable

  ORDER BY 1, 2;
$$;

-- 9. Whether a quantity of a class may join a location.
--
--    Evaluated against the resulting contents, so a transfer that would make
--    the destination unlawful is refused even where the item is unremarkable
--    on its own — and a transfer that would make the *source* lawful does not
--    excuse it. Emptying one bad cupboard into another is not a fix.
CREATE OR REPLACE FUNCTION hazard_would_breach(
  p_location_id UUID,
  p_class_id VARCHAR,
  p_quantity NUMERIC,
  p_as_of TIMESTAMPTZ,
  p_exclude_item_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_licensed BOOLEAN;
  v_limit NUMERIC;
  v_existing NUMERIC;
BEGIN
  SELECT licensed_store INTO v_licensed
  FROM hazard_storage_locations WHERE id = p_location_id;

  IF NOT FOUND THEN RETURN 'REFUSED_UNKNOWN_LOCATION'; END IF;

  IF EXISTS (
    SELECT 1
    FROM hazardous_stock_items i
    JOIN hazard_segregation_rules r
      ON (r.class_a = LEAST(i.class_id, p_class_id)
      AND r.class_b = GREATEST(i.class_id, p_class_id))
    WHERE i.location_id = p_location_id
      AND (p_exclude_item_id IS NULL OR i.id <> p_exclude_item_id)
      AND i.class_id <> p_class_id
      AND hazard_remaining_quantity(i.id, p_as_of) > 0
  ) THEN
    RETURN 'REFUSED_SEGREGATION';
  END IF;

  IF v_licensed THEN RETURN 'PERMITTED'; END IF;

  SELECT aggregate_limit INTO v_limit
  FROM location_class_limits
  WHERE location_id = p_location_id AND class_id = p_class_id;

  IF NOT FOUND THEN RETURN 'REFUSED_UNRATED_CLASS'; END IF;

  SELECT COALESCE(SUM(hazard_remaining_quantity(i.id, p_as_of)), 0) INTO v_existing
  FROM hazardous_stock_items i
  WHERE i.location_id = p_location_id
    AND i.class_id = p_class_id
    AND (p_exclude_item_id IS NULL OR i.id <> p_exclude_item_id);

  IF v_existing + p_quantity > v_limit THEN RETURN 'REFUSED_CLASS_LIMIT'; END IF;

  RETURN 'PERMITTED';
END;
$$;

-- 10. Move an item between locations.
CREATE OR REPLACE FUNCTION transfer_hazardous_stock(
  p_item_id UUID,
  p_to_location_id UUID,
  p_at TIMESTAMPTZ,
  p_note TEXT DEFAULT 'Transferred'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item hazardous_stock_items;
  v_remaining NUMERIC;
  v_expiry RECORD;
  v_verdict TEXT;
BEGIN
  SELECT * INTO v_item FROM hazardous_stock_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown item %', p_item_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM hazard_storage_locations WHERE id = p_to_location_id) THEN
    RETURN 'REFUSED_UNKNOWN_LOCATION';
  END IF;

  IF v_item.location_id = p_to_location_id THEN RETURN 'REFUSED_SAME_LOCATION'; END IF;

  v_remaining := hazard_remaining_quantity(p_item_id, p_at);
  IF v_remaining <= 0 THEN RETURN 'REFUSED_EXHAUSTED'; END IF;

  -- The container that must be assessed where it stands is refused first.
  -- Nothing about the destination makes moving it acceptable.
  SELECT * INTO v_expiry FROM hazard_assess_expiry(p_item_id, p_at);
  IF v_expiry.immovable THEN RETURN 'REFUSED_IMMOVABLE'; END IF;

  v_verdict := hazard_would_breach(
    p_to_location_id, v_item.class_id, v_remaining, p_at, p_item_id
  );
  IF v_verdict <> 'PERMITTED' THEN RETURN v_verdict; END IF;

  INSERT INTO hazard_stock_movements (
    item_id, movement_kind, quantity_delta, from_location_id, to_location_id, occurred_at, note
  )
  VALUES (p_item_id, 'TRANSFER', 0, v_item.location_id, p_to_location_id, p_at, p_note);

  UPDATE hazardous_stock_items SET location_id = p_to_location_id WHERE id = p_item_id;

  RETURN 'TRANSFERRED';
END;
$$;

-- 11. The route an item leaves by.
--
--     Returns no route for a container that has to be assessed where it stands.
--     Producing one anyway would be the most dangerous thing this feature could
--     do: it reads as an instruction to pick the bottle up.
CREATE OR REPLACE FUNCTION hazard_disposal_route(
  p_item_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (routed BOOLEAN, route TEXT, reason TEXT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_item hazardous_stock_items;
  v_class hazard_classes;
  v_expiry RECORD;
BEGIN
  SELECT * INTO v_item FROM hazardous_stock_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown item %', p_item_id;
  END IF;

  SELECT * INTO v_class FROM hazard_classes WHERE id = v_item.class_id;
  SELECT * INTO v_expiry FROM hazard_assess_expiry(p_item_id, p_as_of);

  IF v_expiry.immovable THEN
    routed := FALSE;
    route := NULL;
    reason := v_item.substance || ' is ' || v_expiry.days_past_expiry
              || ' days past its disposal deadline and must be assessed in place';
    RETURN NEXT;
    RETURN;
  END IF;

  routed := TRUE;
  route := v_class.disposal_route;
  reason := CASE WHEN v_expiry.deadline_kind = 'DISPOSAL_DEADLINE'
                 THEN 'Peroxide-former within the window in which it may still be moved'
                 ELSE 'Routine disposal' END;
  RETURN NEXT;
END;
$$;

-- 12. Every location with something wrong with it, worst first.
CREATE OR REPLACE FUNCTION non_compliant_hazard_locations(p_as_of TIMESTAMPTZ)
RETURNS TABLE (location_id UUID, code VARCHAR, breach_count INT)
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.code, COUNT(a.*)::INT
  FROM hazard_storage_locations l
  CROSS JOIN LATERAL hazard_assess_location(l.id, p_as_of) a
  GROUP BY l.id, l.code
  HAVING COUNT(a.*) > 0
  ORDER BY COUNT(a.*) DESC, l.code;
$$;

-- 13. Row level security.
--
--     Classes, the segregation matrix and disposal routes are safety reference
--     data. Everybody handling this stock needs them, and hiding them behind a
--     membership check is how somebody guesses.
ALTER TABLE hazard_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_segregation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_class_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazardous_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hazard_classes_authenticated_read ON hazard_classes;
CREATE POLICY hazard_classes_authenticated_read ON hazard_classes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS segregation_rules_authenticated_read ON hazard_segregation_rules;
CREATE POLICY segregation_rules_authenticated_read ON hazard_segregation_rules
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS storage_locations_authenticated_read ON hazard_storage_locations;
CREATE POLICY storage_locations_authenticated_read ON hazard_storage_locations
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS class_limits_authenticated_read ON location_class_limits;
CREATE POLICY class_limits_authenticated_read ON location_class_limits
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS stock_items_club_member_read ON hazardous_stock_items;
CREATE POLICY stock_items_club_member_read ON hazardous_stock_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = hazardous_stock_items.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS stock_movements_club_member_read ON hazard_stock_movements;
CREATE POLICY stock_movements_club_member_read ON hazard_stock_movements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM hazardous_stock_items i
      JOIN club_members m ON m.club_id = i.club_id
      WHERE i.id = hazard_stock_movements.item_id AND m.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION hazard_remaining_quantity(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION hazard_assess_expiry(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION hazard_assess_location(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION hazard_would_breach(UUID, VARCHAR, NUMERIC, TIMESTAMPTZ, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION hazard_disposal_route(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION non_compliant_hazard_locations(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_hazardous_stock(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON COLUMN hazardous_stock_items.opened_on IS
  'Shelf life runs from here for a substance with a post-opening clock. The label date stays beside it as an upper bound, because opening a container never extends its life.';
COMMENT ON CONSTRAINT peroxide_former_carries_an_opening_clock ON hazard_classes IS
  'A peroxide-former governed by its label alone is the reading that leaves a bottle of ether in a cupboard for six years.';
COMMENT ON FUNCTION hazard_disposal_route(UUID, TIMESTAMPTZ) IS
  'Returns no route for a container past the point where it may be moved. A route reads as an instruction to pick the bottle up.';
COMMENT ON FUNCTION hazard_would_breach(UUID, VARCHAR, NUMERIC, TIMESTAMPTZ, UUID) IS
  'Evaluated over the resulting contents of the destination. Adding one lawful item can make a lawful cabinet unlawful, and emptying a bad cupboard into another is not a fix.';
COMMENT ON TABLE location_class_limits IS
  'A class with no row here is one the location is not rated to hold. Unlisted-means-unlimited is how a cupboard fills up with something nobody chose to put there.';
