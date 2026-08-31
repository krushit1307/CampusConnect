-- Migration: 20261215200000_peer_to_peer_ticket_transfer_engine.sql
-- Description: Secure P2P ticket transfer engine with ownership checks, event start time checks, free ticket restrictions, and notification alerts.

-- 1. Drop existing obsolete transfer_ticket_transaction functions to prevent signature collisions
DROP FUNCTION IF EXISTS public.transfer_ticket_transaction(UUID, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.transfer_ticket_transaction(UUID, UUID, TEXT);

-- 2. Define the new robust P2P transfer function
CREATE OR REPLACE FUNCTION public.transfer_ticket_transaction(
    p_ticket_id UUID,
    p_sender_id UUID,
    p_recipient_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_recipient_id UUID;
    v_event_id UUID;
    v_event_title TEXT;
    v_event_start TIMESTAMPTZ;
    v_paid_amount_cents INTEGER;
    v_sender_name TEXT;
    v_log_id UUID;
BEGIN
    -- A. Resolve recipient user profile from email
    SELECT id INTO v_recipient_id
    FROM public.profiles
    WHERE email = p_recipient_email;

    IF v_recipient_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Recipient email not found on the platform.');
    END IF;

    -- Prevent transferring to oneself
    IF v_recipient_id = p_sender_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot transfer a ticket to yourself.');
    END IF;

    -- B. Fetch sender display name for notification alerts
    SELECT COALESCE(full_name, first_name || ' ' || last_name, 'Another user') INTO v_sender_name
    FROM public.profiles
    WHERE id = p_sender_id;

    -- C. Fetch event details, start date, and ticket pricing details
    SELECT er.event_id, e.title, e.start_date, er.paid_amount_cents
    INTO v_event_id, v_event_title, v_event_start, v_paid_amount_cents
    FROM public.event_rsvps er
    JOIN public.events e ON e.id = er.event_id
    WHERE (er.id = p_ticket_id OR er.ticket_id = p_ticket_id) AND er.user_id = p_sender_id;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found or you do not own this ticket.');
    END IF;

    -- D. Check if event has already started
    IF v_event_start <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot transfer tickets for events that have already started.');
    END IF;

    -- E. Restrict transferring free tickets (anti-scalping hoarding constraint)
    IF v_paid_amount_cents IS NULL OR v_paid_amount_cents <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Free tickets cannot be transferred to prevent off-platform scalper hoarding.');
    END IF;

    -- F. Reassign ticket/RSVP row ownership from Alex to Sarah
    UPDATE public.event_rsvps
    SET user_id = v_recipient_id,
        rsvp_at = NOW()
    WHERE (id = p_ticket_id OR ticket_id = p_ticket_id) AND user_id = p_sender_id;

    -- G. Log transaction into ticket_transfer_logs
    INSERT INTO public.ticket_transfer_logs (ticket_id, sender_id, recipient_email, status)
    VALUES (p_ticket_id, p_sender_id, p_recipient_email, 'ACCEPTED')
    RETURNING id INTO v_log_id;

    -- H. Dispatch notification alert to recipient: "Alex transferred a ticket to you!"
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
        v_recipient_id,
        'ticket_transfer',
        'Ticket Transferred to You',
        v_sender_name || ' transferred a ticket for "' || v_event_title || '" to you!',
        '/dashboard/rsvps'
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ticket transferred successfully!',
        'recipient_id', v_recipient_id,
        'event_id', v_event_id,
        'transfer_log_id', v_log_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
