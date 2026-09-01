-- Migration: 20270829000000_locker_abandonment_disposal.sql
-- Description: Schema and functions for the Locker Abandonment & Contents
--              Disposal Notice Chain (#4556).
--
-- Term ends and nobody empties them. Facilities eventually runs a sweep, cuts
-- the locks, and bins whatever is inside. Once or twice a year that turns out
-- to have been somebody's laptop, and the university has no answer, because
-- there is no record that notice was ever given, when it was given, or whether
-- it reached anyone.
--
-- Three rules carry the whole file:
--
--   The hold period runs from delivery, never from the end of term.
--   Dispatch is not delivery; a bounce starts nothing.
--   Where the chain cannot be completed the outcome is manual review, never
--   disposal. Nothing here falls through to "dispose" by default.

-- 1. The units themselves.
CREATE TABLE IF NOT EXISTS storage_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL,
  unit_type VARCHAR(16) NOT NULL CHECK (unit_type IN ('LOCKER', 'STORAGE_CAGE')),
  label VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, label)
);

-- 2. A term's rental of one unit.
CREATE TABLE IF NOT EXISTS storage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES storage_units(id) ON DELETE CASCADE,
  holder_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  declared_high_value BOOLEAN NOT NULL DEFAULT FALSE,
  -- Set when a reviewer releases a unit that the automatic path refused to.
  manual_review_approved_at TIMESTAMPTZ,
  manual_review_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT storage_assignment_term_is_positive CHECK (ends_at > starts_at),
  CONSTRAINT storage_review_approval_is_complete CHECK (
    (manual_review_approved_at IS NULL) = (manual_review_approved_by IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_storage_assignments_unit
  ON storage_assignments (unit_id, ends_at DESC);

-- 3. Notices. Dispatch and delivery are separate columns because they are
--    separate facts, and the second is the one the law cares about.
--
--    voided_at is set by a renewal. The notices are voided rather than deleted:
--    they were sent, and that remains true. What they cannot do is carry a
--    half-elapsed hold period into a later cycle.
CREATE TABLE IF NOT EXISTS storage_abandonment_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES storage_assignments(id) ON DELETE CASCADE,
  channel VARCHAR(8) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'POSTAL')),
  dispatched_at TIMESTAMPTZ NOT NULL,
  state VARCHAR(12) NOT NULL DEFAULT 'DISPATCHED'
    CHECK (state IN ('DISPATCHED', 'DELIVERED', 'FAILED')),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One attempt per channel per chain; a renewal voids the chain and frees the
  -- channel for the next one.
  CONSTRAINT storage_notice_state_is_consistent CHECK (
    (state = 'DELIVERED') = (delivered_at IS NOT NULL)
    AND (state = 'FAILED') = (failed_at IS NOT NULL)
  ),
  CONSTRAINT storage_notice_delivery_follows_dispatch CHECK (
    delivered_at IS NULL OR delivered_at >= dispatched_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_notice_one_per_channel
  ON storage_abandonment_notices (assignment_id, channel)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_notices_assignment
  ON storage_abandonment_notices (assignment_id, dispatched_at);

-- 4. What was found in the unit. Contents found here can raise an assignment to
--    high value even where nothing was declared: the renter who never filled in
--    the form is exactly the renter whose laptop is in there.
CREATE TABLE IF NOT EXISTS storage_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES storage_assignments(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL,
  taken_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  contents_summary TEXT NOT NULL,
  high_value_found BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_storage_inventories_assignment
  ON storage_inventories (assignment_id, taken_at);

-- 5. Disposals. notice_delivered_at is NOT NULL by constraint, which is the
--    schema-level statement of the rule: nothing is disposed of without a
--    delivery behind it.
CREATE TABLE IF NOT EXISTS storage_disposal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES storage_assignments(id) ON DELETE CASCADE,
  disposed_at TIMESTAMPTZ NOT NULL,
  disposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  method VARCHAR(120) NOT NULL,
  notice_delivered_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT storage_disposal_follows_delivery CHECK (disposed_at > notice_delivered_at)
);

-- 6. Whether the contents count as high value at a given instant: declared at
--    assignment, or found at an inventory taken on or before that instant.
CREATE OR REPLACE FUNCTION storage_is_high_value(
  p_assignment_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE((SELECT declared_high_value FROM storage_assignments WHERE id = p_assignment_id), FALSE)
    OR EXISTS (
      SELECT 1 FROM storage_inventories
      WHERE assignment_id = p_assignment_id
        AND high_value_found
        AND taken_at <= p_as_of
    );
$$;

-- 7. The assessment.
--
--    Pure over the supplied instant, which is what makes "was this unit
--    lawfully disposable on the 14th?" answerable after the fact — the question
--    somebody asks precisely when the answer has become expensive.
CREATE OR REPLACE FUNCTION assess_storage_assignment(
  p_assignment_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  state TEXT,
  reason TEXT,
  grace_ends_at TIMESTAMPTZ,
  hold_started_at TIMESTAMPTZ,
  hold_ends_at TIMESTAMPTZ,
  hold_days INTEGER,
  high_value BOOLEAN,
  channels_exhausted BOOLEAN,
  requires_manual_review BOOLEAN,
  manual_review_approved BOOLEAN,
  disposable BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_asg RECORD;
  v_grace TIMESTAMPTZ;
  v_first_delivery TIMESTAMPTZ;
  v_live_notices INTEGER;
  v_failed_notices INTEGER;
  v_disposed TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_asg FROM storage_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown storage assignment %', p_assignment_id;
  END IF;

  high_value := storage_is_high_value(p_assignment_id, p_assessed_at);
  hold_days := CASE WHEN high_value THEN 60 ELSE 30 END;
  v_grace := v_asg.ends_at + INTERVAL '14 days';
  grace_ends_at := v_grace;
  manual_review_approved := v_asg.manual_review_approved_at IS NOT NULL
    AND v_asg.manual_review_approved_at <= p_assessed_at;
  channels_exhausted := FALSE;
  requires_manual_review := FALSE;
  disposable := FALSE;
  hold_started_at := NULL;
  hold_ends_at := NULL;

  SELECT disposed_at INTO v_disposed
  FROM storage_disposal_records WHERE assignment_id = p_assignment_id;

  IF v_disposed IS NOT NULL AND v_disposed <= p_assessed_at THEN
    state := 'DISPOSED';
    reason := 'DISPOSED';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_assessed_at < v_asg.ends_at THEN
    state := 'ACTIVE'; reason := 'ACTIVE'; RETURN NEXT; RETURN;
  END IF;
  IF p_assessed_at < v_grace THEN
    state := 'IN_GRACE'; reason := 'IN_GRACE'; RETURN NEXT; RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE voided_at IS NULL),
    COUNT(*) FILTER (WHERE voided_at IS NULL AND state = 'FAILED')
  INTO v_live_notices, v_failed_notices
  FROM storage_abandonment_notices
  WHERE assignment_id = p_assignment_id AND dispatched_at <= p_assessed_at;

  IF v_live_notices = 0 THEN
    state := 'ABANDONED'; reason := 'ABANDONED_NO_NOTICE'; RETURN NEXT; RETURN;
  END IF;

  -- The hold runs from the FIRST confirmed delivery. Not the last notice, not
  -- the end of term, and not the dispatch.
  SELECT MIN(delivered_at) INTO v_first_delivery
  FROM storage_abandonment_notices
  WHERE assignment_id = p_assignment_id
    AND voided_at IS NULL
    AND state = 'DELIVERED'
    AND delivered_at <= p_assessed_at;

  IF v_first_delivery IS NULL THEN
    IF v_live_notices >= 3 AND v_failed_notices = v_live_notices THEN
      -- Every channel tried and none reached them. This is the case the whole
      -- feature exists for, and the answer is a human, not a skip.
      state := 'MANUAL_REVIEW';
      reason := 'MANUAL_REVIEW_CHANNELS_EXHAUSTED';
      channels_exhausted := TRUE;
      requires_manual_review := TRUE;
      disposable := manual_review_approved;
      RETURN NEXT; RETURN;
    END IF;
    state := 'NOTICED';
    reason := 'NOTICE_DISPATCHED_NOT_DELIVERED';
    RETURN NEXT; RETURN;
  END IF;

  hold_started_at := v_first_delivery;
  hold_ends_at := v_first_delivery + (hold_days * INTERVAL '1 day');

  IF p_assessed_at < hold_ends_at THEN
    state := 'ON_HOLD';
    reason := 'HOLD_IN_PROGRESS';
    requires_manual_review := high_value;
    RETURN NEXT; RETURN;
  END IF;

  IF high_value AND NOT manual_review_approved THEN
    -- High value gets the longer hold AND a human, not one or the other.
    state := 'MANUAL_REVIEW';
    reason := 'MANUAL_REVIEW_HIGH_VALUE';
    requires_manual_review := TRUE;
    RETURN NEXT; RETURN;
  END IF;

  state := 'DISPOSABLE';
  reason := 'DISPOSABLE';
  requires_manual_review := high_value;
  disposable := TRUE;
  RETURN NEXT;
END;
$$;

-- 8. Dispatch a notice on one channel.
--
--    Channels are used in order and only one at a time. The next opens when the
--    previous has failed, which is what makes escalation escalation rather than
--    a mailshot: a renter who reads their email is not also posted a letter,
--    and a channel still awaiting a receipt is not yet evidence of anything.
CREATE OR REPLACE FUNCTION dispatch_abandonment_notice(
  p_assignment_id UUID,
  p_channel VARCHAR,
  p_at TIMESTAMPTZ
)
RETURNS TABLE (outcome TEXT, notice_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_open INTEGER;
  v_used INTEGER;
  v_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM storage_disposal_records WHERE assignment_id = p_assignment_id) THEN
    RETURN QUERY SELECT 'REFUSED_ALREADY_DISPOSED'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v FROM assess_storage_assignment(p_assignment_id, p_at);
  IF v.state IN ('ACTIVE', 'IN_GRACE') THEN
    RETURN QUERY SELECT 'REFUSED_NOT_ABANDONED'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM storage_abandonment_notices
  WHERE assignment_id = p_assignment_id AND voided_at IS NULL AND channel = p_channel;

  IF v_used > 0 THEN
    RETURN QUERY SELECT 'REFUSED_CHANNEL_ALREADY_USED'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_open
  FROM storage_abandonment_notices
  WHERE assignment_id = p_assignment_id AND voided_at IS NULL AND state <> 'FAILED';

  IF v_open > 0 THEN
    RETURN QUERY SELECT 'REFUSED_PREVIOUS_CHANNEL_STILL_OPEN'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO storage_abandonment_notices (assignment_id, channel, dispatched_at)
  VALUES (p_assignment_id, p_channel, p_at)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT 'DISPATCHED'::TEXT, v_id;
END;
$$;

-- 9. Renewal cancels the chain.
--
--    Somebody who renews in March and abandons the unit again in June is
--    entitled to a fresh notice, not to the remaining eleven days of a
--    countdown they already stopped once.
CREATE OR REPLACE FUNCTION renew_storage_assignment(
  p_assignment_id UUID,
  p_at TIMESTAMPTZ,
  p_new_ends_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asg RECORD;
BEGIN
  SELECT * INTO v_asg FROM storage_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown storage assignment %', p_assignment_id;
  END IF;
  IF EXISTS (SELECT 1 FROM storage_disposal_records WHERE assignment_id = p_assignment_id) THEN
    RAISE EXCEPTION 'Assignment % was disposed of and cannot be renewed.', p_assignment_id;
  END IF;
  IF p_new_ends_at <= v_asg.ends_at THEN
    RAISE EXCEPTION 'A renewal must extend the term beyond %.', v_asg.ends_at;
  END IF;

  UPDATE storage_abandonment_notices
  SET voided_at = p_at
  WHERE assignment_id = p_assignment_id AND voided_at IS NULL;

  UPDATE storage_assignments
  SET ends_at = p_new_ends_at,
      manual_review_approved_at = NULL,
      manual_review_approved_by = NULL
  WHERE id = p_assignment_id;
END;
$$;

-- 10. Disposal, which defers entirely to the assessment.
--
--     There is deliberately no override parameter. An override is how the
--     requirement that notice be delivered becomes a checkbox somebody ticks at
--     the end of a long sweep.
CREATE OR REPLACE FUNCTION dispose_storage_contents(
  p_assignment_id UUID,
  p_at TIMESTAMPTZ,
  p_disposed_by UUID,
  p_method VARCHAR
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM storage_disposal_records WHERE assignment_id = p_assignment_id) THEN
    RETURN 'REFUSED_ALREADY_DISPOSED';
  END IF;

  SELECT * INTO v FROM assess_storage_assignment(p_assignment_id, p_at);

  IF NOT v.disposable OR v.hold_started_at IS NULL THEN
    RETURN 'REFUSED_NOT_DISPOSABLE';
  END IF;

  INSERT INTO storage_disposal_records (
    assignment_id, disposed_at, disposed_by, method, notice_delivered_at
  )
  VALUES (p_assignment_id, p_at, p_disposed_by, p_method, v.hold_started_at);

  RETURN 'DISPOSED';
END;
$$;

-- 11. The sweep list for one building, most advanced first.
CREATE OR REPLACE FUNCTION sweep_building_storage(
  p_building_id UUID,
  p_assessed_at TIMESTAMPTZ
)
RETURNS TABLE (
  assignment_id UUID,
  unit_label VARCHAR,
  state TEXT,
  reason TEXT,
  hold_ends_at TIMESTAMPTZ,
  disposable BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id,
    u.label,
    s.state,
    s.reason,
    s.hold_ends_at,
    s.disposable
  FROM storage_assignments a
  JOIN storage_units u ON u.id = a.unit_id
  CROSS JOIN LATERAL assess_storage_assignment(a.id, p_assessed_at) s
  WHERE u.building_id = p_building_id
  ORDER BY
    CASE s.state
      WHEN 'DISPOSABLE' THEN 0
      WHEN 'MANUAL_REVIEW' THEN 1
      WHEN 'ON_HOLD' THEN 2
      WHEN 'NOTICED' THEN 3
      WHEN 'ABANDONED' THEN 4
      WHEN 'IN_GRACE' THEN 5
      WHEN 'ACTIVE' THEN 6
      ELSE 7
    END,
    u.label;
$$;

-- 12. Row level security. A renter sees their own assignment and the notices
--     sent to them — which is the point of a notice.
ALTER TABLE storage_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_abandonment_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_disposal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_units_authenticated_read ON storage_units;
CREATE POLICY storage_units_authenticated_read ON storage_units
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS storage_assignments_holder_read ON storage_assignments;
CREATE POLICY storage_assignments_holder_read ON storage_assignments
  FOR SELECT TO authenticated
  USING (holder_user_id = auth.uid());

DROP POLICY IF EXISTS storage_notices_holder_read ON storage_abandonment_notices;
CREATE POLICY storage_notices_holder_read ON storage_abandonment_notices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM storage_assignments a
      WHERE a.id = storage_abandonment_notices.assignment_id AND a.holder_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS storage_inventories_holder_read ON storage_inventories;
CREATE POLICY storage_inventories_holder_read ON storage_inventories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM storage_assignments a
      WHERE a.id = storage_inventories.assignment_id AND a.holder_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS storage_disposals_holder_read ON storage_disposal_records;
CREATE POLICY storage_disposals_holder_read ON storage_disposal_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM storage_assignments a
      WHERE a.id = storage_disposal_records.assignment_id AND a.holder_user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION storage_is_high_value(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION assess_storage_assignment(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION renew_storage_assignment(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_abandonment_notice(UUID, VARCHAR, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION dispose_storage_contents(UUID, TIMESTAMPTZ, UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION sweep_building_storage(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON COLUMN storage_disposal_records.notice_delivered_at IS
  'NOT NULL by constraint: the schema-level statement that nothing is disposed of without a delivered notice behind it.';
COMMENT ON FUNCTION assess_storage_assignment(UUID, TIMESTAMPTZ) IS
  'Pure over the supplied instant. The hold runs from the first confirmed delivery, never from the end of term, and an incomplete chain resolves to manual review rather than disposal.';
