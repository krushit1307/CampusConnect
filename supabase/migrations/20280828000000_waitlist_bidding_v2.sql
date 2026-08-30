-- Migration: 20280828000000_waitlist_bidding_v2.sql
-- Description: Implement Dynamic Event Capacity Waitlist Bidding (#4257)

-- 1. Add waitlist_bidding boolean column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS waitlist_bidding BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.events.waitlist_bidding IS 'If true, users joining the waitlist can authorize a Stripe hold to bid for event entry.';

-- 2. Create the waitlist_bids table
CREATE TABLE IF NOT EXISTS public.waitlist_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bid_amount NUMERIC NOT NULL CHECK (bid_amount >= 0),
    stripe_setup_intent_id TEXT,
    bid_status TEXT DEFAULT 'authorized' CHECK (bid_status IN ('authorized', 'captured', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.waitlist_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policies for waitlist_bids
DROP POLICY IF EXISTS "Users can manage own waitlist bids" ON public.waitlist_bids;
CREATE POLICY "Users can manage own waitlist bids"
ON public.waitlist_bids FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view bids for enabled events" ON public.waitlist_bids;
CREATE POLICY "Public can view bids for enabled events"
ON public.waitlist_bids FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = waitlist_bids.event_id AND (waitlist_bidding = TRUE OR is_bidding_enabled = TRUE))
);

-- Index for fast queries on highest bids
CREATE INDEX IF NOT EXISTS idx_waitlist_bids_ordering
ON public.waitlist_bids(event_id, bid_amount DESC)
WHERE bid_status = 'authorized';

-- 3. Update promote_waitlist_on_cancel trigger function to check waitlist_bidding
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_promoted_rsvp_id UUID;
    v_promoted_user_id UUID;
    v_promoted_email TEXT;
    v_promoted_name TEXT;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_webhook_url TEXT;
    v_is_bidding_enabled BOOLEAN;
    v_waitlist_bidding BOOLEAN;
    v_service_role_key TEXT;
BEGIN
    -- Only act when an attending RSVP flipped to cancelled.
    IF OLD.status = 'attending' AND NEW.status = 'cancelled' THEN

        -- Check if this event has bidding enabled
        SELECT is_bidding_enabled, waitlist_bidding 
        INTO v_is_bidding_enabled, v_waitlist_bidding
        FROM public.events
        WHERE id = NEW.event_id;

        IF COALESCE(v_is_bidding_enabled, FALSE) = TRUE OR COALESCE(v_waitlist_bidding, FALSE) = TRUE THEN
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
