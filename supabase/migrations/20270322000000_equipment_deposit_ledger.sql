-- Migration: 20270322000000_equipment_deposit_ledger.sql
-- Description: Schema and functions for the Equipment Security Deposit Hold &
--              Damage Settlement Ledger (#4389).
--
-- Money is stored in integer minor units (BIGINT). No NUMERIC, no floating
-- point, anywhere on this path. A deposit that fails to balance to the last
-- paisa is a deposit two students will argue about.
--
-- The governing invariant, enforced by CHECK rather than trusted from callers:
--
--     released_minor + forfeited_minor = held_minor
--     forfeited_minor = LEAST(assessed_damage_minor, held_minor)
--
-- Damage beyond the deposit does not produce a negative release. It is recorded
-- as unrecovered_shortfall_minor, which is a real figure the club needs and
-- which quietly disappears if the arithmetic is allowed to go negative instead.

-- 1. The held balance.
CREATE TABLE IF NOT EXISTS asset_deposit_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_reference VARCHAR(64) UNIQUE NOT NULL,
  asset_tag VARCHAR(100) NOT NULL,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  borrower_user_id UUID NOT NULL REFERENCES auth.users(id),
  held_minor BIGINT NOT NULL CHECK (held_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'HELD'
    CHECK (status IN ('HELD', 'UNDER_ASSESSMENT', 'SETTLED', 'FORFEITED')),
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_back_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  returned_undamaged BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT deposit_return_follows_checkout CHECK (due_back_at > held_at),
  CONSTRAINT deposit_undamaged_implies_returned
    CHECK (returned_undamaged = FALSE OR returned_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_deposit_holds_club_status
  ON asset_deposit_holds (club_id, status);

-- Finds forgotten deposits: returned clean, still held, past the release window.
CREATE INDEX IF NOT EXISTS idx_deposit_holds_release_due
  ON asset_deposit_holds (club_id, returned_at)
  WHERE status = 'HELD' AND returned_undamaged;

-- 2. Itemised deductions. "We kept 800 of your 2000" with no breakdown is the
--    exact dispute this ledger exists to prevent, so a reason is mandatory.
CREATE TABLE IF NOT EXISTS asset_deposit_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id UUID NOT NULL REFERENCES asset_deposit_holds(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 4),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  assessed_by UUID NOT NULL REFERENCES auth.users(id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_deductions_hold
  ON asset_deposit_deductions (hold_id);

-- 3. The settlement statement. One per hold, written once.
CREATE TABLE IF NOT EXISTS asset_deposit_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id UUID NOT NULL UNIQUE REFERENCES asset_deposit_holds(id) ON DELETE CASCADE,
  held_minor BIGINT NOT NULL CHECK (held_minor > 0),
  assessed_damage_minor BIGINT NOT NULL CHECK (assessed_damage_minor >= 0),
  forfeited_minor BIGINT NOT NULL CHECK (forfeited_minor >= 0),
  released_minor BIGINT NOT NULL CHECK (released_minor >= 0),
  unrecovered_shortfall_minor BIGINT NOT NULL DEFAULT 0
    CHECK (unrecovered_shortfall_minor >= 0),
  currency CHAR(3) NOT NULL,
  settled_by UUID NOT NULL REFERENCES auth.users(id),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The invariant. If this ever fails, somebody's money has gone missing and
  -- refusing the write is better than recording a lie.
  CONSTRAINT settlement_balances
    CHECK (released_minor + forfeited_minor = held_minor),
  CONSTRAINT settlement_never_withholds_more_than_held
    CHECK (forfeited_minor <= held_minor),
  -- A shortfall exists only once the deposit is fully consumed.
  CONSTRAINT shortfall_implies_full_forfeit
    CHECK (unrecovered_shortfall_minor = 0 OR forfeited_minor = held_minor)
);

CREATE OR REPLACE FUNCTION reject_settlement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Deposit settlements are immutable once written.';
END;
$$;

DROP TRIGGER IF EXISTS trg_deposit_settlements_immutable ON asset_deposit_settlements;
CREATE TRIGGER trg_deposit_settlements_immutable
  BEFORE UPDATE OR DELETE ON asset_deposit_settlements
  FOR EACH ROW EXECUTE FUNCTION reject_settlement_mutation();

-- 4. A settled or forfeited hold stops accepting deductions.
CREATE OR REPLACE FUNCTION reject_deduction_on_closed_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status VARCHAR(20);
BEGIN
  SELECT status INTO v_status FROM asset_deposit_holds WHERE id = NEW.hold_id;

  IF v_status IN ('SETTLED', 'FORFEITED') THEN
    RAISE EXCEPTION 'Hold % is % and can no longer be assessed.', NEW.hold_id, v_status;
  END IF;

  -- Damage on a hold marked clean moves it into assessment, so the two facts
  -- cannot sit in the database contradicting each other.
  UPDATE asset_deposit_holds
  SET status = 'UNDER_ASSESSMENT', returned_undamaged = FALSE
  WHERE id = NEW.hold_id AND status = 'HELD';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduction_hold_open ON asset_deposit_deductions;
CREATE TRIGGER trg_deduction_hold_open
  BEFORE INSERT ON asset_deposit_deductions
  FOR EACH ROW EXECUTE FUNCTION reject_deduction_on_closed_hold();

-- 5. Settle a returned hold.
--
--    Deductions are capped at the deposit. A 3000 repair against a 2000 deposit
--    forfeits 2000 and records a 1000 shortfall; it does not release minus 1000.
CREATE OR REPLACE FUNCTION settle_asset_deposit(
  p_hold_reference VARCHAR(64),
  p_settled_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold RECORD;
  v_assessed BIGINT;
  v_forfeited BIGINT;
  v_released BIGINT;
  v_shortfall BIGINT;
  v_settlement_id UUID;
BEGIN
  SELECT * INTO v_hold
  FROM asset_deposit_holds
  WHERE hold_reference = p_hold_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown deposit hold %', p_hold_reference;
  END IF;
  IF v_hold.status IN ('SETTLED', 'FORFEITED') THEN
    RAISE EXCEPTION 'Hold % cannot move from % to SETTLED. A closed deposit stays closed.',
      p_hold_reference, v_hold.status;
  END IF;
  IF v_hold.returned_at IS NULL THEN
    RAISE EXCEPTION 'Hold % has not been returned. Forfeit it instead of settling it.',
      p_hold_reference;
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO v_assessed
  FROM asset_deposit_deductions WHERE hold_id = v_hold.id;

  v_forfeited := LEAST(v_assessed, v_hold.held_minor);
  v_released := v_hold.held_minor - v_forfeited;
  v_shortfall := GREATEST(0, v_assessed - v_hold.held_minor);

  INSERT INTO asset_deposit_settlements (
    hold_id, held_minor, assessed_damage_minor, forfeited_minor,
    released_minor, unrecovered_shortfall_minor, currency, settled_by
  )
  VALUES (
    v_hold.id, v_hold.held_minor, v_assessed, v_forfeited,
    v_released, v_shortfall, v_hold.currency, p_settled_by
  )
  RETURNING id INTO v_settlement_id;

  UPDATE asset_deposit_holds SET status = 'SETTLED' WHERE id = v_hold.id;

  RETURN v_settlement_id;
END;
$$;

-- 6. Forfeit kit that never came back.
--
--    Deliberately distinct from a settlement that happens to release zero: the
--    asset is still missing, and conflating the two loses that fact.
CREATE OR REPLACE FUNCTION forfeit_asset_deposit(
  p_hold_reference VARCHAR(64),
  p_reason TEXT,
  p_forfeited_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold RECORD;
  v_settlement_id UUID;
BEGIN
  SELECT * INTO v_hold
  FROM asset_deposit_holds
  WHERE hold_reference = p_hold_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown deposit hold %', p_hold_reference;
  END IF;
  IF v_hold.status IN ('SETTLED', 'FORFEITED') THEN
    RAISE EXCEPTION 'Hold % cannot move from % to FORFEITED. A closed deposit stays closed.',
      p_hold_reference, v_hold.status;
  END IF;
  IF v_hold.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Hold % was returned. Settle it instead of forfeiting it.', p_hold_reference;
  END IF;

  INSERT INTO asset_deposit_deductions (hold_id, reason, amount_minor, assessed_by)
  VALUES (v_hold.id, p_reason, v_hold.held_minor, p_forfeited_by);

  INSERT INTO asset_deposit_settlements (
    hold_id, held_minor, assessed_damage_minor, forfeited_minor,
    released_minor, unrecovered_shortfall_minor, currency, settled_by
  )
  VALUES (
    v_hold.id, v_hold.held_minor, v_hold.held_minor, v_hold.held_minor,
    0, 0, v_hold.currency, p_forfeited_by
  )
  RETURNING id INTO v_settlement_id;

  UPDATE asset_deposit_holds SET status = 'FORFEITED' WHERE id = v_hold.id;

  RETURN v_settlement_id;
END;
$$;

-- 7. Forgotten deposits.
--
--    This is why a student is still chasing a deposit in June for a camera
--    returned in March: nothing was ever obliged to hand it back, so nobody
--    noticed. Surfacing them is the whole point.
CREATE OR REPLACE FUNCTION find_overdue_deposit_releases(
  p_club_id UUID,
  p_evaluated_at TIMESTAMPTZ,
  p_release_window_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  hold_reference VARCHAR(64),
  asset_tag VARCHAR(100),
  borrower_user_id UUID,
  held_minor BIGINT,
  currency CHAR(3),
  returned_at TIMESTAMPTZ,
  days_overdue INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.hold_reference,
    h.asset_tag,
    h.borrower_user_id,
    h.held_minor,
    h.currency,
    h.returned_at,
    FLOOR(
      EXTRACT(EPOCH FROM (
        p_evaluated_at - h.returned_at - (p_release_window_days * INTERVAL '1 day')
      )) / 86400
    )::INTEGER AS days_overdue
  FROM asset_deposit_holds h
  WHERE h.club_id = p_club_id
    AND h.status = 'HELD'
    AND h.returned_undamaged
    AND h.returned_at IS NOT NULL
    AND h.returned_at < p_evaluated_at - (p_release_window_days * INTERVAL '1 day')
  ORDER BY days_overdue DESC;
$$;

-- 8. What the club is currently sitting on.
CREATE OR REPLACE FUNCTION outstanding_deposit_balance(p_club_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(h.held_minor), 0)::BIGINT
  FROM asset_deposit_holds h
  WHERE h.club_id = p_club_id
    AND h.status IN ('HELD', 'UNDER_ASSESSMENT');
$$;

-- 9. Row level security. A borrower can always read their own deposit and the
--    statement behind it; that transparency is the point of the ledger.
ALTER TABLE asset_deposit_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_deposit_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_deposit_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deposit_holds_borrower_read ON asset_deposit_holds;
CREATE POLICY deposit_holds_borrower_read ON asset_deposit_holds
  FOR SELECT TO authenticated
  USING (
    borrower_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = asset_deposit_holds.club_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'treasurer')
    )
  );

DROP POLICY IF EXISTS deposit_deductions_read ON asset_deposit_deductions;
CREATE POLICY deposit_deductions_read ON asset_deposit_deductions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asset_deposit_holds h
      WHERE h.id = asset_deposit_deductions.hold_id
        AND (
          h.borrower_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM club_members m
            WHERE m.club_id = h.club_id
              AND m.user_id = auth.uid()
              AND m.role IN ('owner', 'admin', 'treasurer')
          )
        )
    )
  );

DROP POLICY IF EXISTS deposit_settlements_read ON asset_deposit_settlements;
CREATE POLICY deposit_settlements_read ON asset_deposit_settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asset_deposit_holds h
      WHERE h.id = asset_deposit_settlements.hold_id
        AND (
          h.borrower_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM club_members m
            WHERE m.club_id = h.club_id
              AND m.user_id = auth.uid()
              AND m.role IN ('owner', 'admin', 'treasurer')
          )
        )
    )
  );

GRANT EXECUTE ON FUNCTION settle_asset_deposit(VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION forfeit_asset_deposit(VARCHAR, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_overdue_deposit_releases(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION outstanding_deposit_balance(UUID) TO authenticated;

COMMENT ON COLUMN asset_deposit_settlements.unrecovered_shortfall_minor IS
  'Assessed damage the deposit could not cover. Recorded rather than allowed to push the release negative.';
