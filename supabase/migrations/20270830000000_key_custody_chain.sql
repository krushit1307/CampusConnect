-- Migration: 20270830000000_key_custody_chain.sql
-- Description: Schema and functions for the Physical Key & Access Card Custody
--              Chain, and the rekey exposure of a credential that never comes
--              back (#4557).
--
-- Keys change hands in car parks and group chats. When an officer graduates
-- without returning one, nobody notices until the next person needs it, and by
-- then nobody can say who had it last, what it opens, or what it would cost to
-- make the room secure again.
--
-- That last question has a real answer. A card is a credential you can switch
-- off: losing one costs a replacement. A key is not. An unreturned key to a
-- door on a shared keyway means every lock on that keyway is compromised, and
-- putting it right means recutting every other key issued against it. Treating
-- those two as the same kind of outstanding item is precisely why the second
-- one gets chased and the first one does not.
--
-- Custody is derived from an append-only log, never from a holder column. A
-- column would absorb a transfer from somebody who was not holding the thing;
-- the fold rejects it, which is the break the whole feature exists to catch.
--
-- Money is BIGINT cents throughout. A rekey quote that does not reconcile to
-- the invoice is a quote two people will argue about.

-- 1. A keyway and the doors it opens.
CREATE TABLE IF NOT EXISTS credential_keyways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  key_cut_cost_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT keyway_cut_cost_is_not_negative CHECK (key_cut_cost_cents >= 0)
);

CREATE TABLE IF NOT EXISTS keyway_doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyway_id UUID NOT NULL REFERENCES credential_keyways(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  rekey_cost_cents BIGINT NOT NULL,
  CONSTRAINT door_rekey_cost_is_not_negative CHECK (rekey_cost_cents >= 0),
  UNIQUE (keyway_id, label)
);

CREATE INDEX IF NOT EXISTS idx_keyway_doors_keyway ON keyway_doors (keyway_id);

