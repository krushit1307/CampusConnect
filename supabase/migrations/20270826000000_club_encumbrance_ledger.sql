-- Migration: 20270826000000_club_encumbrance_ledger.sql
-- Description: Schema and functions for the Club Purchase Order Encumbrance
--              Ledger (#4553).
--
-- A treasurer raises an order, the advisor approves it, and the invoice lands
-- anywhere from three days to six weeks later. Recording the money only at
-- reconciliation means that for those six weeks it is spent in every sense that
-- matters while still being visible as available. Two officers approve against
-- the same catering line on the same afternoon, both checks pass because
-- neither approval moved the number the other was reading, and the line goes
-- negative when both invoices land.
--
-- Two rules hold everything else up.
--
-- Every amount is BIGINT cents. Budget arithmetic accumulates across a whole
-- fiscal year and a NUMERIC rounding a hundredth of a cent per operation
-- eventually disagrees with the bank.
--
-- Every balance is derived from the append-only event table. Nothing here keeps
-- a running total that could drift from the history that produced it, which is
-- also what makes "what did this line look like on the 3rd?" answerable.

-- 1. A budget line: an allocation for one club, one category, one fiscal year.
CREATE TABLE IF NOT EXISTS club_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  fiscal_year VARCHAR(12) NOT NULL,
  category VARCHAR(64) NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  -- Set by the year-close sweep. Kept separate from closes_at so a line that
  -- passed its close date but has not been swept is still distinguishable from
  -- one that has been.
  swept_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, fiscal_year, category),
  CONSTRAINT budget_line_closes_after_opening CHECK (closes_at > opened_at)
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_club
  ON club_budget_lines (club_id, fiscal_year);

