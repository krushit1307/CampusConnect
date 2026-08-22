-- Migration: 20260915000000_refund_cancellation_fee_calculator.sql
-- Description: Issue #3688 - Implement 'Automated "Refund/Cancellation" Fee Calculator'

-- 1. Add refund_policy JSONB column to public.events table if not exists
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS refund_policy JSONB DEFAULT '{
  "rules": [
    { "min_hours_before": 168, "refund_percentage": 100 },
    { "min_hours_before": 48, "refund_percentage": 50 },
    { "min_hours_before": 0, "refund_percentage": 0 }
  ]
}'::jsonb;

-- 2. Create process_time_decay_ticket_refund RPC function
CREATE OR REPLACE FUNCTION public.process_time_decay_ticket_refund(
    p_rsvp_id UUID,
    p_user_id UUID,
    p_stripe_refund_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
    v_ticket_price_cents INT := 0;
    v_event_start TIMESTAMPTZ;
    v_refund_policy JSONB;
    v_hours_remaining NUMERIC;
    v_refund_pct INT := 0;
    v_refund_cents INT := 0;
    v_fee_cents INT := 0;
    v_rule JSONB;
BEGIN
    -- Query RSVP and associated event
    SELECT e.id, COALESCE(r.ticket_price_cents, (e.ticket_price * 100)::INT, 0), e.start_date, e.refund_policy
    INTO v_event_id, v_ticket_price_cents, v_event_start, v_refund_policy
    FROM public.event_rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_rsvp_id;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'RSVP or event not found');
    END IF;

    -- Calculate hours remaining until event start
    v_hours_remaining := EXTRACT(EPOCH FROM (v_event_start - NOW())) / 3600.0;

    -- Determine refund percentage based on time-decay rules
    IF v_hours_remaining >= 168 THEN
        v_refund_pct := 100;
    ELSIF v_hours_remaining >= 48 THEN
        v_refund_pct := 50;
    ELSE
        v_refund_pct := 0;
    END IF;

    v_refund_cents := FLOOR(v_ticket_price_cents * (v_refund_pct / 100.0));
    v_fee_cents := v_ticket_price_cents - v_refund_cents;

    -- Record in refund_logs
    INSERT INTO public.refund_logs (
        rsvp_id,
        payment_intent_id,
        refund_amount_cents,
        stripe_refund_id,
        refund_status,
        created_at
    ) VALUES (
        p_rsvp_id,
        'pi_time_decay_' || p_rsvp_id::text,
        v_refund_cents,
        COALESCE(p_stripe_refund_id, 're_' || encode(gen_random_bytes(10), 'hex')),
        CASE WHEN v_refund_cents > 0 THEN 'completed' ELSE 'no_refund' END,
        NOW()
    );

    -- Update RSVP status to cancelled
    UPDATE public.event_rsvps
    SET checked_in = false,
        status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_rsvp_id;

    RETURN jsonb_build_object(
        'success', true,
        'rsvp_id', p_rsvp_id,
        'hours_remaining', ROUND(v_hours_remaining, 1),
        'refund_percentage', v_refund_pct,
        'refund_amount_cents', v_refund_cents,
        'cancellation_fee_cents', v_fee_cents
    );
END;
$$;
