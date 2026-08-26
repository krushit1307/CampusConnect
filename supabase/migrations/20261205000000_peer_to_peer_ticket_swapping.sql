-- ============================================================
-- Migration: Peer-to-Peer Ticket Swapping Marketplace (Issue #3234)
--
-- Enables lateral ticket trades between users for mutually exclusive events.
-- MVP enforces equal pricing ("Free for Free" or "Same Price for Same Price")
-- and executes an atomic Postgres transaction to swap RSVP user_ids while
-- regenerating QR code hashes to prevent ticket duplication and fraud.
-- ============================================================

-- ── Step 1: Ensure ticket_price column on public.events ─────────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS ticket_price INTEGER NOT NULL DEFAULT 0;

-- ── Step 2: Ensure qr_code_hash column on public.event_rsvps ────
ALTER TABLE public.event_rsvps
    ADD COLUMN IF NOT EXISTS qr_code_hash TEXT;

-- ── Step 3: Create ticket_trades table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requested_event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    responder_rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    responder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed', 'cancelled', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_trades_status_requested
    ON public.ticket_trades (status, requested_event_id);

CREATE INDEX IF NOT EXISTS idx_ticket_trades_initiator_rsvp
    ON public.ticket_trades (initiator_rsvp_id);

CREATE INDEX IF NOT EXISTS idx_ticket_trades_initiator
    ON public.ticket_trades (initiator_id);

-- Enable RLS
ALTER TABLE public.ticket_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public can view open ticket trade listings." ON public.ticket_trades;
CREATE POLICY "Public can view open ticket trade listings."
ON public.ticket_trades FOR SELECT
USING (status = 'open' OR auth.uid() = initiator_id OR auth.uid() = responder_id);

DROP POLICY IF EXISTS "Users can insert trade offers for their own RSVPs." ON public.ticket_trades;
CREATE POLICY "Users can insert trade offers for their own RSVPs."
ON public.ticket_trades FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = initiator_id);

DROP POLICY IF EXISTS "Involved users can update trade status." ON public.ticket_trades;
CREATE POLICY "Involved users can update trade status."
ON public.ticket_trades FOR UPDATE
TO authenticated
USING (auth.uid() = initiator_id OR auth.uid() = responder_id)
WITH CHECK (auth.uid() = initiator_id OR auth.uid() = responder_id);

DROP POLICY IF EXISTS "Service role has full access to ticket trades." ON public.ticket_trades;
CREATE POLICY "Service role has full access to ticket trades."
ON public.ticket_trades FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ── Step 4: RPC to propose a ticket trade ────────────────────────
CREATE OR REPLACE FUNCTION public.propose_ticket_trade(
    p_initiator_rsvp_id UUID,
    p_requested_event_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_initiator_id UUID;
    v_initiator_event_id UUID;
    v_trade_id UUID;
    v_existing_rsvp UUID;
BEGIN
    v_initiator_id := auth.uid();

    -- 1. Verify RSVP ownership and active status
    SELECT user_id, event_id
    INTO v_initiator_id, v_initiator_event_id
    FROM public.event_rsvps
    WHERE id = p_initiator_rsvp_id
      AND user_id = auth.uid()
      AND status IN ('attending', 'approved');

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or unconfirmed RSVP. You must hold a valid ticket to offer a trade.'
        );
    END IF;

    -- 2. Cannot request a trade for the same event you are offering
    IF v_initiator_event_id = p_requested_event_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Requested event cannot be the same as offered event.'
        );
    END IF;

    -- 3. Verify user does not already hold an active RSVP for requested event
    SELECT id
    INTO v_existing_rsvp
    FROM public.event_rsvps
    WHERE event_id = p_requested_event_id
      AND user_id = auth.uid()
      AND status IN ('attending', 'approved');

    IF v_existing_rsvp IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You already hold a ticket for the requested event.'
        );
    END IF;

    -- 4. Check if open trade already exists for this RSVP
    SELECT id INTO v_trade_id
    FROM public.ticket_trades
    WHERE initiator_rsvp_id = p_initiator_rsvp_id
      AND status = 'open';

    IF v_trade_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'trade_id', v_trade_id,
            'message', 'Trade offer already exists and is active.'
        );
    END IF;

    -- 5. Insert new trade offer
    INSERT INTO public.ticket_trades (
        initiator_rsvp_id,
        initiator_id,
        requested_event_id,
        status
    ) VALUES (
        p_initiator_rsvp_id,
        auth.uid(),
        p_requested_event_id,
        'open'
    ) RETURNING id INTO v_trade_id;

    RETURN jsonb_build_object(
        'success', true,
        'trade_id', v_trade_id,
        'message', 'Trade offer posted to Ticket Exchange board.'
    );