-- 2. Purchase orders. An order exists from the moment it is raised; approving
--    it is what creates the encumbrance, so DRAFT and REJECTED orders sit here
--    without ever touching a balance.
CREATE TABLE IF NOT EXISTS club_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES club_budget_lines(id) ON DELETE CASCADE,
  reference VARCHAR(32) NOT NULL UNIQUE,
  vendor_name VARCHAR(160) NOT NULL,
  estimated_cents BIGINT NOT NULL,
  raised_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED')),
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  CONSTRAINT purchase_order_estimate_is_positive CHECK (estimated_cents > 0),
  CONSTRAINT purchase_order_approval_is_complete CHECK (
    (status <> 'APPROVED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_line
  ON club_purchase_orders (line_id, status);

-- 3. One encumbrance per approved order.
CREATE TABLE IF NOT EXISTS club_encumbrances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL UNIQUE
    REFERENCES club_purchase_orders(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES club_budget_lines(id) ON DELETE CASCADE,
  committed_cents BIGINT NOT NULL,
  liquidated_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'PARTIALLY_LIQUIDATED', 'LIQUIDATED', 'CANCELLED', 'EXPIRED')),
  approved_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  CONSTRAINT encumbrance_commitment_is_positive CHECK (committed_cents > 0),
  CONSTRAINT encumbrance_liquidation_is_not_negative CHECK (liquidated_cents >= 0),
  CONSTRAINT encumbrance_settled_when_terminal CHECK (
    (status IN ('OPEN', 'PARTIALLY_LIQUIDATED')) = (settled_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_encumbrances_live
  ON club_encumbrances (line_id)
  WHERE status IN ('OPEN', 'PARTIALLY_LIQUIDATED');

-- 4. The log. Everything else in this file is a projection of this table.
--
--    RELEASED carries a reason because a cancelled order, an underspent one and
--    one swept at year close all move the same bucket but are three different
--    conversations with the advisor.
CREATE TABLE IF NOT EXISTS club_encumbrance_events (
  sequence BIGSERIAL PRIMARY KEY,
  line_id UUID NOT NULL REFERENCES club_budget_lines(id) ON DELETE CASCADE,
  encumbrance_id UUID REFERENCES club_encumbrances(id) ON DELETE CASCADE,
  event_type VARCHAR(16) NOT NULL
    CHECK (event_type IN ('ALLOCATED', 'ENCUMBERED', 'RELEASED', 'LIQUIDATED')),
  amount_cents BIGINT NOT NULL,
  release_reason VARCHAR(32)
    CHECK (release_reason IN ('LIQUIDATION_UNDERRUN', 'CANCELLATION', 'FISCAL_YEAR_CLOSE')),
  occurred_at TIMESTAMPTZ NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Magnitudes only. The type says which bucket moves and in which direction,
  -- so a sign here would be a second, redundant source of truth.
  CONSTRAINT encumbrance_event_amount_is_positive CHECK (amount_cents >= 0),
  CONSTRAINT encumbrance_event_reason_only_on_release CHECK (
    release_reason IS NULL OR event_type = 'RELEASED'
  ),
  CONSTRAINT encumbrance_event_has_subject CHECK (
    event_type = 'ALLOCATED' OR encumbrance_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_encumbrance_events_line_time
  ON club_encumbrance_events (line_id, occurred_at, sequence);

-- 5. Append-only, enforced rather than documented. A balance that can be
--    reconstructed as of any instant is worth nothing if a row can be edited
--    afterwards.
CREATE OR REPLACE FUNCTION club_encumbrance_events_are_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'club_encumbrance_events is append-only; % is not permitted.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_encumbrance_events_immutable ON club_encumbrance_events;
CREATE TRIGGER trg_encumbrance_events_immutable
BEFORE UPDATE OR DELETE ON club_encumbrance_events
FOR EACH ROW EXECUTE FUNCTION club_encumbrance_events_are_immutable();

-- 6. The balance of a line as of an instant, folded from the log.
--
--    Takes the instant as an argument rather than reading NOW(), so the
--    year-end reconciliation pack and a live approval check run the same code.
CREATE OR REPLACE FUNCTION club_budget_line_balance(
  p_line_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  allocated_cents BIGINT,
  encumbered_cents BIGINT,
  liquidated_cents BIGINT,
  available_cents BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH folded AS (
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'ALLOCATED'), 0)  AS allocated,
      COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'ENCUMBERED'), 0)
        - COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'RELEASED'), 0) AS encumbered,
      COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'LIQUIDATED'), 0)  AS liquidated
    FROM club_encumbrance_events
    WHERE line_id = p_line_id
      AND (p_as_of IS NULL OR occurred_at <= p_as_of)
  )
  SELECT
    allocated,
    encumbered,
    liquidated,
    allocated - liquidated - encumbered
  FROM folded;
$$;

COMMENT ON FUNCTION club_budget_line_balance(UUID, TIMESTAMPTZ) IS
  'Folds the append-only event log. available = allocated - liquidated - encumbered; the only figure an approval may check against.';

