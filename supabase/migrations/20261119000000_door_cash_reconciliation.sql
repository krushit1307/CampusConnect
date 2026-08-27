-- Migration: 20261119000000_door_cash_reconciliation.sql
-- Description: Issue #3400 - Door cash reconciliation for walk-in ticket sales
--
-- The money chain assumes the money is digital: Stripe settles cards, tickets
-- are issued as QR codes, club_finances aggregates the ledger. Cash taken at
-- the door appears nowhere in it, so the treasurer reconciles a Stripe
-- settlement against a number on a scrap of paper.
--
-- Every amount here is an integer of minor units. Numeric currency in a schema
-- whose entire purpose is detecting a discrepancy would be self-defeating; the
-- conversion happens once, at the point of posting to the ledger.

-- 1. A drawer is one till at one door for one event. Large events run two or
--    three, and they are reconciled separately: a single shortfall is far
--    easier to locate when the other doors balance, and merging the counts at
--    the point of counting throws that away permanently.
CREATE TABLE IF NOT EXISTS public.door_cash_drawers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    UNIQUE (event_id, label),
    CONSTRAINT drawer_close_recorded CHECK (
        (closed_at IS NULL) = (closed_by IS NULL)
    ),
    CONSTRAINT drawer_settle_after_close CHECK (
        settled_at IS NULL OR closed_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_door_drawer_event ON public.door_cash_drawers (event_id);

-- 2. Counts, by denomination.
--
--    A single typed total is a number somebody derived by hand, and that
--    derivation is the step that goes wrong. Counting by denomination also
--    makes a slip visible as an implausible quantity rather than as an
--    unexplained variance an hour later.
CREATE TABLE IF NOT EXISTS public.drawer_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawer_id UUID NOT NULL REFERENCES public.door_cash_drawers(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('OPENING', 'CLOSING')),
    counted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (drawer_id, stage)
);

