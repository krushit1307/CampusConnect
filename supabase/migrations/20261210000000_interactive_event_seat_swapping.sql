-- Migration: 20261210000000_interactive_event_seat_swapping.sql
-- Description: Implement Interactive Event Seat Swapping Module (#3550).

-- 1. Create seat_swap_requests table
CREATE TABLE IF NOT EXISTS public.seat_swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_ticket_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    target_ticket_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seat_swap_requests_initiator ON public.seat_swap_requests(initiator_ticket_id);
CREATE INDEX IF NOT EXISTS idx_seat_swap_requests_target ON public.seat_swap_requests(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_seat_swap_requests_status ON public.seat_swap_requests(status);

-- Enable RLS
ALTER TABLE public.seat_swap_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view seat swaps they are involved in" ON public.seat_swap_requests;
CREATE POLICY "Users can view seat swaps they are involved in" ON public.seat_swap_requests
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_rsvps r
            WHERE (r.id = initiator_ticket_id OR r.id = target_ticket_id)
              AND r.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert seat swap proposals" ON public.seat_swap_requests;
CREATE POLICY "Users can insert seat swap proposals" ON public.seat_swap_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.event_rsvps r
            WHERE r.id = initiator_ticket_id
              AND r.user_id = auth.uid()
        )
    );

