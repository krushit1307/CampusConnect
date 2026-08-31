-- ============================================================
-- Attendance Verification State Machine (#5225)
--
-- Formal attendance lifecycle:
--
-- RSVP -> CONFIRMED -> CHECKED_IN -> ATTENDED
--
-- Cancellation:
-- RSVP / CONFIRMED -> CANCELLED
--
-- Invalidation:
-- CONFIRMED / CHECKED_IN -> INVALIDATED
--
-- All state changes happen through one transactional RPC.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add the formal attendance state to event_rsvps
-- ------------------------------------------------------------

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS attendance_state TEXT
  NOT NULL DEFAULT 'rsvp';

ALTER TABLE public.event_rsvps
  DROP CONSTRAINT IF EXISTS check_event_rsvps_attendance_state;

ALTER TABLE public.event_rsvps
  ADD CONSTRAINT check_event_rsvps_attendance_state
  CHECK (
    attendance_state IN (
      'rsvp',
      'confirmed',
      'checked_in',
      'attended',
      'cancelled',
      'invalidated'
    )
  );


-- Existing RSVP status is still used by the existing RSVP/waitlist
-- system. Convert existing records into the new state machine.

UPDATE public.event_rsvps
SET attendance_state =
  CASE
    WHEN status = 'cancelled' THEN 'cancelled'
    WHEN status = 'waitlisted' THEN 'rsvp'
    WHEN checked_in = TRUE THEN 'checked_in'
    ELSE 'confirmed'
  END
WHERE attendance_state = 'rsvp';


CREATE INDEX IF NOT EXISTS idx_event_rsvps_attendance_state
ON public.event_rsvps(event_id, attendance_state);


-- ------------------------------------------------------------
-- 2. Attendance history
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_attendance_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  rsvp_id UUID NOT NULL
    REFERENCES public.event_rsvps(id)
    ON DELETE CASCADE,

  from_state TEXT,
  to_state TEXT NOT NULL,

  changed_by UUID
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,

  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  reason TEXT,

  CONSTRAINT attendance_history_from_state_valid
    CHECK (
      from_state IS NULL OR
      from_state IN (
        'rsvp',
        'confirmed',
        'checked_in',
        'attended',
        'cancelled',
        'invalidated'
      )
    ),

  CONSTRAINT attendance_history_to_state_valid
    CHECK (
      to_state IN (
        'rsvp',
        'confirmed',
        'checked_in',
        'attended',
        'cancelled',
        'invalidated'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  idx_attendance_state_history_rsvp
ON public.event_attendance_state_history(rsvp_id, changed_at DESC);


ALTER TABLE public.event_attendance_state_history
ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS
  "Club admins can view attendance state history"
ON public.event_attendance_state_history;

CREATE POLICY
  "Club admins can view attendance state history"
ON public.event_attendance_state_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.event_rsvps r
    JOIN public.events e
      ON e.id = r.event_id
    WHERE r.id = event_attendance_state_history.rsvp_id
      AND (
        public.is_club_admin(e.club_id, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.clubs c
          WHERE c.id = e.club_id
            AND c.created_by = auth.uid()
        )
      )
  )
);


-- ------------------------------------------------------------
-- 3. Validate allowed transitions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_attendance_transition(
  p_from_state TEXT,
  p_to_state TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE p_from_state
      WHEN 'rsvp' THEN
        p_to_state IN ('confirmed', 'cancelled')

      WHEN 'confirmed' THEN
        p_to_state IN ('checked_in', 'cancelled', 'invalidated')

      WHEN 'checked_in' THEN
        p_to_state IN ('attended', 'invalidated')

      WHEN 'attended' THEN
        FALSE

      WHEN 'cancelled' THEN
        FALSE

      WHEN 'invalidated' THEN
        FALSE

      ELSE
        FALSE
    END;
$$;


-- ------------------------------------------------------------
-- 4. Central transition function
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transition_event_attendance(
  p_rsvp_id UUID,
  p_to_state TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
  v_event RECORD;

  v_actor UUID;
  v_is_service_role BOOLEAN := FALSE;

  v_from_state TEXT;
  v_to_state TEXT;

  v_changed_by UUID;
BEGIN
  v_actor := auth.uid();

  v_is_service_role :=
    COALESCE(
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role';

  IF v_actor IS NULL AND NOT v_is_service_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Authentication is required.'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Lock the RSVP row.
  --
  -- This is important for concurrent check-ins. Only one
  -- transaction can change this RSVP at a time.
  -- ----------------------------------------------------------

  SELECT
    r.id,
    r.event_id,
    r.user_id,
    r.status,
    r.checked_in,
    r.attendance_state
  INTO v_rsvp
  FROM public.event_rsvps r
  WHERE r.id = p_rsvp_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'RSVP_NOT_FOUND',
      'message', 'RSVP does not exist.'
    );
  END IF;


  v_from_state := v_rsvp.attendance_state;
  v_to_state := LOWER(TRIM(p_to_state));


  -- ----------------------------------------------------------
  -- Duplicate transition = idempotent success.
  --
  -- A second check-in therefore does not create another
  -- attendance record.
  -- ----------------------------------------------------------

  IF v_from_state = v_to_state THEN

    IF v_to_state = 'checked_in' THEN
      RETURN jsonb_build_object(
        'success', true,
        'code', 'ALREADY_CHECKED_IN',
        'idempotent', true,
        'state', v_to_state
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_IN_STATE',
      'idempotent', true,
      'state', v_to_state
    );
  END IF;


  -- ----------------------------------------------------------
  -- Reject arbitrary transitions.
  -- ----------------------------------------------------------

  IF NOT public.is_valid_attendance_transition(
    v_from_state,
    v_to_state
  ) THEN

    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_ATTENDANCE_TRANSITION',
      'message',
      format(
        'Cannot transition attendance from %s to %s.',
        v_from_state,
        v_to_state
      ),
      'from_state', v_from_state,
      'to_state', v_to_state
    );
  END IF;


  -- ----------------------------------------------------------
  -- Load current event state.
  -- ----------------------------------------------------------

  SELECT
    e.id,
    e.club_id,
    e.status,
    e.event_date,
    e.start_date,
    e.end_date
  INTO v_event
  FROM public.events e
  WHERE e.id = v_rsvp.event_id
  FOR SHARE;


  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FOUND',
      'message', 'Event does not exist.'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Actor authorization.
  --
  -- Attendees may only perform their own allowed transition
  -- through an explicitly supported self-service path.
  --
  -- Organizer/service operations require organizer privileges.
  -- ----------------------------------------------------------

  IF NOT v_is_service_role THEN

    IF v_actor = v_rsvp.user_id THEN

      -- A normal attendee can only complete the RSVP lifecycle
      -- through their own check-in.
      IF v_to_state NOT IN ('checked_in', 'cancelled') THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'FORBIDDEN',
          'message',
          'This attendance transition requires an organizer.'
        );
      END IF;

    ELSE

      IF NOT (
        public.is_club_admin(v_event.club_id, v_actor)
        OR EXISTS (
          SELECT 1
          FROM public.clubs c
          WHERE c.id = v_event.club_id
            AND c.created_by = v_actor
        )
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'FORBIDDEN',
          'message',
          'Only an event organizer can perform this transition.'
        );
      END IF;

    END IF;

    v_changed_by := v_actor;

  ELSE
    v_changed_by := NULL;
  END IF;


  -- ----------------------------------------------------------
  -- Eligibility checks.
  -- ----------------------------------------------------------

  IF v_to_state = 'confirmed' THEN

    IF v_rsvp.status NOT IN ('attending', 'approved') THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'RSVP_NOT_CONFIRMED',
        'message',
        'Only an active RSVP can become confirmed.'
      );
    END IF;

  END IF;


  IF v_to_state = 'checked_in' THEN

    IF v_rsvp.status NOT IN ('attending', 'approved') THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'RSVP_NOT_ELIGIBLE',
        'message',
        'Only a confirmed RSVP can be checked in.'
      );
    END IF;

    IF v_event.status IN (
      'cancelled',
      'canceled',
      'archived'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EVENT_NOT_ACTIVE',
        'message',
        'Attendance cannot be recorded for an inactive event.'
      );
    END IF;

  END IF;


  IF v_to_state = 'attended' THEN

    IF v_from_state <> 'checked_in' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'CHECK_IN_REQUIRED',
        'message',
        'An attendee must be checked in before being marked attended.'
      );
    END IF;

    IF v_event.end_date IS NOT NULL
       AND v_event.end_date > NOW()
       AND NOT v_is_service_role THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EVENT_NOT_FINISHED',
        'message',
        'Attendance can only be finalized after the event.'
      );
    END IF;

  END IF;


  -- ----------------------------------------------------------
  -- Apply the state change.
  -- ----------------------------------------------------------

  UPDATE public.event_rsvps
  SET
    attendance_state = v_to_state,
    checked_in =
      CASE
        WHEN v_to_state IN ('checked_in', 'attended')
          THEN TRUE
        WHEN v_to_state IN ('rsvp', 'confirmed', 'cancelled', 'invalidated')
          THEN FALSE
        ELSE checked_in
      END
  WHERE id = v_rsvp.id;


  -- ----------------------------------------------------------
  -- Record an immutable transition history entry.
  -- ----------------------------------------------------------

  INSERT INTO public.event_attendance_state_history (
    rsvp_id,
    from_state,
    to_state,
    changed_by,
    reason
  )
  VALUES (
    v_rsvp.id,
    v_from_state,
    v_to_state,
    v_changed_by,
    p_reason
  );


  -- Keep the existing attendance log for check-in events.
  IF v_to_state = 'checked_in' THEN

    INSERT INTO public.event_attendance_logs (
      rsvp_id,
      recorded_by,
      verification_method
    )
    VALUES (
      v_rsvp.id,
      COALESCE(v_changed_by, v_rsvp.user_id),
      'manual'
    );

  END IF;


  RETURN jsonb_build_object(
    'success', true,
    'code', 'ATTENDANCE_TRANSITIONED',
    'from_state', v_from_state,
    'state', v_to_state,
    'rsvp_id', v_rsvp.id
  );
