-- =============================================================================
-- Migration: 20261230000000_waitlist_bidding_trigger.sql
-- Issue: #4257 - Develop a 'Dynamic "Event Capacity" Waitlist Bidding'
-- Description: Upgrades promote_waitlist_on_cancel to be bid-aware.
--   When bidding is enabled on an event, a spot opening triggers the 
--   promote-waitlist-bidder Edge Function to capture payment from the 
--   highest authorized bidder and promote them.
--   For non-bidding events, the existing FIFO promotion continues.
-- =============================================================================

-- Update promote_waitlist_on_cancel to be bid-aware
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_promoted_rsvp_id UUID;
    v_promoted_user_id UUID;
    v_promoted_email TEXT;
    v_promoted_name TEXT;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_webhook_url TEXT;
    v_is_bidding_enabled BOOLEAN;
    v_service_role_key TEXT;
BEGIN
    -- Only act when an attending RSVP flipped to cancelled.
    IF OLD.status = 'attending' AND NEW.status = 'cancelled' THEN

        -- Check if this event has bidding enabled
        SELECT is_bidding_enabled INTO v_is_bidding_enabled
        FROM public.events
        WHERE id = NEW.event_id;

        IF v_is_bidding_enabled = TRUE THEN
            -- Bid-aware path: invoke promote-waitlist-bidder Edge Function
            v_webhook_url := COALESCE(
                current_setting('app.promote_bidder_webhook_url', true),
                'http://localhost:54321/functions/v1/promote-waitlist-bidder'
            );
            v_service_role_key := COALESCE(
                current_setting('app.service_role_key', true),
                ''
            );

            PERFORM net.http_post(
                url := v_webhook_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || v_service_role_key
                ),
                body := jsonb_build_object(
                    'record', jsonb_build_object(
                        'event_id', NEW.event_id,
                        'user_id', NEW.user_id,
                        'status', NEW.status
                    )
                )
            );

        ELSE
            -- Standard FIFO path: promote oldest waitlisted user
            SELECT id, user_id
            INTO v_promoted_rsvp_id, v_promoted_user_id
            FROM public.event_rsvps
            WHERE event_id = NEW.event_id
              AND status = 'waitlisted'
            ORDER BY rsvp_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1;

            IF v_promoted_rsvp_id IS NOT NULL THEN
                UPDATE public.event_rsvps
                SET status = 'attending', rsvp_at = NOW()
                WHERE id = v_promoted_rsvp_id;

                SELECT p.email,
                       COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')
                    INTO v_promoted_email, v_promoted_name
                FROM public.profiles p
                WHERE p.id = v_promoted_user_id;

                SELECT e.title, e.short_id
                    INTO v_event_title, v_event_short_id
                FROM public.events e
                WHERE e.id = NEW.event_id;

                v_webhook_url := COALESCE(
                    current_setting('app.waitlist_webhook_url', true),
                    'http://localhost:54321/functions/v1/waitlist-promotion-email'
                );
                v_service_role_key := COALESCE(
                    current_setting('app.service_role_key', true),
                    ''
                );

                PERFORM net.http_post(
                    url := v_webhook_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_service_role_key
                    ),
                    body := jsonb_build_object(
                        'event', 'waitlist_promoted',
                        'event_id', NEW.event_id,
                        'event_title', v_event_title,
                        'event_short_id', v_event_short_id,
                        'promoted_user_id', v_promoted_user_id,
                        'promoted_email', v_promoted_email,
                        'promoted_name', v_promoted_name,
                        'promoted_rsvp_id', v_promoted_rsvp_id
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure the trigger is still bound (idempotent re-attach)
DROP TRIGGER IF EXISTS tr_promote_waitlist_on_rsvp_cancel ON public.event_rsvps;
CREATE TRIGGER tr_promote_waitlist_on_rsvp_cancel
AFTER UPDATE ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.status = 'attending' AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.promote_waitlist_on_cancel();

-- RPC: get_my_waitlist_bid
-- Returns the caller''s current bid status for a given event.
CREATE OR REPLACE FUNCTION public.get_my_waitlist_bid(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'rsvp_id', id,
        'bid_amount_cents', bid_amount_cents,
        'bid_status', bid_status,
        'has_bid', bid_amount_cents > 0
      )
      FROM public.event_rsvps
      WHERE event_id = p_event_id
        AND user_id = auth.uid()
        AND status = 'waitlisted'
      LIMIT 1
    ),
    jsonb_build_object('has_bid', false)
  );
$$;

-- RPC: get_bid_leaderboard
-- Returns anonymized top-N bids for a given event (for display).
CREATE OR REPLACE FUNCTION public.get_bid_leaderboard(p_event_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE(rank BIGINT, bid_amount_cents INT, is_mine BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY bid_amount_cents DESC) AS rank,
    bid_amount_cents,
    (user_id = auth.uid()) AS is_mine
  FROM public.event_rsvps
  WHERE event_id = p_event_id
    AND status = 'waitlisted'
    AND bid_status = 'authorized'
    AND bid_amount_cents > 0
  ORDER BY bid_amount_cents DESC
  LIMIT p_limit;
$$;
