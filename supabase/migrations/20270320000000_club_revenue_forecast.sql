-- Issue #4254: Dynamic Club Revenue Forecasting Tool.
-- RSVP timestamps are the canonical ticket-sale timestamps. No new client-supplied
-- financial totals are trusted by the forecasting RPC.

CREATE INDEX IF NOT EXISTS idx_event_rsvps_forecast_sales
  ON public.event_rsvps (event_id, rsvp_at)
  WHERE paid_amount_cents IS NOT NULL AND paid_amount_cents > 0;

CREATE OR REPLACE FUNCTION public.get_club_revenue_forecast(
  p_club_id UUID,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_user_id UUID := auth.uid();
  v_days_remaining INTEGER;
  v_days_since_first_sale INTEGER;
  v_current_days_out INTEGER;
  v_current_sold INTEGER := 0;
  v_current_revenue_cents BIGINT := 0;
  v_average_ticket_price_cents NUMERIC := 0;
  v_break_even_cents BIGINT := 0;
  v_historical_curve_percent NUMERIC;
  v_velocity_per_day NUMERIC := 0;
  v_projected_tickets INTEGER := 0;
  v_projected_revenue_cents BIGINT := 0;
  v_sales_curve JSONB;
  v_historical_curve JSONB;
  v_capacity INTEGER;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_club_permission(p_club_id, v_user_id, 'budget.read') THEN
    RAISE EXCEPTION 'Only authorized club treasurers and administrators can view revenue forecasts.' USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.title, e.event_date, e.status
  INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id AND e.club_id = p_club_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found for this club.' USING ERRCODE = 'P0002'; END IF;
  IF v_event.event_date IS NULL THEN RAISE EXCEPTION 'The event needs a date before revenue can be forecast.' USING ERRCODE = '22023'; END IF;
  IF v_event.event_date <= NOW() THEN RAISE EXCEPTION 'Only upcoming events have an active revenue forecast.' USING ERRCODE = '22023'; END IF;
  IF COALESCE(v_event.status, '') IN ('cancelled', 'canceled') THEN RAISE EXCEPTION 'Cancelled events do not have an active revenue forecast.' USING ERRCODE = '22023'; END IF;

  SELECT CASE
    WHEN COUNT(*) = 0 OR BOOL_OR(tt.capacity IS NULL) THEN 0
    ELSE COALESCE(SUM(tt.capacity), 0)::INTEGER
  END
  INTO v_capacity
  FROM public.ticket_tiers tt
  WHERE tt.event_id = p_event_id;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(r.paid_amount_cents), 0)::BIGINT
  INTO v_current_sold, v_current_revenue_cents
  FROM public.event_rsvps r
  WHERE r.event_id = p_event_id
    AND r.rsvp_at <= NOW()
    AND r.paid_amount_cents IS NOT NULL
    AND r.paid_amount_cents > 0
    AND COALESCE(r.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded');

  SELECT COALESCE(AVG(tt.price), 0)::NUMERIC
  INTO v_average_ticket_price_cents
  FROM public.ticket_tiers tt
  WHERE tt.event_id = p_event_id AND tt.price > 0;

  IF v_current_sold > 0 THEN
    -- Paid RSVP amounts are the realized price, including flash-sale/discounted tickets.
    v_average_ticket_price_cents := v_current_revenue_cents::NUMERIC / v_current_sold;
  END IF;

  SELECT ROUND(COALESCE(SUM(ef.amount) FILTER (WHERE ef.type = 'expense'), 0) * 100)::BIGINT
  INTO v_break_even_cents
  FROM public.event_financial_transactions ef
  WHERE ef.event_id = p_event_id;

  v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_event.event_date - NOW())) / 86400)::INTEGER);
  v_current_days_out := v_days_remaining;

  SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - MIN(r.rsvp_at))) / 86400)::INTEGER)
  INTO v_days_since_first_sale
  FROM public.event_rsvps r
  WHERE r.event_id = p_event_id
    AND r.rsvp_at <= NOW()
    AND r.paid_amount_cents IS NOT NULL
    AND r.paid_amount_cents > 0
    AND COALESCE(r.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded');

  SELECT COALESCE(AVG(historical_snapshot.sold_at_current_offset::NUMERIC / NULLIF(historical_snapshot.final_sold, 0)), 0)
  INTO v_historical_curve_percent
  FROM (
    SELECT he.id,
      (SELECT COUNT(*) FROM public.event_rsvps hr
       WHERE hr.event_id = he.id
         AND hr.rsvp_at <= he.event_date - (v_current_days_out * INTERVAL '1 day')
         AND hr.paid_amount_cents IS NOT NULL AND hr.paid_amount_cents > 0
         AND COALESCE(hr.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')) AS sold_at_current_offset,
      (SELECT COUNT(*) FROM public.event_rsvps hr
       WHERE hr.event_id = he.id
         AND hr.rsvp_at <= he.event_date
         AND hr.paid_amount_cents IS NOT NULL AND hr.paid_amount_cents > 0
         AND COALESCE(hr.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')) AS final_sold
    FROM public.events he
    WHERE he.club_id = p_club_id
      AND he.id <> p_event_id
      AND he.event_date IS NOT NULL
      AND he.event_date < NOW()
      AND COALESCE(he.status, '') NOT IN ('cancelled', 'canceled')
  ) historical_snapshot
  WHERE historical_snapshot.final_sold > 0;

  IF v_current_sold > 0 AND v_historical_curve_percent > 0 THEN
    v_projected_tickets := CEIL(v_current_sold / v_historical_curve_percent)::INTEGER;
  ELSIF v_current_sold > 0 THEN
    v_velocity_per_day := v_current_sold::NUMERIC / GREATEST(1, v_days_since_first_sale);
    v_projected_tickets := CEIL(v_current_sold + (v_velocity_per_day * v_days_remaining))::INTEGER;
  END IF;

  IF v_capacity > 0 THEN v_projected_tickets := LEAST(v_projected_tickets, v_capacity); END IF;
  v_projected_tickets := GREATEST(v_projected_tickets, v_current_sold);
  v_projected_revenue_cents := ROUND(v_projected_tickets * v_average_ticket_price_cents)::BIGINT;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sale_date', sale_day,
    'tickets_sold', tickets_sold,
    'revenue_cents', revenue_cents
  ) ORDER BY sale_day), '[]'::jsonb)
  INTO v_sales_curve
  FROM (
    SELECT DATE_TRUNC('day', r.rsvp_at)::DATE AS sale_day,
           COUNT(*)::INTEGER AS tickets_sold,
           COALESCE(SUM(r.paid_amount_cents), 0)::BIGINT AS revenue_cents
    FROM public.event_rsvps r
    WHERE r.event_id = p_event_id
      AND r.rsvp_at <= NOW()
      AND r.paid_amount_cents IS NOT NULL AND r.paid_amount_cents > 0
      AND COALESCE(r.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')
    GROUP BY DATE_TRUNC('day', r.rsvp_at)::DATE
  ) daily_sales;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'days_before_event', days_before_event,
    'average_percent_sold', ROUND(average_percent_sold * 100, 1)
  ) ORDER BY days_before_event DESC), '[]'::jsonb)
  INTO v_historical_curve
  FROM (
    SELECT offset_days AS days_before_event,
      AVG(snapshot.sold_at_offset::NUMERIC / NULLIF(snapshot.final_sold, 0)) AS average_percent_sold
    FROM generate_series(0, 30, 1) AS offsets(offset_days)
    CROSS JOIN LATERAL (
      SELECT
        (SELECT COUNT(*) FROM public.event_rsvps hr
         WHERE hr.event_id = he.id
           AND hr.rsvp_at <= he.event_date - (offsets.offset_days * INTERVAL '1 day')
           AND hr.paid_amount_cents IS NOT NULL AND hr.paid_amount_cents > 0
           AND COALESCE(hr.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')) AS sold_at_offset,
        (SELECT COUNT(*) FROM public.event_rsvps hr
         WHERE hr.event_id = he.id
           AND hr.rsvp_at <= he.event_date
           AND hr.paid_amount_cents IS NOT NULL AND hr.paid_amount_cents > 0
           AND COALESCE(hr.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')) AS final_sold
      FROM public.events he
      WHERE he.club_id = p_club_id
        AND he.id <> p_event_id
        AND he.event_date IS NOT NULL
        AND he.event_date < NOW()
        AND COALESCE(he.status, '') NOT IN ('cancelled', 'canceled')
    ) snapshot
    WHERE snapshot.final_sold > 0
    GROUP BY offset_days
  ) curve;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'event_title', v_event.title,
    'event_date', v_event.event_date,
    'current_sold_tickets', v_current_sold,
    'current_revenue_cents', v_current_revenue_cents,
    'ticket_capacity', v_capacity,
    'average_ticket_price_cents', ROUND(v_average_ticket_price_cents)::BIGINT,
    'break_even_cents', v_break_even_cents,
    'projected_final_tickets', v_projected_tickets,
    'projected_final_revenue_cents', v_projected_revenue_cents,
    'projected_variance_cents', v_projected_revenue_cents - v_break_even_cents,
    'days_until_event', v_days_remaining,
    'historical_curve_percent_at_current_offset', ROUND(COALESCE(v_historical_curve_percent, 0) * 100, 1),
    'historical_event_count', (
      SELECT COUNT(*)
      FROM public.events he
      WHERE he.club_id = p_club_id
        AND he.id <> p_event_id
        AND he.event_date IS NOT NULL
        AND he.event_date < NOW()
        AND COALESCE(he.status, '') NOT IN ('cancelled', 'canceled')
        AND EXISTS (
          SELECT 1
          FROM public.event_rsvps hr
          WHERE hr.event_id = he.id
            AND hr.rsvp_at <= he.event_date
            AND hr.paid_amount_cents IS NOT NULL
            AND hr.paid_amount_cents > 0
            AND COALESCE(hr.status, 'attending') NOT IN ('cancelled', 'canceled', 'refunded')
        )
    ),
    'sales_curve', v_sales_curve,
    'historical_curve', v_historical_curve
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_revenue_forecast(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.get_club_revenue_forecast(UUID, UUID) IS
  'Treasurer-only revenue forecast using immutable RSVP sale timestamps, historical club sales curves, ticket prices, and event expenses.';