-- 2. Credentials. A card belongs to no keyway, and the constraint says so
--    rather than leaving it to be remembered — a card carrying a keyway id
--    would make the exposure calculation quietly wrong for the cheap case.
CREATE TABLE IF NOT EXISTS access_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  credential_type VARCHAR(16) NOT NULL
    CHECK (credential_type IN ('PHYSICAL_KEY', 'ACCESS_CARD')),
  label VARCHAR(160) NOT NULL,
  keyway_id UUID REFERENCES credential_keyways(id) ON DELETE RESTRICT,
  replacement_cost_cents BIGINT NOT NULL DEFAULT 0,
  deposit_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credential_key_has_a_keyway CHECK (
    (credential_type = 'PHYSICAL_KEY') = (keyway_id IS NOT NULL)
  ),
  CONSTRAINT credential_costs_are_not_negative CHECK (
    replacement_cost_cents >= 0 AND deposit_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_credentials_club ON access_credentials (club_id);
CREATE INDEX IF NOT EXISTS idx_credentials_keyway ON access_credentials (keyway_id);

-- 3. The custody log. Everything about who holds what is a fold over this.
CREATE TABLE IF NOT EXISTS credential_custody_events (
  sequence BIGSERIAL PRIMARY KEY,
  credential_id UUID NOT NULL REFERENCES access_credentials(id) ON DELETE CASCADE,
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN (
    'ISSUED', 'TRANSFER_INITIATED', 'TRANSFER_ACKNOWLEDGED',
    'TRANSFER_DECLINED', 'RETURNED', 'REVOKED'
  )),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custody_transfer_names_a_recipient CHECK (
    event_type NOT IN ('ISSUED', 'TRANSFER_INITIATED', 'TRANSFER_ACKNOWLEDGED')
    OR to_user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_custody_events_credential
  ON credential_custody_events (credential_id, occurred_at, sequence);

CREATE OR REPLACE FUNCTION credential_custody_is_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'credential_custody_events is append-only; % is not permitted.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_append_only ON credential_custody_events;
CREATE TRIGGER trg_custody_append_only
BEFORE UPDATE OR DELETE ON credential_custody_events
FOR EACH ROW EXECUTE FUNCTION credential_custody_is_append_only();

-- 4. Return demands, raised when the role that justified the credential ends.
CREATE TABLE IF NOT EXISTS credential_return_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL UNIQUE
    REFERENCES access_credentials(id) ON DELETE CASCADE,
  raised_at TIMESTAMPTZ NOT NULL,
  due_by TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  CONSTRAINT return_demand_allows_time_to_comply CHECK (due_by > raised_at)
);

-- 5. Custody at an instant, folded from the log.
--
--    There is no stored holder to read. Every question about custody goes
--    through this, which is what makes a broken chain detectable rather than
--    merely regrettable.
CREATE OR REPLACE FUNCTION credential_holder_at(
  p_credential_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  holder_user_id UUID,
  pending_transfer_to UUID,
  retired BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_row RECORD;
BEGIN
  holder_user_id := NULL;
  pending_transfer_to := NULL;
  retired := FALSE;

  FOR v_row IN
    SELECT event_type, to_user_id
    FROM credential_custody_events
    WHERE credential_id = p_credential_id AND occurred_at <= p_as_of
    ORDER BY occurred_at, sequence
  LOOP
    CASE v_row.event_type
      WHEN 'ISSUED' THEN
        holder_user_id := v_row.to_user_id;
      WHEN 'TRANSFER_INITIATED' THEN
        pending_transfer_to := v_row.to_user_id;
      WHEN 'TRANSFER_ACKNOWLEDGED' THEN
        holder_user_id := v_row.to_user_id;
        pending_transfer_to := NULL;
      WHEN 'TRANSFER_DECLINED' THEN
        -- Custody never moved, so there is nothing to put back.
        pending_transfer_to := NULL;
      WHEN 'RETURNED' THEN
        holder_user_id := NULL;
        pending_transfer_to := NULL;
      WHEN 'REVOKED' THEN
        holder_user_id := NULL;
        pending_transfer_to := NULL;
        retired := TRUE;
    END CASE;
  END LOOP;

  RETURN NEXT;
END;
$$;

-- 6. Open a transfer.
--
--    The from-holder is checked against the fold, not taken on trust. A
--    transfer claiming to come from somebody who was not holding the credential
--    is the break this feature exists to catch.
CREATE OR REPLACE FUNCTION initiate_credential_transfer(
  p_credential_id UUID,
  p_from UUID,
  p_to UUID,
  p_at TIMESTAMPTZ,
  p_memo TEXT DEFAULT 'Committee handover'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  PERFORM 1 FROM access_credentials WHERE id = p_credential_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown credential %', p_credential_id;
  END IF;

  SELECT * INTO v FROM credential_holder_at(p_credential_id, p_at);

  IF v.retired THEN RETURN 'REFUSED_RETIRED'; END IF;
  IF v.pending_transfer_to IS NOT NULL THEN RETURN 'REFUSED_TRANSFER_PENDING'; END IF;
  IF v.holder_user_id IS NULL THEN RETURN 'REFUSED_NOT_HELD'; END IF;
  IF v.holder_user_id <> p_from THEN RETURN 'REFUSED_BROKEN_CHAIN'; END IF;
  IF p_from = p_to THEN RETURN 'REFUSED_SELF_TRANSFER'; END IF;

  INSERT INTO credential_custody_events (
    credential_id, event_type, from_user_id, to_user_id, occurred_at, memo
  )
  VALUES (p_credential_id, 'TRANSFER_INITIATED', p_from, p_to, p_at, p_memo);

  RETURN 'TRANSFER_INITIATED';
END;
$$;

-- 7. Close a transfer, either way.
--
--    A transfer is two-sided on purpose. Until the receiver acknowledges it,
--    custody stays with the sender rather than sitting between two people who
--    each believe the other has it — which is the state every one of these keys
--    is currently in.
CREATE OR REPLACE FUNCTION resolve_credential_transfer(
  p_credential_id UUID,
  p_by UUID,
  p_at TIMESTAMPTZ,
  p_accept BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM credential_holder_at(p_credential_id, p_at);

  IF v.pending_transfer_to IS NULL THEN RETURN 'REFUSED_NO_PENDING_TRANSFER'; END IF;
  IF v.pending_transfer_to <> p_by THEN RETURN 'REFUSED_NOT_THE_RECIPIENT'; END IF;

  INSERT INTO credential_custody_events (
    credential_id, event_type, from_user_id, to_user_id, occurred_at, memo
  )
  VALUES (
    p_credential_id,
    CASE WHEN p_accept THEN 'TRANSFER_ACKNOWLEDGED' ELSE 'TRANSFER_DECLINED' END,
    v.holder_user_id,
    p_by,
    p_at,
    CASE WHEN p_accept THEN 'Receipt acknowledged' ELSE 'Receipt declined' END
  );

  RETURN CASE WHEN p_accept THEN 'ACKNOWLEDGED' ELSE 'DECLINED' END;
END;
$$;

-- 8. Revoke an access card.
--
--    Refused for a physical key, and the refusal is the useful part. There is
--    no software action that makes brass stop opening a door, so recording one
--    would leave an open door looking closed. The honest response to a lost key
--    is a rekey quote.
CREATE OR REPLACE FUNCTION revoke_access_credential(
  p_credential_id UUID,
  p_at TIMESTAMPTZ,
  p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_type VARCHAR;
BEGIN
  SELECT credential_type INTO v_type FROM access_credentials WHERE id = p_credential_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Unknown credential %', p_credential_id;
  END IF;

  SELECT * INTO v FROM credential_holder_at(p_credential_id, p_at);

  IF v.retired THEN RETURN 'REFUSED_ALREADY_RETIRED'; END IF;
  IF v_type = 'PHYSICAL_KEY' THEN RETURN 'REFUSED_PHYSICAL_KEY'; END IF;
  IF v.holder_user_id IS NULL THEN RETURN 'REFUSED_NOT_HELD'; END IF;

  INSERT INTO credential_custody_events (
    credential_id, event_type, from_user_id, to_user_id, occurred_at, memo
  )
  VALUES (p_credential_id, 'REVOKED', v.holder_user_id, NULL, p_at, p_reason);

  DELETE FROM credential_return_demands WHERE credential_id = p_credential_id;

  RETURN 'REVOKED';
END;
$$;

-- 9. What an unreturned credential would cost to make good.
--
--    The asymmetry between the two types is the reason this function exists. A
--    club with one outstanding lab key and a twenty-pound card in the same
--    "outstanding" list is being told something false about which to chase.
CREATE OR REPLACE FUNCTION credential_rekey_exposure(
  p_credential_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  total_cents BIGINT,
  doors_affected INTEGER,
  door_rekey_cents BIGINT,
  keys_to_recut INTEGER,
  key_recut_cents BIGINT,
  replacement_cents BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cred RECORD;
  v_cut BIGINT;
BEGIN
  SELECT * INTO v_cred FROM access_credentials WHERE id = p_credential_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown credential %', p_credential_id;
  END IF;

  IF v_cred.credential_type = 'ACCESS_CARD' THEN
    total_cents := v_cred.replacement_cost_cents;
    doors_affected := 0;
    door_rekey_cents := 0;
    keys_to_recut := 0;
    key_recut_cents := 0;
    replacement_cents := v_cred.replacement_cost_cents;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(rekey_cost_cents), 0)
  INTO doors_affected, door_rekey_cents
  FROM keyway_doors WHERE keyway_id = v_cred.keyway_id;

  SELECT key_cut_cost_cents INTO v_cut
  FROM credential_keyways WHERE id = v_cred.keyway_id;

  -- Every other live key against this keyway has to be recut once the locks
  -- change. The lost key itself is not recut; it is the reason for the work.
  SELECT COUNT(*)::INTEGER INTO keys_to_recut
  FROM access_credentials c
  WHERE c.keyway_id = v_cred.keyway_id
    AND c.id <> p_credential_id
    AND c.credential_type = 'PHYSICAL_KEY'
    AND NOT (SELECT h.retired FROM credential_holder_at(c.id, p_as_of) h);

  key_recut_cents := keys_to_recut * v_cut;
  replacement_cents := 0;
  total_cents := door_rekey_cents + key_recut_cents;
  RETURN NEXT;
END;
$$;

-- 10. Standing, and whether the holder is past a return deadline.
CREATE OR REPLACE FUNCTION assess_credential(
  p_credential_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  standing TEXT,
  holder_user_id UUID,
  pending_transfer_to UUID,
  delinquent BOOLEAN,
  due_by TIMESTAMPTZ,
  exposure_cents BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v RECORD;
  v_demand RECORD;
BEGIN
  SELECT * INTO v FROM credential_holder_at(p_credential_id, p_assessed_at);
  SELECT * INTO v_demand FROM credential_return_demands WHERE credential_id = p_credential_id;

  holder_user_id := v.holder_user_id;
  pending_transfer_to := v.pending_transfer_to;
  due_by := v_demand.due_by;

  delinquent := v_demand.due_by IS NOT NULL
    AND v.holder_user_id IS NOT NULL
    AND p_assessed_at > v_demand.due_by;

  standing := CASE
    WHEN v.retired THEN 'RETIRED'
    WHEN delinquent THEN 'DELINQUENT'
    WHEN v.pending_transfer_to IS NOT NULL THEN 'IN_TRANSFER'
    WHEN v.holder_user_id IS NOT NULL THEN 'HELD'
    ELSE 'IN_STORE'
  END;

  -- Quoted whatever the standing, so a club can see the risk before it is
  -- realised rather than only after.
  SELECT e.total_cents INTO exposure_cents
  FROM credential_rekey_exposure(p_credential_id, p_assessed_at) e;

  RETURN NEXT;
END;
$$;

-- 11. Deposit settlement.
--
--     Forfeit is capped at the exposure rather than at the deposit. A deposit
--     larger than the cost of putting things right is not a windfall, and
--     keeping the difference would make the deposit a fine. Where the exposure
--     is the larger, the uncovered remainder is reported rather than
--     disappearing into a negative refund.
CREATE OR REPLACE FUNCTION settle_credential_deposit(
  p_credential_id UUID,
  p_at TIMESTAMPTZ
)
RETURNS TABLE (
  held_cents BIGINT,
  refunded_cents BIGINT,
  forfeited_cents BIGINT,
  unrecovered_shortfall_cents BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v RECORD;
  v_held BIGINT;
BEGIN
  SELECT deposit_cents INTO v_held FROM access_credentials WHERE id = p_credential_id;
  IF v_held IS NULL THEN
    RAISE EXCEPTION 'Unknown credential %', p_credential_id;
  END IF;

  SELECT * INTO v FROM assess_credential(p_credential_id, p_at);

  held_cents := v_held;

  IF NOT v.delinquent THEN
    refunded_cents := v_held;
    forfeited_cents := 0;
    unrecovered_shortfall_cents := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  forfeited_cents := LEAST(v_held, v.exposure_cents);
  refunded_cents := v_held - forfeited_cents;
  unrecovered_shortfall_cents := GREATEST(0, v.exposure_cents - v_held);
  RETURN NEXT;
END;
$$;

-- 12. What a club is carrying, delinquent and dearest first.
CREATE OR REPLACE FUNCTION club_credential_exposure(
  p_club_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  credential_id UUID,
  label VARCHAR,
  standing TEXT,
  delinquent BOOLEAN,
  exposure_cents BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id, c.label, a.standing, a.delinquent, a.exposure_cents
  FROM access_credentials c
  CROSS JOIN LATERAL assess_credential(c.id, p_assessed_at) a
  WHERE c.club_id = p_club_id
  ORDER BY a.delinquent DESC, a.exposure_cents DESC, c.label ASC;
$$;

-- 13. Row level security. A holder sees what they hold; the custody log for a
--     credential is visible to the club that owns it, because "who had this
--     last" is the question the whole feature answers.
ALTER TABLE credential_keyways ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyway_doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_return_demands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credentials_club_member_read ON access_credentials;
CREATE POLICY credentials_club_member_read ON access_credentials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = access_credentials.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS custody_events_club_member_read ON credential_custody_events;
CREATE POLICY custody_events_club_member_read ON credential_custody_events
  FOR SELECT TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM access_credentials c
      JOIN club_members m ON m.club_id = c.club_id
      WHERE c.id = credential_custody_events.credential_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS return_demands_holder_read ON credential_return_demands;
CREATE POLICY return_demands_holder_read ON credential_return_demands
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM access_credentials c
      JOIN club_members m ON m.club_id = c.club_id
      WHERE c.id = credential_return_demands.credential_id AND m.user_id = auth.uid()
    )
  );

-- Keyway costings are estimating data with no personal content in them, and the
-- exposure figure is meaningless without the doors behind it.
DROP POLICY IF EXISTS keyways_authenticated_read ON credential_keyways;
CREATE POLICY keyways_authenticated_read ON credential_keyways
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS keyway_doors_authenticated_read ON keyway_doors;
CREATE POLICY keyway_doors_authenticated_read ON keyway_doors
  FOR SELECT TO authenticated USING (TRUE);

GRANT EXECUTE ON FUNCTION credential_holder_at(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION credential_rekey_exposure(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_credential(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION club_credential_exposure(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION settle_credential_deposit(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION initiate_credential_transfer(UUID, UUID, UUID, TIMESTAMPTZ, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_credential_transfer(UUID, UUID, TIMESTAMPTZ, BOOLEAN)
  TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_access_credential(UUID, TIMESTAMPTZ, TEXT) TO service_role;

COMMENT ON TABLE credential_custody_events IS
  'Append-only. Custody is a fold over these rows and never a stored holder column, which is what makes a transfer from a non-holder detectable instead of silently absorbed.';
COMMENT ON FUNCTION revoke_access_credential(UUID, TIMESTAMPTZ, TEXT) IS
  'Cards only. A physical key cannot be revoked in software, and recording that it was would leave an open door looking closed.';
COMMENT ON FUNCTION credential_rekey_exposure(UUID, TIMESTAMPTZ) IS
  'A card costs a replacement; a key costs every lock on its keyway plus a recut of every other key issued against it.';
