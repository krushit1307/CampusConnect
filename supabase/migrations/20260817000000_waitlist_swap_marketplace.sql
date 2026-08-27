-- ============================================================
-- Migration: Waitlist Swap Marketplace (Issue #2903)
--
-- Replaces the instant auto-promotion from issue #2693 with a
-- 15-minute "claim window" marketplace. When a user cancels, the
-- RSVP is marked 'swapping' and a swap offer is created for the
-- top waitlisted user. The offer expires after 15 minutes; if
-- unclaimed, it is offered to the next person.
--
-- Also handles Quiet Hours (10 PM - 8 AM): SMS dispatches are
-- deferred to 8 AM so users aren't texted at 3 AM.
-- ============================================================

-- ── Step 1: Add 'swapping' to event_rsvps.status ───────────────
ALTER TABLE public.event_rsvps
    DROP CONSTRAINT IF EXISTS check_event_rsvps_status;
ALTER TABLE public.event_rsvps
    ADD CONSTRAINT check_event_rsvps_status
    CHECK (status IN ('attending', 'waitlisted', 'cancelled', 'swapping'));

-- ── Step 2: Create waitlist_swap_offers table ───────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_swap_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claim_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_swap_offers_event
    ON public.waitlist_swap_offers (event_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_swap_offers_token
    ON public.waitlist_swap_offers (claim_token);

ALTER TABLE public.waitlist_swap_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own swap offers." ON public.waitlist_swap_offers;
CREATE POLICY "Users can view their own swap offers."
ON public.waitlist_swap_offers FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ── Step 3: Create sms_outbox for Quiet Hours ───────────────────
CREATE TABLE IF NOT EXISTS public.sms_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    swap_offer_id UUID REFERENCES public.waitlist_swap_offers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    send_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_send
    ON public.sms_outbox (status, send_after);

ALTER TABLE public.sms_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage sms_outbox." ON public.sms_outbox;
CREATE POLICY "Service role can manage sms_outbox."
ON public.sms_outbox FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ── Step 4: create_swap_offer RPC ───────────────────────────────
-- Selects the top waitlisted user, generates a claim token, inserts
-- into waitlist_swap_offers, and fires the dispatch webhook.
CREATE OR REPLACE FUNCTION public.create_swap_offer(
    p_event_id UUID,
    p_from_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_rsvp_id UUID;
    v_to_user_id UUID;
    v_claim_token TEXT;
    v_expires_at TIMESTAMPTZ;
    v_offer_id UUID;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_to_phone TEXT;
    v_to_name TEXT;
    v_webhook_url TEXT;
BEGIN
    -- Find the RSVP being swapped.
    SELECT id
    INTO v_rsvp_id
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_from_user_id
      AND status = 'swapping'
    FOR UPDATE;

    IF v_rsvp_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find the oldest waitlisted user (FIFO).
    SELECT user_id
    INTO v_to_user_id
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'waitlisted'
    ORDER BY rsvp_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- If no one is waitlisted, just cancel the RSVP outright.
    IF v_to_user_id IS NULL THEN
        UPDATE public.event_rsvps
        SET status = 'cancelled', rsvp_at = NOW()
        WHERE id = v_rsvp_id;
        RETURN NULL;
    END IF;

    -- Generate a random claim token (crypto-safe).
    v_claim_token := encode(gen_random_bytes(32), 'hex');
    v_expires_at := NOW() + INTERVAL '15 minutes';

    -- Insert the swap offer.
    INSERT INTO public.waitlist_swap_offers
        (event_id, rsvp_id, from_user_id, to_user_id, claim_token, expires_at)
    VALUES
        (p_event_id, v_rsvp_id, p_from_user_id, v_to_user_id, v_claim_token, v_expires_at)
    RETURNING id INTO v_offer_id;

    -- Fetch event + user details for the webhook.
    SELECT e.title, e.short_id
    INTO v_event_title, v_event_short_id
    FROM public.events e
    WHERE e.id = p_event_id;

    SELECT p.phone, COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')
    INTO v_to_phone, v_to_name
    FROM public.profiles p
    WHERE p.id = v_to_user_id;

    -- Fire the dispatch webhook via pg_net.
    v_webhook_url := COALESCE(
        current_setting('app.swap_dispatch_url', true),
        'http://localhost:54321/functions/v1/waitlist-swap-dispatch'
    );

    PERFORM extensions.net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(
                current_setting('app.service_role_key', true), ''
            )
        ),
        body := jsonb_build_object(
            'event', 'swap_offer_created',
            'offer_id', v_offer_id,
            'event_id', p_event_id,
            'event_title', v_event_title,
            'event_short_id', v_event_short_id,
            'to_user_id', v_to_user_id,
            'to_phone', v_to_phone,
            'to_name', v_to_name,
            'claim_token', v_claim_token,
            'expires_at', v_expires_at
        )
    );

    RETURN v_offer_id;
END;
 $$;

-- ── Step 5: Update cancel_event_rsvp to use swapping ───────────
-- Replaces the instant promotion from issue #2693.
CREATE OR REPLACE FUNCTION public.cancel_event_rsvp(
    p_event_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_was_attending BOOLEAN := FALSE;
    v_offer_id UUID;
BEGIN
    SELECT status = 'attending'
    INTO v_was_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND status IN ('attending', 'waitlisted', 'swapping')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active RSVP found for this event.'
        );
    END IF;

    IF v_was_attending THEN
        -- Mark as swapping and create a swap offer for the next waitlisted user.
        UPDATE public.event_rsvps
        SET status = 'swapping', rsvp_at = NOW()
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status = 'attending';

        v_offer_id := public.create_swap_offer(p_event_id, p_user_id);

        RETURN jsonb_build_object(
            'success', true,
            'was_attending', true,
            'swap_offer_id', v_offer_id,
            'message', 'RSVP marked as swapping. The next waitlisted user has 15 minutes to claim.'
        );
    ELSE
        -- Waitlisted or swapping user cancelling: just remove.
        UPDATE public.event_rsvps
        SET status = 'cancelled', rsvp_at = NOW()
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status IN ('waitlisted', 'swapping');

        RETURN jsonb_build_object(
            'success', true,
            'was_attending', false,
            'message', 'Waitlist entry removed.'
        );
    END IF;
END;
 $$;

-- ── Step 6: claim_swap_offer RPC ───────────────────────────────
-- Transfers the RSVP from from_user to to_user.
CREATE OR REPLACE FUNCTION public.claim_swap_offer(
    p_offer_id UUID,
    p_claim_token TEXT,
    p_to_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_offer RECORD;
BEGIN
    SELECT *
    INTO v_offer
    FROM public.waitlist_swap_offers
    WHERE id = p_offer_id
      AND claim_token = p_claim_token
      AND to_user_id = p_to_user_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired claim link.');
    END IF;

    IF v_offer.expires_at < NOW() THEN
        UPDATE public.waitlist_swap_offers
        SET status = 'expired', expired_at = NOW()
        WHERE id = p_offer_id;
        RETURN jsonb_build_object('success', false, 'error', 'This claim link has expired.');
    END IF;

    -- Transfer the RSVP: mark the original user as cancelled.
    UPDATE public.event_rsvps
    SET status = 'cancelled', rsvp_at = NOW()
    WHERE id = v_offer.rsvp_id;

    -- Promote the claiming user.
    UPDATE public.event_rsvps
    SET status = 'attending', rsvp_at = NOW()
    WHERE event_id = v_offer.event_id
      AND user_id = p_to_user_id
      AND status = 'waitlisted';

    -- Mark the offer as claimed.
    UPDATE public.waitlist_swap_offers
    SET status = 'claimed', claimed_at = NOW()
    WHERE id = p_offer_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket claimed successfully!'
    );
END;
 $$;

-- ── Step 7: expire_swap_offers RPC (cron) ──────────────────────
-- Called every minute by pg_cron. Expires unclaimed offers and
-- creates a new offer for the next person in line.
CREATE OR REPLACE FUNCTION public.expire_swap_offers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_expired_count INTEGER := 0;
    v_rec RECORD;
BEGIN
    FOR v_rec IN
        SELECT id, event_id, from_user_id
        FROM public.waitlist_swap_offers
        WHERE status = 'pending'
          AND expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Mark the offer as expired.
        UPDATE public.waitlist_swap_offers
        SET status = 'expired', expired_at = NOW()
        WHERE id = v_rec.id;

        -- Try to create a new offer for the next person.
        -- The create_swap_offer function will find the next
        -- waitlisted user and fire the dispatch webhook.
        PERFORM public.create_swap_offer(v_rec.event_id, v_rec.from_user_id);

        v_expired_count := v_expired_count + 1;
    END LOOP;

    RETURN v_expired_count;
END;
 $$;

-- Schedule the cron job (every minute).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron not installed; skipping swap expiry schedule.';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        jobname := 'expire-swap-offers',
        schedule := '* * * * *',
        command := $cmd$             SELECT public.expire_swap_offers();
        $cmd$     );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule swap expiry: %', SQLERRM;
END $$;

-- Schedule the SMS outbox dispatcher (every minute, sends deferred SMS).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron not installed; skipping SMS outbox schedule.';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        jobname := 'dispatch-sms-outbox',
        schedule := '* * * * *',
        command := $cmd$             SELECT extensions.net.http_post(
                url := current_setting('app.swap_dispatch_url', true),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                ),
                body := jsonb_build_object(
                    'event', 'dispatch_sms_outbox'
                )
            );
        $cmd$     );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule SMS outbox dispatch: %', SQLERRM;
END $$;

COMMENT ON FUNCTION public.create_swap_offer(UUID, UUID) IS
'Selects the top waitlisted user, generates a 15-minute claim token, and fires the swap-dispatch webhook.';

COMMENT ON FUNCTION public.claim_swap_offer(UUID, TEXT, UUID) IS
'Transfers an RSVP from the swapping user to the claiming user. Verifies the claim token and checks the 15-minute expiry.';

COMMENT ON FUNCTION public.expire_swap_offers() IS
'Cron job: expires unclaimed swap offers and creates a new offer for the next waitlisted user.';

-- ============================================================
-- End of migration
-- ============================================================