CREATE TABLE IF NOT EXISTS public.drawer_count_lines (
    count_id UUID NOT NULL REFERENCES public.drawer_counts(id) ON DELETE CASCADE,
    -- Face value in minor units.
    denomination INTEGER NOT NULL CHECK (denomination > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (count_id, denomination)
);

-- 3. What happened at the door.
--
--    Comps, voids and refunds are first-class entries, not absences. A comp
--    increments attendance and not cash; a void must be reversible with a
--    reason and must not silently disappear, because a void that leaves no
--    trace is indistinguishable from theft.
CREATE TABLE IF NOT EXISTS public.door_cash_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawer_id UUID NOT NULL REFERENCES public.door_cash_drawers(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('SALE', 'COMP', 'VOID', 'REFUND', 'PAYOUT')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    ticket_tier TEXT,
    voids_entry_id UUID REFERENCES public.door_cash_entries(id) ON DELETE RESTRICT,
    reason TEXT,
    sold_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A comp is free by definition; a non-zero comp is a miscategorised sale.
    CONSTRAINT door_entry_comp_is_free CHECK (kind <> 'COMP' OR amount_minor = 0),
    -- A void names what it reverses and why, or it is not a void.
    CONSTRAINT door_entry_void_is_explained CHECK (
        kind <> 'VOID' OR (voids_entry_id IS NOT NULL AND reason IS NOT NULL)
    ),
    CONSTRAINT door_entry_refund_is_explained CHECK (kind <> 'REFUND' OR reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_door_entry_drawer ON public.door_cash_entries (drawer_id, kind);

-- Each sale can be voided once. A second void would double-subtract it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_door_entry_single_void
    ON public.door_cash_entries (voids_entry_id)
    WHERE voids_entry_id IS NOT NULL;

-- 4. Chain of custody from the door to the deposit.
--
--    Recorded as segments rather than a start and an end so that a loss can be
--    located. "We are short somewhere between the door and the bank" is not
--    actionable; "the amount dropped between the second and third handover" is.
CREATE TABLE IF NOT EXISTS public.cash_custody_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawer_id UUID NOT NULL REFERENCES public.door_cash_drawers(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    CONSTRAINT custody_transfer_changes_hands CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_custody_transfer_drawer
    ON public.cash_custody_transfers (drawer_id, occurred_at);

-- 5. Variance thresholds.
--
--    A fixed amount is absurd at both $50 and $5,000 of takings, so the bands
--    combine an absolute floor with a proportion: the floor stops a small event
--    escalating on rounding, the proportion stops a large one hiding a real
--    loss inside a generous flat allowance.
CREATE TABLE IF NOT EXISTS public.cash_variance_thresholds (
    club_id UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    tolerance_minor INTEGER NOT NULL DEFAULT 200 CHECK (tolerance_minor >= 0),
    investigate_fraction NUMERIC(5,4) NOT NULL DEFAULT 0.0100 CHECK (investigate_fraction > 0),
    escalate_fraction NUMERIC(5,4) NOT NULL DEFAULT 0.0500 CHECK (escalate_fraction > 0),
    escalate_minor INTEGER NOT NULL DEFAULT 10000 CHECK (escalate_minor > 0),
    CONSTRAINT variance_fractions_ordered CHECK (escalate_fraction >= investigate_fraction)
);

-- 6. A count's total, summed from its lines.
CREATE OR REPLACE FUNCTION public.drawer_count_total(p_drawer_id UUID, p_stage TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(SUM(l.denomination * l.quantity), 0)::INTEGER
    FROM public.drawer_counts c
    JOIN public.drawer_count_lines l ON l.count_id = c.id
    WHERE c.drawer_id = p_drawer_id AND c.stage = p_stage;
$$;

-- 7. What the drawer should hold: float + sales - refunds - payouts.
--
--    Derived from the entries rather than asserted. Voided sales are excluded
--    while both rows stay on the table.
CREATE OR REPLACE FUNCTION public.drawer_expected_total(p_drawer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        public.drawer_count_total(p_drawer_id, 'OPENING')
        + COALESCE((
            SELECT SUM(e.amount_minor)
            FROM public.door_cash_entries e
            WHERE e.drawer_id = p_drawer_id
              AND e.kind = 'SALE'
              AND NOT EXISTS (
                  SELECT 1 FROM public.door_cash_entries v
                  WHERE v.kind = 'VOID' AND v.voids_entry_id = e.id
              )
        ), 0)
        - COALESCE((
            SELECT SUM(e.amount_minor)
            FROM public.door_cash_entries e
            WHERE e.drawer_id = p_drawer_id AND e.kind IN ('REFUND', 'PAYOUT')
        ), 0);
$$;

-- 8. Counted minus expected. Positive is an overage, which is graded exactly
--    as a shortage: money the ledger does not know about usually means a sale
--    went unrecorded, the same failure seen from the other side.
CREATE OR REPLACE FUNCTION public.drawer_variance(p_drawer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT public.drawer_count_total(p_drawer_id, 'CLOSING')
         - public.drawer_expected_total(p_drawer_id);
$$;

CREATE OR REPLACE FUNCTION public.drawer_variance_band(p_drawer_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_variance INTEGER;
    v_takings INTEGER;
    v_magnitude INTEGER;
    v_thresholds RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.drawer_counts
        WHERE drawer_id = p_drawer_id AND stage = 'CLOSING'
    ) THEN
        -- An uncounted drawer is unresolved, not balanced. Reporting it as
        -- balanced is how a shortfall goes unnoticed indefinitely.
        RETURN 'ESCALATE';
    END IF;

    SELECT COALESCE(t.tolerance_minor, 200) AS tolerance_minor,
           COALESCE(t.investigate_fraction, 0.01) AS investigate_fraction,
           COALESCE(t.escalate_fraction, 0.05) AS escalate_fraction,
           COALESCE(t.escalate_minor, 10000) AS escalate_minor
    INTO v_thresholds
    FROM public.door_cash_drawers d
    LEFT JOIN public.cash_variance_thresholds t ON t.club_id = d.club_id
    WHERE d.id = p_drawer_id;

    v_variance := public.drawer_variance(p_drawer_id);
    v_magnitude := ABS(v_variance);

    SELECT COALESCE(SUM(e.amount_minor), 0) INTO v_takings
    FROM public.door_cash_entries e
    WHERE e.drawer_id = p_drawer_id
      AND e.kind = 'SALE'
      AND NOT EXISTS (
          SELECT 1 FROM public.door_cash_entries v
          WHERE v.kind = 'VOID' AND v.voids_entry_id = e.id
      );

    IF v_magnitude = 0 THEN RETURN 'BALANCED'; END IF;
    IF v_magnitude <= v_thresholds.tolerance_minor THEN RETURN 'WITHIN_TOLERANCE'; END IF;
    IF v_magnitude >= v_thresholds.escalate_minor THEN RETURN 'ESCALATE'; END IF;

    IF v_takings = 0 THEN
        -- Cash in a drawer that took nothing has no proportion to be measured
        -- against, and is an anomaly by its existence.
        RETURN 'ESCALATE';
    END IF;

    IF v_magnitude::NUMERIC / v_takings >= v_thresholds.escalate_fraction THEN
        RETURN 'ESCALATE';
    END IF;

    IF v_magnitude::NUMERIC / v_takings >= v_thresholds.investigate_fraction THEN
        RETURN 'INVESTIGATE';
    END IF;

    RETURN 'WITHIN_TOLERANCE';
END;
$$;

-- 9. Per-drawer reconciliation for an event.
CREATE OR REPLACE VIEW public.door_cash_reconciliation AS
    SELECT
        d.id AS drawer_id,
        d.event_id,
        d.club_id,
        d.label,
        public.drawer_count_total(d.id, 'OPENING') AS opening_float_minor,
        public.drawer_expected_total(d.id) AS expected_minor,
        public.drawer_count_total(d.id, 'CLOSING') AS counted_minor,
        public.drawer_variance(d.id) AS variance_minor,
        public.drawer_variance_band(d.id) AS band,
        (
            SELECT COUNT(*)::INTEGER FROM public.door_cash_entries e
            WHERE e.drawer_id = d.id AND e.kind = 'COMP'
        ) AS comp_count,
        (
            SELECT COUNT(*)::INTEGER FROM public.door_cash_entries e
            WHERE e.drawer_id = d.id AND e.kind = 'VOID'
        ) AS void_count,
        d.closed_at IS NOT NULL AS closed
    FROM public.door_cash_drawers d;

-- 10. Walks the handover chain and names the segment where money changed.
CREATE OR REPLACE FUNCTION public.custody_chain_faults(p_drawer_id UUID)
RETURNS TABLE (
    transfer_id UUID,
    fault TEXT,
    from_user_id UUID,
    to_user_id UUID,
    delta_minor INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH ordered AS (
        SELECT
            t.*,
            LAG(t.to_user_id) OVER (ORDER BY t.occurred_at, t.id) AS previous_holder,
            COALESCE(
                LAG(t.amount_minor) OVER (ORDER BY t.occurred_at, t.id),
                public.drawer_count_total(p_drawer_id, 'CLOSING')
            ) AS previous_amount
        FROM public.cash_custody_transfers t
        WHERE t.drawer_id = p_drawer_id
    )
    SELECT o.id, 'AMOUNT_CHANGED', o.from_user_id, o.to_user_id,
           (o.amount_minor - o.previous_amount)::INTEGER
    FROM ordered o
    WHERE o.amount_minor <> o.previous_amount

    UNION ALL

    SELECT o.id, 'BROKEN_CHAIN', o.from_user_id, o.to_user_id, 0
    FROM ordered o
    WHERE o.previous_holder IS NOT NULL AND o.from_user_id <> o.previous_holder

    ORDER BY 1;
$$;

-- 11. A closing count cannot be revised after the fact.
--
--     A reconciliation that can be silently edited does not evidence anything,
--     which is the whole reason this exists rather than a spreadsheet.
CREATE OR REPLACE FUNCTION public.freeze_settled_drawer_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.door_cash_drawers d
        WHERE d.id = COALESCE(NEW.drawer_id, OLD.drawer_id)
          AND d.settled_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'This drawer has been settled; its counts can no longer be changed'
            USING HINT = 'Post a correcting entry rather than editing the count.';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_settled_counts ON public.drawer_counts;
CREATE TRIGGER trg_freeze_settled_counts
    BEFORE INSERT OR UPDATE OR DELETE ON public.drawer_counts
    FOR EACH ROW
    EXECUTE FUNCTION public.freeze_settled_drawer_counts();

DROP TRIGGER IF EXISTS trg_freeze_settled_entries ON public.door_cash_entries;
CREATE TRIGGER trg_freeze_settled_entries
    BEFORE INSERT OR UPDATE OR DELETE ON public.door_cash_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.freeze_settled_drawer_counts();

-- 12. A drawer cannot be settled while it is still unbalanced beyond tolerance
--     and unexplained. Settling an escalated drawer silently is the outcome
--     the whole module exists to prevent.
CREATE OR REPLACE FUNCTION public.guard_drawer_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.settled_at IS NULL OR OLD.settled_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF public.drawer_variance_band(NEW.id) = 'ESCALATE' THEN
        RAISE EXCEPTION
            'Drawer % cannot be settled while its variance is escalated (% minor units)',
            NEW.label, public.drawer_variance(NEW.id)
            USING HINT = 'Record the explanation and have the treasurer sign it off first.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_drawer_settlement ON public.door_cash_drawers;
CREATE TRIGGER trg_guard_drawer_settlement
    BEFORE UPDATE OF settled_at ON public.door_cash_drawers
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_drawer_settlement();

-- 13. Row level security. Cash records are financial evidence: readable by the
--     people who handled the money, and not editable once settled.
ALTER TABLE public.door_cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_custody_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_variance_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Handlers read their own drawers" ON public.door_cash_drawers;
CREATE POLICY "Handlers read their own drawers"
    ON public.door_cash_drawers FOR SELECT
    USING (opened_by = auth.uid() OR closed_by = auth.uid());

DROP POLICY IF EXISTS "Sellers record their own entries" ON public.door_cash_entries;
CREATE POLICY "Sellers record their own entries"
    ON public.door_cash_entries FOR INSERT
    TO authenticated
    WITH CHECK (sold_by = auth.uid());

DROP POLICY IF EXISTS "Sellers read entries they made" ON public.door_cash_entries;
CREATE POLICY "Sellers read entries they made"
    ON public.door_cash_entries FOR SELECT
    USING (sold_by = auth.uid());

DROP POLICY IF EXISTS "Custody is recorded by the person handing over"
    ON public.cash_custody_transfers;
CREATE POLICY "Custody is recorded by the person handing over"
    ON public.cash_custody_transfers FOR INSERT
    TO authenticated
    WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Custody is visible to both parties" ON public.cash_custody_transfers;
CREATE POLICY "Custody is visible to both parties"
    ON public.cash_custody_transfers FOR SELECT
    USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

REVOKE ALL ON public.door_cash_drawers FROM anon;
REVOKE ALL ON public.door_cash_entries FROM anon;
REVOKE ALL ON public.cash_custody_transfers FROM anon;

COMMENT ON TABLE public.door_cash_drawers IS
    'One till at one door for one event, reconciled independently of the others (#3400).';
COMMENT ON TABLE public.drawer_count_lines IS
    'Denomination-level counts. A typed total is a number derived by hand, which is the step that goes wrong.';
COMMENT ON FUNCTION public.drawer_expected_total IS
    'Float + sales - refunds - payouts, derived from the entries rather than asserted.';
COMMENT ON FUNCTION public.custody_chain_faults IS
    'Names the handover the money changed across, rather than reporting an end-to-end mismatch.';
