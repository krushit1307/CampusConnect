-- Migration: 20270903000000_music_licence_royalty_accrual.sql
-- Description: Schema and functions for Live Music Licensing royalty accrual —
--              per-society tariff evaluation, the work-level setlist return,
--              and the freeze-then-adjust lifecycle (#4704).
--
-- Somebody in the union office reconstructs a year of events from memory each
-- summer, and the numbers they produce are the numbers the institution is
-- invoiced on. The reconstruction is wrong in three consistent ways.
--
-- There are two royalties on one performance, owed to different people. The
-- composition and the recording are separate rights under separate tariffs, so
-- an office treating "the music licence" as one number is always about half
-- right. It cuts the other way too: a live band plays no recording, so a live
-- event accrues on the composition and nothing on the recording, while a DJ set
-- accrues on both.
--
-- A tariff is not a rate. It is the greater of a per-head charge and a share of
-- gross receipts, subject to a minimum fee, and which of the three binds
-- changes with the event.
--
-- Free admission is not free. Charging nothing puts the event in the
-- no-admission band, which is lower. It does not put it outside the tariff, and
-- the CHECK constraint below says so rather than leaving it to be remembered.
--
-- Money is BIGINT cents throughout. Rounding happens once, where a percentage
-- becomes a figure, so the accrual reconciles to the society's statement.

-- 1. The societies, and which of the two rights each administers.
CREATE TABLE IF NOT EXISTS licensing_societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  right_kind VARCHAR(16) NOT NULL CHECK (right_kind IN ('COMPOSITION', 'RECORDING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tariff bands by venue capacity.
--
--    The no-admission rate is separately constrained to be positive and no
--    higher than the ticketed one. A band rating a free event at nought would
--    encode exactly the belief this feature exists to correct.
CREATE TABLE IF NOT EXISTS licence_tariff_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES licensing_societies(id) ON DELETE CASCADE,
  -- Inclusive upper bound. The open-ended band uses a very large value rather
  -- than NULL so that band selection stays a plain comparison.
  capacity_up_to INT NOT NULL,
  per_head_admission_cents BIGINT NOT NULL,
  per_head_no_admission_cents BIGINT NOT NULL,
  gross_receipts_basis_points INT NOT NULL,
  minimum_fee_cents BIGINT NOT NULL,
  CONSTRAINT band_capacity_is_positive CHECK (capacity_up_to > 0),
  CONSTRAINT band_rates_are_not_negative CHECK (
    per_head_admission_cents >= 0
    AND gross_receipts_basis_points >= 0
    AND minimum_fee_cents >= 0
  ),
  CONSTRAINT band_free_event_is_charged CHECK (per_head_no_admission_cents > 0),
  CONSTRAINT band_free_event_is_not_dearer CHECK (
    per_head_no_admission_cents <= per_head_admission_cents
  ),
  UNIQUE (society_id, capacity_up_to)
);

CREATE INDEX IF NOT EXISTS idx_tariff_bands_society
  ON licence_tariff_bands (society_id, capacity_up_to);

-- 3. What happened at an event, musically.
CREATE TABLE IF NOT EXISTS event_music_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  usage_kind VARCHAR(16) NOT NULL CHECK (usage_kind IN ('RECORDED', 'DJ_SET', 'LIVE')),
  venue_capacity INT NOT NULL,
  attendance INT NOT NULL,
  admission_charged BOOLEAN NOT NULL,
  gross_receipts_cents BIGINT NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT usage_figures_are_possible CHECK (
    venue_capacity > 0 AND attendance >= 0 AND gross_receipts_cents >= 0
  ),
  -- Receipts without an admission charge is a data error that would push the
  -- event into the wrong band and then charge a percentage of the wrong money.
  CONSTRAINT usage_receipts_imply_admission CHECK (
    admission_charged OR gross_receipts_cents = 0
  )
);

CREATE INDEX IF NOT EXISTS idx_music_usages_club ON event_music_usages (club_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_music_usages_kind ON event_music_usages (usage_kind, occurred_at);

-- 4. The work-level return.
CREATE TABLE IF NOT EXISTS setlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id UUID NOT NULL REFERENCES event_music_usages(id) ON DELETE CASCADE,
  work_ref VARCHAR(120) NOT NULL,
  title VARCHAR(240) NOT NULL,
  writer VARCHAR(240) NOT NULL DEFAULT '',
  duration_seconds INT NOT NULL,
  work_status VARCHAR(24) NOT NULL
    CHECK (work_status IN ('IN_COPYRIGHT', 'PUBLIC_DOMAIN', 'UNPUBLISHED_ORIGINAL')),
  performed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT setlist_entry_has_a_title CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT setlist_entry_has_a_duration CHECK (duration_seconds > 0),
  -- An in-copyright work with no writer named is a royalty the society cannot
  -- distribute. A public-domain traditional may name none, because often there
  -- is none.
  CONSTRAINT setlist_entry_names_a_writer CHECK (
    work_status = 'PUBLIC_DOMAIN' OR LENGTH(TRIM(writer)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_setlist_entries_usage ON setlist_entries (usage_id);
-- The same work played twice in one set is two performances and one work, so
-- this index is deliberately not unique on (usage_id, work_ref).
CREATE INDEX IF NOT EXISTS idx_setlist_entries_work ON setlist_entries (work_ref);

-- 5. The submitted return, frozen at the figures that applied when it went in.
CREATE TABLE IF NOT EXISTS licensing_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id UUID NOT NULL UNIQUE REFERENCES event_music_usages(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The figures as they stood. A later correction produces an adjustment, not a
  -- rewrite: this is the document the invoice was raised against.
  attendance_at_submission INT NOT NULL,
  gross_receipts_at_submission_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS royalty_accrual_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES licensing_returns(id) ON DELETE CASCADE,
  society_id UUID NOT NULL REFERENCES licensing_societies(id) ON DELETE RESTRICT,
  band_capacity_up_to INT NOT NULL,
  per_head_cents BIGINT NOT NULL,
  per_head_total_cents BIGINT NOT NULL,
  percentage_total_cents BIGINT NOT NULL,
  minimum_fee_cents BIGINT NOT NULL,
  binding_term VARCHAR(24) NOT NULL
    CHECK (binding_term IN ('MINIMUM_FEE', 'PER_HEAD', 'PERCENTAGE_OF_GROSS')),
  gross_fee_cents BIGINT NOT NULL,
  in_copyright_numerator INT NOT NULL,
  in_copyright_denominator INT NOT NULL,
  fee_cents BIGINT NOT NULL,
  UNIQUE (return_id, society_id),
  CONSTRAINT accrual_share_is_a_fraction CHECK (
    in_copyright_denominator > 0
    AND in_copyright_numerator >= 0
    AND in_copyright_numerator <= in_copyright_denominator
  )
);

CREATE INDEX IF NOT EXISTS idx_accrual_lines_society
  ON royalty_accrual_lines (society_id);

-- 6. Corrections after the return has gone in.
CREATE TABLE IF NOT EXISTS licensing_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES licensing_returns(id) ON DELETE CASCADE,
  adjusted_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  previous_total_cents BIGINT NOT NULL,
  revised_total_cents BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT adjustment_delta_reconciles CHECK (
    delta_cents = revised_total_cents - previous_total_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_licensing_adjustments_return
  ON licensing_adjustments (return_id, adjusted_at);

CREATE TABLE IF NOT EXISTS licensing_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES licensing_adjustments(id) ON DELETE CASCADE,
  society_id UUID NOT NULL REFERENCES licensing_societies(id) ON DELETE RESTRICT,
  fee_cents BIGINT NOT NULL,
  UNIQUE (adjustment_id, society_id)
);

-- 7. Which societies accrue on a usage.
--
--    A live band plays no recording, so a live event accrues on the composition
--    and nothing on the recording. A DJ set plays recordings of compositions
--    and accrues on both. This asymmetry is the one an office reading "the
--    music licence" as a single number will never reproduce.
CREATE OR REPLACE FUNCTION licensing_accruing_rights(p_usage_kind TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_usage_kind
    WHEN 'RECORDED' THEN ARRAY[]::TEXT[]
    WHEN 'LIVE'     THEN ARRAY['COMPOSITION']
    WHEN 'DJ_SET'   THEN ARRAY['COMPOSITION', 'RECORDING']
    ELSE ARRAY[]::TEXT[]
  END;
$$;

-- 8. The band covering a capacity.
CREATE OR REPLACE FUNCTION licensing_band_for(
  p_society_id UUID,
  p_venue_capacity INT
)
RETURNS licence_tariff_bands
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_band licence_tariff_bands;
BEGIN
  SELECT * INTO v_band
  FROM licence_tariff_bands
  WHERE society_id = p_society_id AND capacity_up_to >= p_venue_capacity
  ORDER BY capacity_up_to
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tariff band for society % covering a capacity of %',
      p_society_id, p_venue_capacity;
  END IF;

  RETURN v_band;
END;
$$;

-- 9. The share of returned performances that are in copyright.
--
--    A member's own unpublished song counts as in copyright. The club owes the
--    royalty even though the writer is standing in the room — it flows back to
--    them through the society, and treating it as free is how the writer ends
--    up paying to be performed.
--
--    With no setlist yet the share is one. The figure is provisional anyway,
--    and assuming a set is out of copyright until proven otherwise would
--    understate every unreturned event.
CREATE OR REPLACE FUNCTION licensing_in_copyright_share(p_usage_id UUID)
RETURNS TABLE (numerator INT, denominator INT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total INT;
  v_in_copyright INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE work_status <> 'PUBLIC_DOMAIN')
  INTO v_total, v_in_copyright
  FROM setlist_entries WHERE usage_id = p_usage_id;

  IF v_total = 0 THEN
    numerator := 1;
    denominator := 1;
  ELSE
    numerator := v_in_copyright;
    denominator := v_total;
  END IF;

  RETURN NEXT;
END;
$$;

-- 10. Evaluate one society's tariff against one usage.
--
--     The greater of a per-head charge and a share of gross, with a floor. All
--     three terms come back alongside the answer: which one bound is the thing
--     a treasurer disputing an invoice actually wants to know, and it is not
--     recoverable from the total.
CREATE OR REPLACE FUNCTION licensing_evaluate_tariff(
  p_society_id UUID,
  p_usage_id UUID
)
RETURNS TABLE (
  society_id UUID,
  right_kind TEXT,
  band_capacity_up_to INT,
  per_head_cents BIGINT,
  per_head_total_cents BIGINT,
  percentage_total_cents BIGINT,
  minimum_fee_cents BIGINT,
  binding_term TEXT,
  gross_fee_cents BIGINT,
  in_copyright_numerator INT,
  in_copyright_denominator INT,
  fee_cents BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_usage event_music_usages;
  v_band licence_tariff_bands;
  v_right TEXT;
  v_share RECORD;
  v_greater BIGINT;
BEGIN
  SELECT * INTO v_usage FROM event_music_usages WHERE id = p_usage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No music usage recorded for %', p_usage_id;
  END IF;

  SELECT s.right_kind INTO v_right FROM licensing_societies s WHERE s.id = p_society_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown society %', p_society_id;
  END IF;

  v_band := licensing_band_for(p_society_id, v_usage.venue_capacity);
  SELECT * INTO v_share FROM licensing_in_copyright_share(p_usage_id);

  society_id := p_society_id;
  right_kind := v_right;
  band_capacity_up_to := v_band.capacity_up_to;

  -- Charging nothing selects the lower rate. It does not select nought.
  per_head_cents := CASE WHEN v_usage.admission_charged
                         THEN v_band.per_head_admission_cents
                         ELSE v_band.per_head_no_admission_cents END;

  per_head_total_cents := per_head_cents * v_usage.attendance;
  percentage_total_cents := ROUND(
    (v_usage.gross_receipts_cents * v_band.gross_receipts_basis_points)::NUMERIC / 10000
  );
  minimum_fee_cents := v_band.minimum_fee_cents;

  v_greater := GREATEST(per_head_total_cents, percentage_total_cents);
  gross_fee_cents := GREATEST(v_band.minimum_fee_cents, v_greater);

  binding_term := CASE
    WHEN v_band.minimum_fee_cents > v_greater THEN 'MINIMUM_FEE'
    WHEN per_head_total_cents >= percentage_total_cents THEN 'PER_HEAD'
    ELSE 'PERCENTAGE_OF_GROSS'
  END;

  -- A society administering compositions distributes by setlist, so a set half
  -- of which is out of copyright generates half the composition royalty. The
  -- recording right does not care: a recording of a public-domain work is still
  -- somebody's recording.
  IF v_right = 'COMPOSITION' THEN
    in_copyright_numerator := v_share.numerator;
    in_copyright_denominator := v_share.denominator;
    fee_cents := ROUND(
      (gross_fee_cents * v_share.numerator)::NUMERIC / v_share.denominator
    );
  ELSE
    in_copyright_numerator := 1;
    in_copyright_denominator := 1;
    fee_cents := gross_fee_cents;
  END IF;

  RETURN NEXT;
END;
$$;

-- 11. Every society that accrues on a usage, evaluated.
CREATE OR REPLACE FUNCTION licensing_evaluate_usage(p_usage_id UUID)
RETURNS TABLE (
  society_id UUID,
  right_kind TEXT,
  band_capacity_up_to INT,
  per_head_cents BIGINT,
  per_head_total_cents BIGINT,
  percentage_total_cents BIGINT,
  minimum_fee_cents BIGINT,
  binding_term TEXT,
  gross_fee_cents BIGINT,
  in_copyright_numerator INT,
  in_copyright_denominator INT,
  fee_cents BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT e.*
  FROM event_music_usages u
  JOIN licensing_societies s
    ON s.right_kind = ANY (licensing_accruing_rights(u.usage_kind))
  CROSS JOIN LATERAL licensing_evaluate_tariff(s.id, u.id) e
  WHERE u.id = p_usage_id
    AND EXISTS (SELECT 1 FROM licence_tariff_bands b WHERE b.society_id = s.id)
  ORDER BY s.code;
$$;

-- 12. Submit the return and freeze the accrual.
--
--     The entry-level constraints on setlist_entries have already refused an
--     untitled work, a zero duration and an in-copyright work with no writer,
--     so what is left to check here is that there is a setlist at all.
CREATE OR REPLACE FUNCTION submit_licensing_return(
  p_usage_id UUID,
  p_at TIMESTAMPTZ,
  p_by UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage event_music_usages;
  v_return_id UUID;
  v_total BIGINT;
BEGIN
  SELECT * INTO v_usage FROM event_music_usages WHERE id = p_usage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No music usage recorded for %', p_usage_id;
  END IF;

  IF v_usage.usage_kind = 'RECORDED' THEN RETURN 'REFUSED_NOT_REQUIRED'; END IF;

  PERFORM 1 FROM licensing_returns WHERE usage_id = p_usage_id;
  IF FOUND THEN RETURN 'REFUSED_ALREADY_SUBMITTED'; END IF;

  PERFORM 1 FROM setlist_entries WHERE usage_id = p_usage_id;
  IF NOT FOUND THEN RETURN 'REFUSED_NO_SETLIST'; END IF;

  SELECT COALESCE(SUM(fee_cents), 0) INTO v_total
  FROM licensing_evaluate_usage(p_usage_id);

  INSERT INTO licensing_returns (
    usage_id, submitted_at, submitted_by,
    attendance_at_submission, gross_receipts_at_submission_cents, total_cents
  )
  VALUES (
    p_usage_id, p_at, p_by,
    v_usage.attendance, v_usage.gross_receipts_cents, v_total
  )
  RETURNING id INTO v_return_id;

  INSERT INTO royalty_accrual_lines (
    return_id, society_id, band_capacity_up_to, per_head_cents,
    per_head_total_cents, percentage_total_cents, minimum_fee_cents,
    binding_term, gross_fee_cents, in_copyright_numerator,
    in_copyright_denominator, fee_cents
  )
  SELECT
    v_return_id, e.society_id, e.band_capacity_up_to, e.per_head_cents,
    e.per_head_total_cents, e.percentage_total_cents, e.minimum_fee_cents,
    e.binding_term, e.gross_fee_cents, e.in_copyright_numerator,
    e.in_copyright_denominator, e.fee_cents
  FROM licensing_evaluate_usage(p_usage_id) e;

  RETURN 'SUBMITTED';
END;
$$;

-- 13. A submitted return closes its setlist.
--
--     Entries arriving after submission would silently change the fee the
--     return was raised on, which is the one thing the freeze exists to stop.
CREATE OR REPLACE FUNCTION setlist_is_closed_once_returned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM licensing_returns WHERE usage_id = NEW.usage_id;
  IF FOUND THEN
    RAISE EXCEPTION 'The return for usage % has been submitted and cannot take new entries.',
      NEW.usage_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_setlist_closed ON setlist_entries;
CREATE TRIGGER trg_setlist_closed
BEFORE INSERT OR UPDATE ON setlist_entries
FOR EACH ROW EXECUTE FUNCTION setlist_is_closed_once_returned();

-- 14. Correct the figures.
--
--     Before the return goes in this is simply the truth arriving late. After
--     it, the submitted return stands and the difference becomes an adjustment.
CREATE OR REPLACE FUNCTION correct_music_usage_figures(
  p_usage_id UUID,
  p_attendance INT,
  p_gross_receipts_cents BIGINT,
  p_at TIMESTAMPTZ,
  p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage event_music_usages;
  v_return licensing_returns;
  v_previous BIGINT;
  v_revised BIGINT;
  v_adjustment_id UUID;
BEGIN
  SELECT * INTO v_usage FROM event_music_usages WHERE id = p_usage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No music usage recorded for %', p_usage_id;
  END IF;

  IF p_attendance = v_usage.attendance
     AND p_gross_receipts_cents = v_usage.gross_receipts_cents THEN
    RETURN 'REFUSED_NO_CHANGE';
  END IF;

  SELECT * INTO v_return FROM licensing_returns WHERE usage_id = p_usage_id;

  IF NOT FOUND THEN
    UPDATE event_music_usages
    SET attendance = p_attendance, gross_receipts_cents = p_gross_receipts_cents
    WHERE id = p_usage_id;
    RETURN 'APPLIED_BEFORE_RETURN';
  END IF;

  SELECT v_return.total_cents + COALESCE(SUM(delta_cents), 0) INTO v_previous
  FROM licensing_adjustments WHERE return_id = v_return.id;

  UPDATE event_music_usages
  SET attendance = p_attendance, gross_receipts_cents = p_gross_receipts_cents
  WHERE id = p_usage_id;

  SELECT COALESCE(SUM(fee_cents), 0) INTO v_revised
  FROM licensing_evaluate_usage(p_usage_id);

  INSERT INTO licensing_adjustments (
    return_id, adjusted_at, reason,
    previous_total_cents, revised_total_cents, delta_cents
  )
  VALUES (v_return.id, p_at, p_reason, v_previous, v_revised, v_revised - v_previous)
  RETURNING id INTO v_adjustment_id;

  -- The revised position per society, so nothing has to be apportioned back
  -- out of a rounded total. They reconcile separately.
  INSERT INTO licensing_adjustment_lines (adjustment_id, society_id, fee_cents)
  SELECT v_adjustment_id, e.society_id, e.fee_cents
  FROM licensing_evaluate_usage(p_usage_id) e;

  RETURN 'ADJUSTED';
END;
$$;

-- 15. Where an event stands.
--
--     An unreturned event must never read as nought: it and a genuinely free
--     event look identical in a total and are not the same thing.
CREATE OR REPLACE FUNCTION assess_music_licensing(p_usage_id UUID)
RETURNS TABLE (
  usage_id UUID,
  usage_kind TEXT,
  status TEXT,
  total_cents BIGINT,
  net_payable_cents BIGINT,
  performance_count INT,
  distinct_work_count INT,
  return_submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_usage event_music_usages;
  v_return licensing_returns;
  v_deltas BIGINT;
BEGIN
  SELECT * INTO v_usage FROM event_music_usages WHERE id = p_usage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No music usage recorded for %', p_usage_id;
  END IF;

  usage_id := p_usage_id;
  usage_kind := v_usage.usage_kind;

  SELECT COUNT(*)::INT, COUNT(DISTINCT work_ref)::INT
  INTO performance_count, distinct_work_count
  FROM setlist_entries WHERE setlist_entries.usage_id = p_usage_id;

  IF v_usage.usage_kind = 'RECORDED' THEN
    status := 'COVERED_BY_BLANKET';
    total_cents := 0;
    net_payable_cents := 0;
    return_submitted_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_return FROM licensing_returns WHERE licensing_returns.usage_id = p_usage_id;

  IF NOT FOUND THEN
    status := 'PENDING_RETURN';
    SELECT COALESCE(SUM(fee_cents), 0) INTO total_cents
    FROM licensing_evaluate_usage(p_usage_id);
    net_payable_cents := total_cents;
    return_submitted_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(delta_cents), 0) INTO v_deltas
  FROM licensing_adjustments WHERE return_id = v_return.id;

  status := CASE WHEN v_deltas <> 0 OR EXISTS (
                   SELECT 1 FROM licensing_adjustments WHERE return_id = v_return.id
                 ) THEN 'ADJUSTED' ELSE 'ACCRUED' END;
  total_cents := v_return.total_cents;
  net_payable_cents := v_return.total_cents + v_deltas;
  return_submitted_at := v_return.submitted_at;
  RETURN NEXT;
END;
$$;

-- 16. Events that owe a return, worst first. These are the ones otherwise
--     reconstructed from memory in the summer.
CREATE OR REPLACE FUNCTION unreturned_music_events(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
  usage_id UUID,
  event_id UUID,
  club_id UUID,
  occurred_at TIMESTAMPTZ,
  total_cents BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.id, u.event_id, u.club_id, u.occurred_at, a.total_cents
  FROM event_music_usages u
  CROSS JOIN LATERAL assess_music_licensing(u.id) a
  WHERE a.status = 'PENDING_RETURN'
    AND u.occurred_at BETWEEN p_from AND p_to
  ORDER BY a.total_cents DESC, u.occurred_at;
$$;

-- 17. What one society is owed over a period.
--
--     Per society rather than combined, because they invoice separately and
--     reconcile separately, and a combined figure cannot be checked against
--     either statement.
CREATE OR REPLACE FUNCTION society_licensing_liability(
  p_society_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  society_id UUID,
  accrued_cents BIGINT,
  pending_return_cents BIGINT,
  event_count INT
)
LANGUAGE sql
STABLE
AS $$
  WITH per_event AS (
    SELECT
      u.id AS usage_id,
      a.status,
      COALESCE(
        -- The latest adjustment supersedes the return for what is currently owed.
        (
          SELECT al.fee_cents
          FROM licensing_adjustments adj
          JOIN licensing_adjustment_lines al ON al.adjustment_id = adj.id
          JOIN licensing_returns r ON r.id = adj.return_id
          WHERE r.usage_id = u.id AND al.society_id = p_society_id
          ORDER BY adj.adjusted_at DESC, adj.created_at DESC
          LIMIT 1
        ),
        (
          SELECT rl.fee_cents
          FROM licensing_returns r
          JOIN royalty_accrual_lines rl ON rl.return_id = r.id
          WHERE r.usage_id = u.id AND rl.society_id = p_society_id
        ),
        (
          SELECT e.fee_cents
          FROM licensing_evaluate_usage(u.id) e
          WHERE e.society_id = p_society_id
        )
      ) AS fee_cents
    FROM event_music_usages u
    CROSS JOIN LATERAL assess_music_licensing(u.id) a
    WHERE u.occurred_at BETWEEN p_from AND p_to
  )
  SELECT
    p_society_id,
    COALESCE(SUM(fee_cents) FILTER (WHERE status <> 'PENDING_RETURN'), 0),
    COALESCE(SUM(fee_cents) FILTER (WHERE status = 'PENDING_RETURN'), 0),
    COUNT(*)::INT
  FROM per_event
  WHERE fee_cents IS NOT NULL;
$$;

-- 18. Row level security.
--
--     Tariffs and society details are reference data every treasurer needs in
--     order to plan; the accruals are club money and stay with the club.
ALTER TABLE licensing_societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE licence_tariff_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_music_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE licensing_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_accrual_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE licensing_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE licensing_adjustment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS societies_authenticated_read ON licensing_societies;
CREATE POLICY societies_authenticated_read ON licensing_societies
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS tariff_bands_authenticated_read ON licence_tariff_bands;
CREATE POLICY tariff_bands_authenticated_read ON licence_tariff_bands
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS music_usages_club_member_read ON event_music_usages;
CREATE POLICY music_usages_club_member_read ON event_music_usages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = event_music_usages.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS setlist_entries_club_member_read ON setlist_entries;
CREATE POLICY setlist_entries_club_member_read ON setlist_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM event_music_usages u
      JOIN club_members m ON m.club_id = u.club_id
      WHERE u.id = setlist_entries.usage_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS licensing_returns_club_member_read ON licensing_returns;
CREATE POLICY licensing_returns_club_member_read ON licensing_returns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM event_music_usages u
      JOIN club_members m ON m.club_id = u.club_id
      WHERE u.id = licensing_returns.usage_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS accrual_lines_club_member_read ON royalty_accrual_lines;
CREATE POLICY accrual_lines_club_member_read ON royalty_accrual_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licensing_returns r
      JOIN event_music_usages u ON u.id = r.usage_id
      JOIN club_members m ON m.club_id = u.club_id
      WHERE r.id = royalty_accrual_lines.return_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS adjustments_club_member_read ON licensing_adjustments;
CREATE POLICY adjustments_club_member_read ON licensing_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licensing_returns r
      JOIN event_music_usages u ON u.id = r.usage_id
      JOIN club_members m ON m.club_id = u.club_id
      WHERE r.id = licensing_adjustments.return_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS adjustment_lines_club_member_read ON licensing_adjustment_lines;
CREATE POLICY adjustment_lines_club_member_read ON licensing_adjustment_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM licensing_adjustments a
      JOIN licensing_returns r ON r.id = a.return_id
      JOIN event_music_usages u ON u.id = r.usage_id
      JOIN club_members m ON m.club_id = u.club_id
      WHERE a.id = licensing_adjustment_lines.adjustment_id AND m.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION licensing_accruing_rights(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION licensing_band_for(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION licensing_in_copyright_share(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION licensing_evaluate_tariff(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION licensing_evaluate_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_music_licensing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unreturned_music_events(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION society_licensing_liability(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION submit_licensing_return(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION correct_music_usage_figures(UUID, INT, BIGINT, TIMESTAMPTZ, TEXT)
  TO service_role;

COMMENT ON FUNCTION licensing_accruing_rights(TEXT) IS
  'A live band plays no recording, so a live event accrues on the composition alone. A DJ set accrues on both rights.';
COMMENT ON FUNCTION licensing_evaluate_tariff(UUID, UUID) IS
  'Greater of per-head and a share of gross, floored at the minimum. All three terms are returned because which one bound is not recoverable from the total.';
COMMENT ON CONSTRAINT band_free_event_is_charged ON licence_tariff_bands IS
  'Charging no admission selects the lower rate, not nought. A free event is inside the tariff.';
COMMENT ON TABLE licensing_returns IS
  'Frozen at the figures that applied when it went in. A later correction produces an adjustment, never a rewrite: this is the document the invoice was raised against.';