-- 2. Function to propose a seat swap
CREATE OR REPLACE FUNCTION public.propose_seat_swap(
    p_initiator_ticket_id UUID,
    p_target_ticket_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_initiator_user_id UUID;
    v_target_user_id UUID;
    v_initiator_event_id UUID;
    v_target_event_id UUID;
    v_initiator_seat_label TEXT;
    v_target_seat_label TEXT;
    v_initiator_name TEXT;
    v_request_id UUID;
BEGIN
    -- 1. Validate initiator ownership
    SELECT user_id, event_id INTO v_initiator_user_id, v_initiator_event_id
    FROM public.event_rsvps
    WHERE id = p_initiator_ticket_id;

    IF v_initiator_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized: You do not own the initiator ticket.';
    END IF;

    -- 2. Validate target ticket exists
    SELECT user_id, event_id INTO v_target_user_id, v_target_event_id
    FROM public.event_rsvps
    WHERE id = p_target_ticket_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target ticket not found.';
    END IF;

    -- 3. Verify same event
    IF v_initiator_event_id IS DISTINCT FROM v_target_event_id THEN
        RAISE EXCEPTION 'Invalid swap: Tickets must belong to the same event.';
    END IF;

    -- 4. Find initiator seat label
    SELECT seat_number INTO v_initiator_seat_label
    FROM public.seats
    WHERE layout_id = (SELECT id FROM public.seating_layouts WHERE event_id = v_initiator_event_id LIMIT 1)
      AND locked_by = v_initiator_user_id
      AND status = 'sold';

    IF v_initiator_seat_label IS NULL THEN
        -- Fallback to event_seats label
        SELECT label INTO v_initiator_seat_label
        FROM public.event_seats
        WHERE event_id = v_initiator_event_id
          AND reserved_by = v_initiator_user_id;
    END IF;

    IF v_initiator_seat_label IS NULL THEN
        RAISE EXCEPTION 'Initiator does not have a reserved seat for this event.';
    END IF;

    -- 5. Find target seat label
    SELECT seat_number INTO v_target_seat_label
    FROM public.seats
    WHERE layout_id = (SELECT id FROM public.seating_layouts WHERE event_id = v_target_event_id LIMIT 1)
      AND locked_by = v_target_user_id
      AND status = 'sold';

    IF v_target_seat_label IS NULL THEN
        -- Fallback to event_seats label
        SELECT label INTO v_target_seat_label
        FROM public.event_seats
        WHERE event_id = v_target_event_id
          AND reserved_by = v_target_user_id;
    END IF;

    IF v_target_seat_label IS NULL THEN
        RAISE EXCEPTION 'Target does not have a reserved seat for this event.';
    END IF;

    -- 6. Check for existing pending request
    SELECT id INTO v_request_id
    FROM public.seat_swap_requests
    WHERE initiator_ticket_id = p_initiator_ticket_id
      AND target_ticket_id = p_target_ticket_id
      AND status = 'pending';

    IF v_request_id IS NOT NULL THEN
        RETURN v_request_id;
    END IF;

    -- 7. Insert the request
    INSERT INTO public.seat_swap_requests (initiator_ticket_id, target_ticket_id, status)
    VALUES (p_initiator_ticket_id, p_target_ticket_id, 'pending')
    RETURNING id INTO v_request_id;

    -- 8. Get initiator name
    SELECT COALESCE(first_name || ' ' || last_name, 'Someone') INTO v_initiator_name
    FROM public.profiles
    WHERE id = v_initiator_user_id;

    -- 9. Send notification to target user
    PERFORM public.queue_or_send_notification(
        p_user_id => v_target_user_id,
        p_notification_type => 'seat_swap_request',
        p_title => 'Seat Swap Proposed',
        p_message => v_initiator_name || ' wants to trade Seat ' || v_initiator_seat_label || ' for your Seat ' || v_target_seat_label || '.',
        p_link => '/events/' || v_initiator_event_id || '/seat-swaps',
        p_entity_id => v_request_id,
        p_entity_type => 'seat_swap_request',
        p_actor_id => auth.uid()
    );

    RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_seat_swap(UUID, UUID) TO authenticated;

-- 3. Function to accept a seat swap (Atomic Transaction with Row Locking)
CREATE OR REPLACE FUNCTION public.accept_seat_swap(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_initiator_user_id UUID;
    v_target_user_id UUID;
    v_event_id UUID;
    
    v_initiator_seat_id UUID;
    v_target_seat_id UUID;
    v_initiator_seat_label TEXT;
    v_target_seat_label TEXT;
    v_layout_id UUID;

    v_new_qr_initiator TEXT;
    v_new_qr_target TEXT;
BEGIN
    -- 1. Lock the request record
    SELECT * INTO v_request
    FROM public.seat_swap_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    -- 2. Verify current user is target owner
    SELECT user_id, event_id INTO v_target_user_id, v_event_id
    FROM public.event_rsvps
    WHERE id = v_request.target_ticket_id
    FOR UPDATE;

    IF v_target_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized: You do not own the target ticket.';
    END IF;

    -- 3. Lock initiator ticket
    SELECT user_id INTO v_initiator_user_id
    FROM public.event_rsvps
    WHERE id = v_request.initiator_ticket_id
    FOR UPDATE;

    -- 4. Find and Lock seats in deterministic order to prevent deadlocks
    SELECT id INTO v_layout_id FROM public.seating_layouts WHERE event_id = v_event_id LIMIT 1;

    SELECT id, seat_number INTO v_initiator_seat_id, v_initiator_seat_label
    FROM public.seats
    WHERE layout_id = v_layout_id AND locked_by = v_initiator_user_id AND status = 'sold';

    SELECT id, seat_number INTO v_target_seat_id, v_target_seat_label
    FROM public.seats
    WHERE layout_id = v_layout_id AND locked_by = v_target_user_id AND status = 'sold';

    -- Lock seats
    IF v_initiator_seat_id IS NOT NULL AND v_target_seat_id IS NOT NULL THEN
        IF v_initiator_seat_id < v_target_seat_id THEN
            PERFORM 1 FROM public.seats WHERE id = v_initiator_seat_id FOR UPDATE;
            PERFORM 1 FROM public.seats WHERE id = v_target_seat_id FOR UPDATE;
        ELSE
            PERFORM 1 FROM public.seats WHERE id = v_target_seat_id FOR UPDATE;
            PERFORM 1 FROM public.seats WHERE id = v_initiator_seat_id FOR UPDATE;
        END IF;

        -- Swap seat users
        UPDATE public.seats SET locked_by = v_target_user_id WHERE id = v_initiator_seat_id;
        UPDATE public.seats SET locked_by = v_initiator_user_id WHERE id = v_target_seat_id;
    END IF;

    -- Swap event_seats table reserved_by too if used
    UPDATE public.event_seats SET reserved_by = v_target_user_id WHERE event_id = v_event_id AND label = v_initiator_seat_label;
    UPDATE public.event_seats SET reserved_by = v_initiator_user_id WHERE event_id = v_event_id AND label = v_target_seat_label;

    -- 5. Regenerate QR code hashes
    v_new_qr_initiator := encode(gen_random_bytes(16), 'hex');
    v_new_qr_target := encode(gen_random_bytes(16), 'hex');

    -- Swap ticket user owners and invalidate old QR codes
    UPDATE public.event_rsvps
    SET user_id = v_target_user_id,
        qr_code_hash = v_new_qr_initiator,
        rsvp_at = NOW()
    WHERE id = v_request.initiator_ticket_id;

    UPDATE public.event_rsvps
    SET user_id = v_initiator_user_id,
        qr_code_hash = v_new_qr_target,
        rsvp_at = NOW()
    WHERE id = v_request.target_ticket_id;

    -- 6. Update request status to accepted
    UPDATE public.seat_swap_requests
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Cancel all other pending swap requests involving these tickets
    UPDATE public.seat_swap_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id IS DISTINCT FROM p_request_id
      AND status = 'pending'
      AND (initiator_ticket_id = v_request.initiator_ticket_id 
        OR target_ticket_id = v_request.initiator_ticket_id
        OR initiator_ticket_id = v_request.target_ticket_id
        OR target_ticket_id = v_request.target_ticket_id);

    -- 7. Notify initiator
    PERFORM public.queue_or_send_notification(
        p_user_id => v_initiator_user_id,
        p_notification_type => 'seat_swap_accepted',
        p_title => 'Seat Swap Accepted',
        p_message => 'Your seat swap request for Seat ' || COALESCE(v_target_seat_label, 'your requested seat') || ' has been accepted!',
        p_link => '/events/' || v_event_id || '/ticket',
        p_entity_id => p_request_id,
        p_entity_type => 'seat_swap_request',
        p_actor_id => auth.uid()
    );

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_seat_swap(UUID) TO authenticated;

-- 4. Function to reject a seat swap
CREATE OR REPLACE FUNCTION public.reject_seat_swap(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_target_user_id UUID;
    v_initiator_user_id UUID;
    v_event_id UUID;
BEGIN
    SELECT * INTO v_request
    FROM public.seat_swap_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    -- Check permission
    SELECT user_id, event_id INTO v_target_user_id, v_event_id
    FROM public.event_rsvps
    WHERE id = v_request.target_ticket_id;

    IF v_target_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to reject this swap.';
    END IF;

    UPDATE public.seat_swap_requests
    SET status = 'rejected',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Notify initiator
    SELECT user_id INTO v_initiator_user_id
    FROM public.event_rsvps
    WHERE id = v_request.initiator_ticket_id;

    PERFORM public.queue_or_send_notification(
        p_user_id => v_initiator_user_id,
        p_notification_type => 'seat_swap_rejected',
        p_title => 'Seat Swap Rejected',
        p_message => 'Your seat swap request has been declined.',
        p_link => '/events/' || v_event_id,
        p_entity_id => p_request_id,
        p_entity_type => 'seat_swap_request',
        p_actor_id => auth.uid()
    );

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_seat_swap(UUID) TO authenticated;

-- 5. Function to cancel a seat swap
CREATE OR REPLACE FUNCTION public.cancel_seat_swap(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_initiator_user_id UUID;
BEGIN
    SELECT * INTO v_request
    FROM public.seat_swap_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    -- Check permission
    SELECT user_id INTO v_initiator_user_id
    FROM public.event_rsvps
    WHERE id = v_request.initiator_ticket_id;

    IF v_initiator_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to cancel this swap.';
    END IF;

    UPDATE public.seat_swap_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_seat_swap(UUID) TO authenticated;