-- 7. Approve an order.
--
--    The row lock is the point of this function. Checking availability and
--    writing the commitment must be one operation, because the failure this
--    whole feature exists to prevent is two approvals that each read a balance
--    the other was about to spend.
CREATE OR REPLACE FUNCTION approve_club_purchase_order(
  p_purchase_order_id UUID,
  p_approver UUID,
  p_approved_at TIMESTAMPTZ
)
RETURNS TABLE (
  outcome TEXT,
  encumbrance_id UUID,
  available_after_cents BIGINT,
  shortfall_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_line RECORD;
  v_available BIGINT;
  v_encumbrance UUID;
BEGIN
  SELECT * INTO v_order FROM club_purchase_orders WHERE id = p_purchase_order_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNKNOWN_PURCHASE_ORDER'::TEXT, NULL::UUID, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  IF v_order.status = 'APPROVED' THEN
    RETURN QUERY SELECT 'DUPLICATE_PURCHASE_ORDER'::TEXT, NULL::UUID, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Serialises concurrent approvals against this line, and nothing wider.
  SELECT * INTO v_line FROM club_budget_lines WHERE id = v_order.line_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'LINE_NOT_FOUND'::TEXT, NULL::UUID, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  SELECT b.available_cents INTO v_available
  FROM club_budget_line_balance(v_line.id, NULL) b;

  IF v_line.swept_at IS NOT NULL OR p_approved_at >= v_line.closes_at THEN
    RETURN QUERY SELECT 'LINE_CLOSED'::TEXT, NULL::UUID, v_available, 0::BIGINT;
    RETURN;
  END IF;

  IF v_available < v_order.estimated_cents THEN
    RETURN QUERY SELECT
      'INSUFFICIENT_AVAILABLE'::TEXT,
      NULL::UUID,
      v_available,
      (v_order.estimated_cents - v_available)::BIGINT;
    RETURN;
  END IF;

  INSERT INTO club_encumbrances (
    purchase_order_id, line_id, committed_cents, approved_at
  )
  VALUES (v_order.id, v_line.id, v_order.estimated_cents, p_approved_at)
  RETURNING id INTO v_encumbrance;

  UPDATE club_purchase_orders
  SET status = 'APPROVED', approved_by = p_approver, approved_at = p_approved_at
  WHERE id = v_order.id;

  INSERT INTO club_encumbrance_events (
    line_id, encumbrance_id, event_type, amount_cents, occurred_at, memo
  )
  VALUES (
    v_line.id, v_encumbrance, 'ENCUMBERED', v_order.estimated_cents, p_approved_at,
    format('PO %s to %s', v_order.reference, v_order.vendor_name)
  );

  RETURN QUERY SELECT
    'APPROVED'::TEXT,
    v_encumbrance,
    (v_available - v_order.estimated_cents)::BIGINT,
    0::BIGINT;
END;
$$;

-- 8. Liquidate an encumbrance against an invoice.
--
--    The two directions are not symmetrical. Under the estimate, the difference
--    was never spent and belongs back on the line — but only once the order is
--    final, because a deposit invoice is not evidence that the balance invoice
--    will be small. Over the estimate, the excess was never checked against
--    anything, so it is checked here and refused if it does not fit. Letting it
--    through would reproduce the overspend one layer down.
CREATE OR REPLACE FUNCTION liquidate_club_encumbrance(
  p_encumbrance_id UUID,
  p_invoice_reference TEXT,
  p_invoiced_cents BIGINT,
  p_occurred_at TIMESTAMPTZ,
  p_final BOOLEAN
)
RETURNS TABLE (
  outcome TEXT,
  liquidated_cents BIGINT,
  released_cents BIGINT,
  overage_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc RECORD;
  v_remaining BIGINT;
  v_overage BIGINT;
  v_available BIGINT;
  v_still_committed BIGINT;
BEGIN
  IF p_invoiced_cents <= 0 THEN
    RAISE EXCEPTION 'Invoice % must be a positive number of cents.', p_invoice_reference;
  END IF;

  SELECT * INTO v_enc FROM club_encumbrances WHERE id = p_encumbrance_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'REFUSED_UNKNOWN_ENCUMBRANCE'::TEXT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  IF v_enc.status NOT IN ('OPEN', 'PARTIALLY_LIQUIDATED') THEN
    RETURN QUERY SELECT 'REFUSED_NOT_LIQUIDATABLE'::TEXT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  v_remaining := v_enc.committed_cents - v_enc.liquidated_cents;
  v_overage := GREATEST(0, p_invoiced_cents - v_remaining);

  IF v_overage > 0 THEN
    -- Available already counts v_remaining as encumbered, so the net draw on
    -- the line is exactly the overage rather than the whole invoice.
    SELECT b.available_cents INTO v_available
    FROM club_budget_line_balance(v_enc.line_id, NULL) b;

    IF v_available < v_overage THEN
      RETURN QUERY SELECT
        'REFUSED_OVERAGE_EXCEEDS_AVAILABLE'::TEXT, 0::BIGINT, 0::BIGINT, v_overage;
      RETURN;
    END IF;
  END IF;

  INSERT INTO club_encumbrance_events (
    line_id, encumbrance_id, event_type, amount_cents, occurred_at, memo
  )
  VALUES (
    v_enc.line_id, v_enc.id, 'RELEASED', LEAST(p_invoiced_cents, v_remaining), p_occurred_at,
    format('Commitment consumed by invoice %s', p_invoice_reference)
  );

  INSERT INTO club_encumbrance_events (
    line_id, encumbrance_id, event_type, amount_cents, occurred_at, memo
  )
  VALUES (
    v_enc.line_id, v_enc.id, 'LIQUIDATED', p_invoiced_cents, p_occurred_at,
    format('Invoice %s', p_invoice_reference)
  );

  v_still_committed := GREATEST(0, v_remaining - p_invoiced_cents);

  IF NOT p_final AND v_still_committed > 0 THEN
    UPDATE club_encumbrances
    SET liquidated_cents = liquidated_cents + p_invoiced_cents,
        status = 'PARTIALLY_LIQUIDATED'
    WHERE id = v_enc.id;

    RETURN QUERY SELECT 'PARTIALLY_LIQUIDATED'::TEXT, p_invoiced_cents, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  IF v_still_committed > 0 THEN
    INSERT INTO club_encumbrance_events (
      line_id, encumbrance_id, event_type, amount_cents, release_reason, occurred_at, memo
    )
    VALUES (
      v_enc.line_id, v_enc.id, 'RELEASED', v_still_committed, 'LIQUIDATION_UNDERRUN',
      p_occurred_at, 'Underspend returned to the line'
    );
  END IF;

  UPDATE club_encumbrances
  SET liquidated_cents = liquidated_cents + p_invoiced_cents,
      status = 'LIQUIDATED',
      settled_at = p_occurred_at
  WHERE id = v_enc.id;

  RETURN QUERY SELECT
    CASE WHEN v_still_committed > 0
      THEN 'LIQUIDATED_WITH_UNDERRUN_RELEASED'
      ELSE 'LIQUIDATED_IN_FULL'
    END::TEXT,
    p_invoiced_cents,
    v_still_committed,
    v_overage;
END;
$$;

-- 9. Cancel an order, returning whatever is still committed.
CREATE OR REPLACE FUNCTION cancel_club_purchase_order(
  p_encumbrance_id UUID,
  p_occurred_at TIMESTAMPTZ,
  p_memo TEXT
)
RETURNS TABLE (outcome TEXT, released_cents BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc RECORD;
  v_remaining BIGINT;
BEGIN
  SELECT * INTO v_enc FROM club_encumbrances WHERE id = p_encumbrance_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'REFUSED_UNKNOWN_ENCUMBRANCE'::TEXT, 0::BIGINT;
    RETURN;
  END IF;

  -- A settled order has nothing left to give back, and releasing against it a
  -- second time would hand the line money it never had.
  IF v_enc.status NOT IN ('OPEN', 'PARTIALLY_LIQUIDATED') THEN
    RETURN QUERY SELECT 'REFUSED_ALREADY_SETTLED'::TEXT, 0::BIGINT;
    RETURN;
  END IF;

  v_remaining := v_enc.committed_cents - v_enc.liquidated_cents;

  IF v_remaining > 0 THEN
    INSERT INTO club_encumbrance_events (
      line_id, encumbrance_id, event_type, amount_cents, release_reason, occurred_at, memo
    )
    VALUES (
      v_enc.line_id, v_enc.id, 'RELEASED', v_remaining, 'CANCELLATION', p_occurred_at, p_memo
    );
  END IF;

  UPDATE club_encumbrances
  SET status = 'CANCELLED', settled_at = p_occurred_at
  WHERE id = v_enc.id;

  RETURN QUERY SELECT 'CANCELLED'::TEXT, v_remaining;
END;
$$;

-- 10. The year-close sweep.
--
--     Idempotent by construction rather than by a guard flag: it only touches
--     encumbrances in a live status and moves them out of it, so a cron that
--     fires twice finds nothing left to act on the second time.
CREATE OR REPLACE FUNCTION sweep_club_budget_line_close(
  p_line_id UUID,
  p_close_at TIMESTAMPTZ
)
RETURNS TABLE (expired_encumbrance_id UUID, released_cents BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_enc RECORD;
  v_remaining BIGINT;
BEGIN
  SELECT * INTO v_line FROM club_budget_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown budget line %', p_line_id;
  END IF;
  IF p_close_at < v_line.closes_at THEN
    RAISE EXCEPTION 'Line % cannot be swept before its close date of %.',
      p_line_id, v_line.closes_at;
  END IF;

  FOR v_enc IN
    SELECT * FROM club_encumbrances
    WHERE line_id = p_line_id
      AND status IN ('OPEN', 'PARTIALLY_LIQUIDATED')
    ORDER BY approved_at
    FOR UPDATE
  LOOP
    v_remaining := v_enc.committed_cents - v_enc.liquidated_cents;

    IF v_remaining > 0 THEN
      INSERT INTO club_encumbrance_events (
        line_id, encumbrance_id, event_type, amount_cents, release_reason, occurred_at, memo
      )
      VALUES (
        p_line_id, v_enc.id, 'RELEASED', v_remaining, 'FISCAL_YEAR_CLOSE', p_close_at,
        format('Unliquidated at %s close', v_line.fiscal_year)
      );
    END IF;

    UPDATE club_encumbrances
    SET status = 'EXPIRED', settled_at = p_close_at
    WHERE id = v_enc.id;

    expired_encumbrance_id := v_enc.id;
    released_cents := v_remaining;
    RETURN NEXT;
  END LOOP;

  UPDATE club_budget_lines SET swept_at = p_close_at WHERE id = p_line_id;
END;
$$;

-- 11. Row level security. A club's finances are visible to its members and to
--     nobody else; every write goes through the functions above.
ALTER TABLE club_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_encumbrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_encumbrance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_lines_member_read ON club_budget_lines;
CREATE POLICY budget_lines_member_read ON club_budget_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = club_budget_lines.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS purchase_orders_member_read ON club_purchase_orders;
CREATE POLICY purchase_orders_member_read ON club_purchase_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM club_budget_lines l
      JOIN club_members m ON m.club_id = l.club_id
      WHERE l.id = club_purchase_orders.line_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS encumbrances_member_read ON club_encumbrances;
CREATE POLICY encumbrances_member_read ON club_encumbrances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM club_budget_lines l
      JOIN club_members m ON m.club_id = l.club_id
      WHERE l.id = club_encumbrances.line_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS encumbrance_events_member_read ON club_encumbrance_events;
CREATE POLICY encumbrance_events_member_read ON club_encumbrance_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM club_budget_lines l
      JOIN club_members m ON m.club_id = l.club_id
      WHERE l.id = club_encumbrance_events.line_id AND m.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION club_budget_line_balance(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_club_purchase_order(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION liquidate_club_encumbrance(UUID, TEXT, BIGINT, TIMESTAMPTZ, BOOLEAN)
  TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_club_purchase_order(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sweep_club_budget_line_close(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON TABLE club_encumbrance_events IS
  'Append-only. Every balance in this feature is a fold over these rows; nothing stores a running total that could drift from them.';
COMMENT ON FUNCTION sweep_club_budget_line_close(UUID, TIMESTAMPTZ) IS
  'Idempotent by construction: only live encumbrances are touched and each is moved out of a live status, so a repeated sweep releases nothing twice.';
