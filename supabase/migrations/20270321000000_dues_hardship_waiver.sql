-- Migration: 20270321000000_dues_hardship_waiver.sql
-- Description: Schema and functions for the Club Dues Hardship Waiver &
--              Sliding-Scale Assessment (#4388).
--
-- The treasurer reviewing these requests is an undergraduate peer who will sit
-- next to the applicant next week. The schema therefore splits a request in two:
-- `dues_hardship_cases` holds what the reviewer may see, and
-- `dues_hardship_identities` holds who submitted it and their banded answers.
-- The reviewer's read policy grants SELECT on the first and nothing on the
-- second, so the separation is enforced by the database rather than by
-- remembering to omit a column in every query someone writes later.
--
-- No income figure is ever accepted, stored or transmitted. Only bands.

-- 1. The reviewable half. Carries no applicant reference by design.
CREATE TABLE IF NOT EXISTS dues_hardship_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference VARCHAR(32) UNIQUE NOT NULL,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  dues_cycle_id UUID NOT NULL,
  tier VARCHAR(2) NOT NULL CHECK (tier IN ('T0', 'T1', 'T2', 'T3', 'T4')),
  waiver_basis_points INTEGER NOT NULL
    CHECK (waiver_basis_points >= 0 AND waiver_basis_points <= 9000),
  full_dues_minor BIGINT NOT NULL CHECK (full_dues_minor >= 0),
  assessed_amount_minor BIGINT NOT NULL CHECK (assessed_amount_minor >= 0),
  waived_amount_minor BIGINT NOT NULL CHECK (waived_amount_minor >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  -- A waiver never turns dues into a payout, and the two halves must reconcile.
  CONSTRAINT hardship_amounts_reconcile
    CHECK (assessed_amount_minor + waived_amount_minor = full_dues_minor),
  CONSTRAINT hardship_resolved_carries_a_timestamp
    CHECK (status = 'PENDING' OR decided_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hardship_cases_queue
  ON dues_hardship_cases (club_id, dues_cycle_id, waiver_basis_points DESC, submitted_at ASC)
  WHERE status = 'PENDING';

-- 2. The identity half. A treasurer has no policy granting them this table.
CREATE TABLE IF NOT EXISTS dues_hardship_identities (
  case_reference VARCHAR(32) PRIMARY KEY
    REFERENCES dues_hardship_cases(case_reference) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aid_band VARCHAR(16) NOT NULL CHECK (aid_band IN ('NONE', 'PARTIAL', 'FULL')),
  dependant_band VARCHAR(16) NOT NULL
    CHECK (dependant_band IN ('NONE', 'ONE_TO_TWO', 'THREE_PLUS')),
  exceptional_circumstance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hardship_identities_applicant
  ON dues_hardship_identities (applicant_user_id);

-- 3. Immutable decision trail. Insert-only; there is no update path.
CREATE TABLE IF NOT EXISTS dues_hardship_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference VARCHAR(32) NOT NULL UNIQUE
    REFERENCES dues_hardship_cases(case_reference) ON DELETE CASCADE,
  outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('APPROVED', 'DECLINED')),
  -- Mandatory on both outcomes: a decline with no stated reason is unappealable.
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 8),
  decided_by UUID NOT NULL REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_hardship_decision_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hardship decisions are immutable once recorded.';
END;
$$;

DROP TRIGGER IF EXISTS trg_hardship_decisions_immutable ON dues_hardship_decisions;
CREATE TRIGGER trg_hardship_decisions_immutable
  BEFORE UPDATE OR DELETE ON dues_hardship_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_hardship_decision_mutation();

-- 4. The published scale.
--
--    Deterministic on purpose. Two students with identical bands always receive
--    an identical assessment, which is what makes a decline defensible and
--    leaves no room for a treasurer to favour a friend.
CREATE OR REPLACE FUNCTION assess_hardship_basis_points(
  p_aid_band VARCHAR(16),
  p_dependant_band VARCHAR(16),
  p_exceptional_circumstance BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_points INTEGER := 0;
BEGIN
  v_points := v_points + CASE p_aid_band
    WHEN 'NONE' THEN 0
    WHEN 'PARTIAL' THEN 3000
    WHEN 'FULL' THEN 5500
    ELSE NULL
  END;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Unknown aid band %', p_aid_band;
  END IF;

  v_points := v_points + CASE p_dependant_band
    WHEN 'NONE' THEN 0
    WHEN 'ONE_TO_TWO' THEN 1500
    WHEN 'THREE_PLUS' THEN 2500
    ELSE NULL
  END;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Unknown dependant band %', p_dependant_band;
  END IF;

  IF p_exceptional_circumstance THEN
    v_points := v_points + 1000;
  END IF;

  -- Capped short of the full amount: every member contributes something.
  RETURN LEAST(v_points, 9000);
END;
$$;

CREATE OR REPLACE FUNCTION hardship_tier_for(p_basis_points INTEGER)
RETURNS VARCHAR(2)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_basis_points >= 7500 THEN 'T4'
    WHEN p_basis_points >= 5500 THEN 'T3'
    WHEN p_basis_points >= 3000 THEN 'T2'
    WHEN p_basis_points >= 1000 THEN 'T1'
    ELSE 'T0'
  END;
$$;

-- 5. Submit a request. Writes both halves in one transaction and returns only
--    the opaque case reference to the caller.
CREATE OR REPLACE FUNCTION submit_dues_hardship_request(
  p_club_id UUID,
  p_dues_cycle_id UUID,
  p_aid_band VARCHAR(16),
  p_dependant_band VARCHAR(16),
  p_exceptional_circumstance BOOLEAN,
  p_full_dues_minor BIGINT,
  p_minimum_contribution_minor BIGINT
)
RETURNS VARCHAR(32)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant UUID := auth.uid();
  v_points INTEGER;
  v_assessed BIGINT;
  v_sequence INTEGER;
  v_reference VARCHAR(32);
BEGIN
  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'A hardship request requires an authenticated applicant.';
  END IF;
  IF p_minimum_contribution_minor > p_full_dues_minor THEN
    RAISE EXCEPTION 'The minimum contribution cannot exceed the full dues amount.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM dues_hardship_cases c
    JOIN dues_hardship_identities i ON i.case_reference = c.case_reference
    WHERE i.applicant_user_id = v_applicant
      AND c.club_id = p_club_id
      AND c.dues_cycle_id = p_dues_cycle_id
      AND c.status = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'An open hardship request already exists for this applicant and dues cycle.';
  END IF;

  v_points := assess_hardship_basis_points(
    p_aid_band, p_dependant_band, p_exceptional_circumstance
  );

  -- Integer arithmetic end to end, rounding the assessment up so any rounding
  -- error favours the club's balance rather than silently widening the waiver.
  v_assessed := GREATEST(
    CEIL((p_full_dues_minor * (10000 - v_points))::NUMERIC / 10000)::BIGINT,
    p_minimum_contribution_minor
  );

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_sequence
  FROM dues_hardship_cases WHERE club_id = p_club_id;

  -- Sequential per club. A reference derived from the user id would leak the
  -- very identity the reference exists to hide.
  v_reference := 'HW-' ||
    UPPER(COALESCE(NULLIF(RIGHT(REGEXP_REPLACE(p_club_id::TEXT, '[^a-zA-Z0-9]', '', 'g'), 4), ''), 'CLUB')) ||
    '-' || LPAD(v_sequence::TEXT, 4, '0');

  INSERT INTO dues_hardship_cases (
    case_reference, club_id, dues_cycle_id, tier, waiver_basis_points,
    full_dues_minor, assessed_amount_minor, waived_amount_minor, status
  )
  VALUES (
    v_reference, p_club_id, p_dues_cycle_id, hardship_tier_for(v_points), v_points,
    p_full_dues_minor, v_assessed, p_full_dues_minor - v_assessed, 'PENDING'
  );

  INSERT INTO dues_hardship_identities (
    case_reference, applicant_user_id, aid_band, dependant_band, exceptional_circumstance
  )
  VALUES (
    v_reference, v_applicant, p_aid_band, p_dependant_band, p_exceptional_circumstance
  );

  RETURN v_reference;
END;
$$;

-- 6. Record a decision. A case resolves exactly once.
CREATE OR REPLACE FUNCTION decide_dues_hardship_case(
  p_case_reference VARCHAR(32),
  p_outcome VARCHAR(16),
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_status VARCHAR(16);
BEGIN
  SELECT status INTO v_status
  FROM dues_hardship_cases
  WHERE case_reference = p_case_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown hardship case %', p_case_reference;
  END IF;
  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Case % was already resolved as % and cannot be re-decided.',
      p_case_reference, v_status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM dues_hardship_identities
    WHERE case_reference = p_case_reference AND applicant_user_id = v_reviewer
  ) THEN
    RAISE EXCEPTION 'A reviewer cannot decide their own hardship request.';
  END IF;

  INSERT INTO dues_hardship_decisions (case_reference, outcome, reason, decided_by)
  VALUES (p_case_reference, p_outcome, p_reason, v_reviewer);

  UPDATE dues_hardship_cases
  SET status = p_outcome, decided_at = NOW()
  WHERE case_reference = p_case_reference;

  RETURN TRUE;
END;
$$;

-- 7. Budget planning figures. Counts and totals per tier only; a per-applicant
--    breakdown would re-identify people in a small club, which is exactly what
--    the case reference exists to prevent.
CREATE OR REPLACE FUNCTION get_redacted_hardship_summary(
  p_club_id UUID,
  p_dues_cycle_id UUID
)
RETURNS TABLE (
  tier VARCHAR(2),
  case_count BIGINT,
  approved_count BIGINT,
  total_waived_minor BIGINT,
  total_assessed_minor BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.tier,
    COUNT(c.case_reference) AS case_count,
    COUNT(c.case_reference) FILTER (WHERE c.status = 'APPROVED') AS approved_count,
    COALESCE(SUM(c.waived_amount_minor) FILTER (WHERE c.status = 'APPROVED'), 0)::BIGINT,
    COALESCE(SUM(c.assessed_amount_minor) FILTER (WHERE c.status = 'APPROVED'), 0)::BIGINT
  FROM (VALUES ('T0'), ('T1'), ('T2'), ('T3'), ('T4')) AS t(tier)
  LEFT JOIN dues_hardship_cases c
    ON c.tier = t.tier
   AND c.club_id = p_club_id
   AND c.dues_cycle_id = p_dues_cycle_id
  GROUP BY t.tier
  ORDER BY t.tier;
$$;

-- 8. Row level security. This is where the privacy guarantee actually lives.
ALTER TABLE dues_hardship_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues_hardship_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues_hardship_decisions ENABLE ROW LEVEL SECURITY;

-- Club officers read the reviewable half only.
DROP POLICY IF EXISTS hardship_cases_officer_read ON dues_hardship_cases;
CREATE POLICY hardship_cases_officer_read ON dues_hardship_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members m
      WHERE m.club_id = dues_hardship_cases.club_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'treasurer')
    )
  );

-- An applicant reads their own case, whatever their club role.
DROP POLICY IF EXISTS hardship_cases_applicant_read ON dues_hardship_cases;
CREATE POLICY hardship_cases_applicant_read ON dues_hardship_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dues_hardship_identities i
      WHERE i.case_reference = dues_hardship_cases.case_reference
        AND i.applicant_user_id = auth.uid()
    )
  );

-- The identity half has exactly one reader: the applicant themselves. There is
-- deliberately no officer policy here.
DROP POLICY IF EXISTS hardship_identities_self_read ON dues_hardship_identities;
CREATE POLICY hardship_identities_self_read ON dues_hardship_identities
  FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS hardship_decisions_read ON dues_hardship_decisions;
CREATE POLICY hardship_decisions_read ON dues_hardship_decisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dues_hardship_cases c
      WHERE c.case_reference = dues_hardship_decisions.case_reference
        AND EXISTS (
          SELECT 1 FROM club_members m
          WHERE m.club_id = c.club_id
            AND m.user_id = auth.uid()
            AND m.role IN ('owner', 'admin', 'treasurer')
        )
    )
  );

GRANT EXECUTE ON FUNCTION assess_hardship_basis_points(VARCHAR, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION hardship_tier_for(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_dues_hardship_request(UUID, UUID, VARCHAR, VARCHAR, BOOLEAN, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION decide_dues_hardship_case(VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_redacted_hardship_summary(UUID, UUID) TO authenticated;

COMMENT ON TABLE dues_hardship_identities IS
  'Identity half of a hardship request. No club-officer read policy exists here by design; officers review the pseudonymous case record instead.';
