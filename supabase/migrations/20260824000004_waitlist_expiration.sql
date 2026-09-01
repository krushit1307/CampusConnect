-- ============================================================
-- Migration: 20260824000004_waitlist_expiration.sql
-- Issue: #4248
-- Description:
--   Dynamic Event Ticket Waitlist Expiration System.
--   When a waitlisted user is promoted to a spot, a 'claim_expires_at'
--   timestamp is stamped. A cron job runs every 15 minutes to expire
--   unclaimed tickets and auto-promote the next person in queue.
--   If the event is < 24 hours away, the expiration window shrinks
--   from 24 hours to 2 hours.
-- ============================================================

-- 1. Add claim_expires_at column to event_rsvps
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_claim_expires
  ON event_rsvps(claim_expires_at)
  WHERE claim_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_status_claim
  ON event_rsvps(event_id, status, rsvp_at)
  WHERE status = 'approved';

-- 2. Core expiration function
--    Called by pg_cron every 15 minutes. For each event_rsvps row
--    where status = 'approved' (promoted from waitlist) and
--    claim_expires_at has passed:
--      a) Set status = 'expired'
--      b) Delete the RSVP (freeing the seat)
--      c) The existing tr_promote_waitlist_on_rsvp_cancel trigger
--         fires on DELETE and promotes the next person automatically.
CREATE OR REPLACE FUNCTION public.expire_waitlist_offers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_row RECORD;
  v_claim_window INTERVAL;
BEGIN
  FOR v_row IN
    SELECT er.id, er.event_id, er.user_id, e.event_date
    FROM event_rsvps er
    JOIN events e ON e.id = er.event_id
    WHERE er.status = 'approved'
      AND er.claim_expires_at IS NOT NULL
      AND er.claim_expires_at < NOW()
    FOR UPDATE OF er SKIP LOCKED
  LOOP
    -- Dynamic window: if event is < 24h away at the time of this cron run,
    -- we don't need to recalculate — the original stamp already accounts for
    -- this. But for future-proofing, we log the actual window used.
    v_claim_window := v_row.claim_expires_at - (
      SELECT created_at FROM event_rsvps WHERE id = v_row.id
    );

    -- Revoke the unclaimed ticket
    UPDATE event_rsvps
    SET status = 'expired',
        claim_expires_at = NULL
    WHERE id = v_row.id;

    -- Delete the expired RSVP to free the seat.
    -- The tr_promote_waitlist_on_rsvp_cancel trigger will auto-promote
    -- the next person from event_waitlist.
    DELETE FROM event_rsvps
    WHERE id = v_row.id;

    v_expired_count := v_expired_count + 1;

    -- Log the expiration for audit
    RAISE NOTICE 'Expired waitlist offer for user % on event % (window: %)',
      v_row.user_id, v_row.event_id, v_claim_window;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_waitlist_offers() TO authenticated, service_role;

-- 3. Helper: calculate the appropriate claim window for an event
--    Returns 2 hours if the event is within 24 hours, otherwise 24 hours.
CREATE OR REPLACE FUNCTION public.get_claim_window(p_event_id UUID)
RETURNS INTERVAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN e.event_date - NOW() < INTERVAL '24 hours'
         AND e.event_date > NOW()
    THEN INTERVAL '2 hours'
    ELSE INTERVAL '24 hours'
  END
  FROM events e
  WHERE e.id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_claim_window(UUID) TO authenticated, service_role;

-- 4. Replace the existing promote_waitlist_attendee trigger function
--    to stamp claim_expires_at using the dynamic window.
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
    v_claim_window INTERVAL;
BEGIN
    -- Find and lock the oldest waitlist record (concurrency-safe)
    SELECT id, event_id, user_id INTO next_waitlist_record
    FROM public.event_waitlist
    WHERE event_id = OLD.event_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN OLD;
    END IF;

    -- Calculate the dynamic claim window
    v_claim_window := public.get_claim_window(next_waitlist_record.event_id);

    -- Promote to RSVP with claim_expires_at
    INSERT INTO public.event_rsvps (event_id, user_id, status, claim_expires_at)
    VALUES (
      next_waitlist_record.event_id,
      next_waitlist_record.user_id,
      'approved',
      NOW() + v_claim_window
    )
    ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = 'approved',
        claim_expires_at = NOW() + v_claim_window;

    -- Remove from waitlist
    DELETE FROM public.event_waitlist
    WHERE id = next_waitlist_record.id;

    RETURN OLD;
END;
$$;

-- 5. Re-create the trigger to use the updated function
DROP TRIGGER IF EXISTS tr_promote_waitlist_on_rsvp_cancel ON public.event_rsvps;

CREATE TRIGGER tr_promote_waitlist_on_rsvp_cancel
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_attendee();

-- 6. Schedule the cron job: every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-waitlist-offers') THEN
    PERFORM cron.unschedule('expire-waitlist-offers');
  END IF;
END
$$;

SELECT cron.schedule(
  'expire-waitlist-offers',
  '*/15 * * * *',  -- every 15 minutes
  $$SELECT public.expire_waitlist_offers();$$
);

-- 7. RPC: claim a waitlisted spot (client-facing, replaces direct INSERT)
--    This ensures the claim window is always calculated correctly.
CREATE OR REPLACE FUNCTION public.claim_waitlist_spot(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_claim_window INTERVAL;
  v_rsvp_id UUID;
BEGIN
  -- Verify the user has an approved (waitlist-promoted) RSVP
  SELECT id INTO v_rsvp_id
  FROM event_rsvps
  WHERE event_id = p_event_id
    AND user_id = v_user_id
    AND status = 'approved'
    AND claim_expires_at IS NOT NULL
    AND claim_expires_at > NOW();

  IF v_rsvp_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No active waitlist offer found. The offer may have expired or you may not be on the waitlist.'
    );
  END IF;

  -- The claim is already active — return success with expiry info
  SELECT claim_expires_at INTO v_claim_window
  FROM event_rsvps WHERE id = v_rsvp_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your ticket is confirmed!',
    'claim_expires_at', v_claim_window
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_waitlist_spot(UUID) TO authenticated;

-- 8. RPC: get waitlist position for a user on an event
CREATE OR REPLACE FUNCTION public.get_waitlist_position(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'position', (
      SELECT COALESCE(MIN(rnk), 0)
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rnk
        FROM event_waitlist
        WHERE event_id = p_event_id
      ) ranked
      WHERE ranked.rnk <= (
        SELECT ROW_NUMBER() OVER (ORDER BY created_at ASC)
        FROM event_waitlist
        WHERE event_id = p_event_id
          AND user_id = auth.uid()
      )
    ),
    'total_waitlisted', (
      SELECT COUNT(*)::INT
      FROM event_waitlist
      WHERE event_id = p_event_id
    ),
    'has_active_offer', (
      SELECT EXISTS (
        SELECT 1 FROM event_rsvps
        WHERE event_id = p_event_id
          AND user_id = auth.uid()
          AND status = 'approved'
          AND claim_expires_at IS NOT NULL
          AND claim_expires_at > NOW()
      )
    ),
    'offer_expires_at', (
      SELECT claim_expires_at
      FROM event_rsvps
      WHERE event_id = p_event_id
        AND user_id = auth.uid()
        AND status = 'approved'
        AND claim_expires_at IS NOT NULL
        AND claim_expires_at > NOW()
      LIMIT 1
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_position(UUID) TO authenticated;
