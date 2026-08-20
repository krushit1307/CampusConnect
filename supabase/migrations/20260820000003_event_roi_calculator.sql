-- Issue #3323: Event ROI / P&L calculator for treasurers.
-- Ticket revenue is sourced from paid event_rsvps, refunds from refund_logs,
-- and approved expenses from expense_reimbursements.

CREATE OR REPLACE FUNCTION public.calculate_event_roi(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_club_id UUID;
    v_event_title TEXT;
    v_is_treasurer BOOLEAN;
    v_ticket_sales_cents BIGINT := 0;
    v_stripe_fees_cents BIGINT := 0;
    v_refunds_cents BIGINT := 0;
    v_expenses_cents BIGINT := 0;
    v_ticket_count BIGINT := 0;
    v_net_revenue_cents BIGINT := 0;
    v_net_profit_cents BIGINT := 0;
    v_margin NUMERIC := 0;
BEGIN
    SELECT e.host_club_id, e.title
    INTO v_host_club_id, v_event_title
    FROM public.events e
    WHERE e.id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = v_host_club_id
          AND cm.user_id = auth.uid()
          AND LOWER(cm.role::text) IN ('treasurer', 'president', 'admin')
    )
    INTO v_is_treasurer;

    IF NOT v_is_treasurer THEN
        RAISE EXCEPTION 'Only event treasurers or club executives can calculate event ROI';
    END IF;

    -- Stripe's standard card pricing is used when the payment processor fee is
    -- not persisted separately: 2.9% + $0.30 per successful ticket payment.
    -- Keep the constants here so the calculation is auditable and easy to update
    -- if the connected Stripe account uses a different pricing plan.
    SELECT
        COALESCE(SUM(er.paid_amount_cents), 0),
        COALESCE(SUM(ROUND(er.paid_amount_cents * 0.029) + 30), 0),
        COUNT(*)
    INTO v_ticket_sales_cents, v_stripe_fees_cents, v_ticket_count
    FROM public.event_rsvps er
    WHERE er.event_id = p_event_id
      AND er.status = 'PAID'
      AND er.paid_amount_cents IS NOT NULL
      AND er.paid_amount_cents > 0;

    SELECT COALESCE(SUM(rl.refund_amount_cents), 0)
    INTO v_refunds_cents
    FROM public.refund_logs rl
    JOIN public.event_rsvps er ON er.id = rl.rsvp_id
    WHERE er.event_id = p_event_id
      AND rl.refund_status = 'succeeded';

    SELECT COALESCE(SUM(er.amount_cents), 0)
    INTO v_expenses_cents
    FROM public.expense_reimbursements er
    WHERE er.club_id = v_host_club_id
      AND er.status IN ('approved_treasurer', 'approved_dual', 'paid');

    v_net_revenue_cents := v_ticket_sales_cents - v_stripe_fees_cents - v_refunds_cents;
    v_net_profit_cents := v_net_revenue_cents - v_expenses_cents;

    IF v_net_revenue_cents <> 0 THEN
        v_margin := ROUND((v_net_profit_cents::NUMERIC / v_net_revenue_cents::NUMERIC) * 100, 2);
    END IF;

    RETURN jsonb_build_object(
        'event_id', p_event_id,
        'event_title', v_event_title,
        'ticket_count', v_ticket_count,
        'ticket_sales_cents', v_ticket_sales_cents,
        'stripe_fees_cents', v_stripe_fees_cents,
        'refunds_cents', v_refunds_cents,
        'net_revenue_cents', v_net_revenue_cents,
        'total_expenses_cents', v_expenses_cents,
        'net_profit_cents', v_net_profit_cents,
        'margin_percent', v_margin,
        'stripe_fee_model', '2.9% + $0.30 per successful ticket payment'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_event_roi(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_event_roi(UUID) TO authenticated;