END;
$$;


REVOKE ALL ON FUNCTION public.transition_event_attendance(
  UUID,
  TEXT,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.transition_event_attendance(
  UUID,
  TEXT,
  TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.transition_event_attendance(
  UUID,
  TEXT,
  TEXT
) TO service_role;


-- ------------------------------------------------------------
-- 5. Prevent direct attendance_state manipulation.
--
-- All state changes must go through the transition function.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_direct_attendance_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.attendance_state IS DISTINCT FROM NEW.attendance_state THEN

    IF current_setting(
      'app.attendance_state_transition',
      true
    ) <> 'allowed' THEN

      RAISE EXCEPTION
        'Attendance state must be changed through transition_event_attendance().';

    END IF;

  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
  prevent_direct_attendance_state_change_trigger
ON public.event_rsvps;

CREATE TRIGGER
  prevent_direct_attendance_state_change_trigger
BEFORE UPDATE OF attendance_state
ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_attendance_state_change();


-- The transition RPC needs a session-local bypass for its own
-- state update. Re-create the function with the bypass enabled
-- immediately before UPDATE.
CREATE OR REPLACE FUNCTION public.transition_event_attendance(
  p_rsvp_id UUID,
  p_to_state TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
  v_event RECORD;
  v_actor UUID;
  v_is_service_role BOOLEAN := FALSE;
  v_from_state TEXT;
  v_to_state TEXT;
  v_changed_by UUID;
BEGIN
  v_actor := auth.uid();

  v_is_service_role :=
    COALESCE(
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role';

  IF v_actor IS NULL AND NOT v_is_service_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED'
    );
  END IF;

  SELECT *
  INTO v_rsvp
  FROM public.event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'RSVP_NOT_FOUND'
    );
  END IF;

  v_from_state := v_rsvp.attendance_state;
  v_to_state := LOWER(TRIM(p_to_state));

  IF v_from_state = v_to_state THEN
    RETURN jsonb_build_object(
      'success', true,
      'code',
      CASE
        WHEN v_to_state = 'checked_in'
          THEN 'ALREADY_CHECKED_IN'
        ELSE 'ALREADY_IN_STATE'
      END,
      'idempotent', true,
      'state', v_to_state
    );
  END IF;

  IF NOT public.is_valid_attendance_transition(
    v_from_state,
    v_to_state
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_ATTENDANCE_TRANSITION',
      'from_state', v_from_state,
      'to_state', v_to_state
    );
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = v_rsvp.event_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FOUND'
    );
  END IF;

  IF NOT v_is_service_role THEN

    IF v_actor = v_rsvp.user_id THEN

      IF v_to_state NOT IN ('checked_in', 'cancelled') THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'FORBIDDEN'
        );
      END IF;

    ELSIF NOT (
      public.is_club_admin(v_event.club_id, v_actor)
      OR EXISTS (
        SELECT 1
        FROM public.clubs c
        WHERE c.id = v_event.club_id
          AND c.created_by = v_actor
      )
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN'
      );
    END IF;

    v_changed_by := v_actor;

  END IF;

  IF v_to_state IN ('confirmed', 'checked_in')
     AND v_rsvp.status NOT IN ('attending', 'approved') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'RSVP_NOT_ELIGIBLE'
    );
  END IF;

  IF v_to_state = 'checked_in'
     AND v_event.status IN ('cancelled', 'canceled', 'archived') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_ACTIVE'
    );
  END IF;

  IF v_to_state = 'attended'
     AND v_event.end_date IS NOT NULL
     AND v_event.end_date > NOW()
     AND NOT v_is_service_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EVENT_NOT_FINISHED'
    );
  END IF;

  PERFORM set_config(
    'app.attendance_state_transition',
    'allowed',
    true
  );

  UPDATE public.event_rsvps
  SET
    attendance_state = v_to_state,
    checked_in =
      CASE
        WHEN v_to_state IN ('checked_in', 'attended')
          THEN TRUE
        WHEN v_to_state IN ('rsvp', 'confirmed', 'cancelled', 'invalidated')
          THEN FALSE
        ELSE checked_in
      END
  WHERE id = v_rsvp.id;

  INSERT INTO public.event_attendance_state_history (
    rsvp_id,
    from_state,
    to_state,
    changed_by,
    reason
  )
  VALUES (
    v_rsvp.id,
    v_from_state,
    v_to_state,
    v_changed_by,
    p_reason
  );

  IF v_to_state = 'checked_in' THEN
    INSERT INTO public.event_attendance_logs (
      rsvp_id,
      recorded_by,
      verification_method
    )
    VALUES (
      v_rsvp.id,
      COALESCE(v_changed_by, v_rsvp.user_id),
      'manual'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'ATTENDANCE_TRANSITIONED',
    'from_state', v_from_state,
    'state', v_to_state,
    'rsvp_id', v_rsvp.id
  );
END;
$$;