END;
$$;

-- ── Step 5: RPC to accept/execute a ticket trade (Atomic Transaction) ──
CREATE OR REPLACE FUNCTION public.accept_ticket_trade(
    p_trade_id UUID,
    p_responder_rsvp_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trade RECORD;
    v_initiator_rsvp RECORD;
    v_responder_rsvp RECORD;
    v_initiator_price INTEGER := 0;
    v_responder_price INTEGER := 0;
    v_new_qr_initiator TEXT;
    v_new_qr_responder TEXT;
    v_responder_id UUID;
BEGIN
    v_responder_id := auth.uid();

    -- 1. Lock trade offer record
    SELECT * INTO v_trade
    FROM public.ticket_trades
    WHERE id = p_trade_id
      AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade offer not found or no longer open.');
    END IF;

    -- Cannot accept your own trade offer
    IF v_trade.initiator_id = v_responder_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot accept your own trade offer.');
    END IF;

    -- 2. Lock Initiator RSVP
    SELECT * INTO v_initiator_rsvp
    FROM public.event_rsvps
    WHERE id = v_trade.initiator_rsvp_id
      AND user_id = v_trade.initiator_id
      AND status IN ('attending', 'approved')
    FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.ticket_trades
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = p_trade_id;

        RETURN jsonb_build_object('success', false, 'error', 'Initiator ticket is no longer valid. Trade cancelled.');
    END IF;

    -- 3. Lock Responder RSVP
    SELECT * INTO v_responder_rsvp
    FROM public.event_rsvps
    WHERE id = p_responder_rsvp_id
      AND user_id = v_responder_id
      AND status IN ('attending', 'approved')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Responder ticket is invalid or unconfirmed.');
    END IF;

    -- Verify responder ticket matches requested event
    IF v_responder_rsvp.event_id <> v_trade.requested_event_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Provided ticket does not match the requested event.');
    END IF;

    -- 4. Edge Case: Price Matching Enforcement (MVP Rule)
    SELECT COALESCE(ticket_price, 0) INTO v_initiator_price
    FROM public.events
    WHERE id = v_initiator_rsvp.event_id;

    SELECT COALESCE(ticket_price, 0) INTO v_responder_price
    FROM public.events
    WHERE id = v_trade.requested_event_id;

    IF v_initiator_price <> v_responder_price THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unequal trade: Swaps are strictly restricted to events of equal ticket price or free events.'
        );
    END IF;

    -- 5. Generate fresh QR code hashes to void previous codes
    v_new_qr_initiator := encode(gen_random_bytes(16), 'hex');
    v_new_qr_responder := encode(gen_random_bytes(16), 'hex');

    -- 6. Atomic Swap: Swap user_ids on both RSVP records simultaneously
    UPDATE public.event_rsvps
    SET user_id = v_responder_id,
        qr_code_hash = v_new_qr_initiator,
        rsvp_at = NOW()
    WHERE id = v_initiator_rsvp.id;

    UPDATE public.event_rsvps
    SET user_id = v_trade.initiator_id,
        qr_code_hash = v_new_qr_responder,
        rsvp_at = NOW()
    WHERE id = v_responder_rsvp.id;

    -- 7. Update ticket trade record status to completed
    UPDATE public.ticket_trades
    SET status = 'completed',
        responder_rsvp_id = p_responder_rsvp_id,
        responder_id = v_responder_id,
        updated_at = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket swap executed successfully! QR codes have been regenerated.'
    );
END;
$$;

-- ── Step 6: RPC to cancel a ticket trade ─────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_ticket_trade(
    p_trade_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trade RECORD;
BEGIN
    SELECT * INTO v_trade
    FROM public.ticket_trades
    WHERE id = p_trade_id
      AND initiator_id = auth.uid()
      AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade offer not found or cannot be cancelled.');
    END IF;

    UPDATE public.ticket_trades
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Trade offer cancelled successfully.'
    );
END;
$$;

-- Comments
COMMENT ON TABLE public.ticket_trades IS
'Stores P2P ticket trade listings and completed lateral swaps between users.';

COMMENT ON FUNCTION public.propose_ticket_trade(UUID, UUID) IS
'Creates a new open ticket trade offer on the P2P Ticket Exchange board.';

COMMENT ON FUNCTION public.accept_ticket_trade(UUID, UUID) IS
'Atomically swaps RSVP user_ids between initiator and responder and regenerates QR codes.';

COMMENT ON FUNCTION public.cancel_ticket_trade(UUID) IS
'Cancels an open ticket trade offer by the initiator.';
