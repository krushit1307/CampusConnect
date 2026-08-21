-- Migration: 20260830000000_ticket_refund_pipeline.sql
-- Description: Adds columns for ticket payments, creates refund_logs table, and implements process_ticket_refund transaction RPC.

-- 1. Add payment columns to event_rsvps and rsvps tables
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rsvps') THEN
        ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
        ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER;
        ALTER TABLE public.rsvps ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
    END IF;
END $$;

-- 2. Create refund_logs table for audit tracking
CREATE TABLE IF NOT EXISTS public.refund_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    payment_intent_id TEXT NOT NULL,
    refund_amount_cents INTEGER NOT NULL,
    stripe_refund_id TEXT NOT NULL,
    refund_status TEXT NOT NULL,
    refunded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.refund_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own refund logs
CREATE POLICY "Users can view their own refund logs" 
ON public.refund_logs 
FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.event_rsvps r
        WHERE r.id = refund_logs.rsvp_id AND r.user_id = auth.uid()
    )
);

-- Allow service_role full control
CREATE POLICY "Service role has full access to refund logs" 
ON public.refund_logs 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 3. Atomic Postgres Transaction function for processing ticket refunds
CREATE OR REPLACE FUNCTION public.process_ticket_refund(
    p_rsvp_id UUID,
    p_payment_intent_id TEXT,
    p_refund_amount_cents INTEGER,
    p_stripe_refund_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_user_id UUID;
    v_status TEXT;
    v_event_title TEXT;
    v_event_creator UUID;
BEGIN
    -- A. Lock and retrieve RSVP details
    SELECT event_id, user_id, status INTO v_event_id, v_user_id, v_status
    FROM public.event_rsvps
    WHERE id = p_rsvp_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RSVP record not found.';
    END IF;

    -- Retrieve event details (title and creator) for notification
    SELECT title, created_by INTO v_event_title, v_event_creator
    FROM public.events
    WHERE id = v_event_id;

    -- B. Update RSVP status to cancelled
    UPDATE public.event_rsvps
    SET status = 'cancelled',
        stripe_refund_id = p_stripe_refund_id,
        updated_at = NOW()
    WHERE id = p_rsvp_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rsvps') THEN
        UPDATE public.rsvps
        SET status = 'cancelled',
            stripe_refund_id = p_stripe_refund_id,
            updated_at = NOW()
        WHERE id = p_rsvp_id;
    END IF;

    -- C. Insert record into refund_logs
    INSERT INTO public.refund_logs (rsvp_id, payment_intent_id, refund_amount_cents, stripe_refund_id, refund_status)
    VALUES (p_rsvp_id, p_payment_intent_id, p_refund_amount_cents, p_stripe_refund_id, 'succeeded');

    -- D. Replenish available spots on the event
    UPDATE public.events
    SET available_spots = COALESCE(available_spots, max_attendees) + 1
    WHERE id = v_event_id;

    -- E. Insert notifications for user and event organizer
    -- User Notification
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_user_id,
        'ticket_cancelled',
        'Ticket Cancelled & Refunded',
        'Your ticket cancellation for "' || v_event_title || '" has been processed. A refund of $' || LTRIM(TO_CHAR(p_refund_amount_cents / 100.0, '999990.00')) || ' was sent.'
    );

    -- Organizer Notification
    IF v_event_creator IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (
            v_event_creator,
            'ticket_cancelled',
            'Ticket Cancelled by Student',
            'A student cancelled their ticket for your event "' || v_event_title || '". The ticket slot has been replenished.'
        );
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_ticket_refund(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_ticket_refund(UUID, TEXT, INTEGER, TEXT) TO service_role;
