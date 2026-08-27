-- Algorithmic Waitlist Churn Prediction (#3233)
-- The model is intentionally a transparent heuristic, not a guarantee of attendance.

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.touch_event_rsvp_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_status_changed_at ON public.event_rsvps;
CREATE TRIGGER event_rsvps_status_changed_at
BEFORE INSERT OR UPDATE OF status ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.touch_event_rsvp_status_changed_at();

CREATE INDEX IF NOT EXISTS idx_event_rsvps_churn_status_time
  ON public.event_rsvps (event_id, status, status_changed_at);

CREATE OR REPLACE FUNCTION public.predict_event_churn(
  p_event_id UUID,
  p_weather_modifier NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_similar_count INTEGER := 0;
  v_base_capacity INTEGER := 100;
  v_waitlist_count INTEGER := 0;
  v_expected_dropouts NUMERIC := 0;
  v_weather_modifier NUMERIC := GREATEST(-0.50, LEAST(0.75, COALESCE(p_weather_modifier, 0)));
  v_target_hour INTEGER;
  v_target_tags TEXT[];
  v_is_free BOOLEAN;
  v_matrix JSONB;
BEGIN
  SELECT
    e.id,
    e.start_date,
    COALESCE(e.capacity, e.max_attendees, e.venue_capacity, 100)::INTEGER AS capacity,
    COALESCE(e.is_free, COALESCE(e.price, 0) = 0, TRUE) AS is_free,
    COALESCE(e.tags, '{}'::TEXT[]) AS tags
  INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.events e
    LEFT JOIN public.clubs c ON c.id = e.club_id
    WHERE e.id = p_event_id
      AND (e.created_by = auth.uid() OR c.created_by = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only event organizers can view churn predictions';
  END IF;

  v_base_capacity := GREATEST(1, v_event.capacity);
  v_target_hour := EXTRACT(HOUR FROM v_event.start_date)::INTEGER;
  v_target_tags := v_event.tags;
  v_is_free := v_event.is_free;

  WITH similar_events AS (
    SELECT e.id, e.start_date, GREATEST(1, COALESCE(e.capacity, e.max_attendees, e.venue_capacity, 100))::NUMERIC AS capacity
    FROM public.events e
    WHERE e.id <> p_event_id
      AND e.start_date < NOW()
      AND COALESCE(e.is_free, COALESCE(e.price, 0) = 0, TRUE) = v_is_free
      AND ABS(EXTRACT(HOUR FROM e.start_date)::INTEGER - v_target_hour) <= 2
      AND (cardinality(v_target_tags) = 0 OR EXISTS (SELECT 1 FROM unnest(COALESCE(e.tags, '{}'::TEXT[])) AS tag WHERE tag = ANY(v_target_tags)))
    ORDER BY e.start_date DESC
    LIMIT 10
  ),
  per_event AS (
    SELECT
      se.id,
      se.capacity,
      COUNT(r.id) FILTER (WHERE COALESCE(r.status, 'attending') NOT IN ('rejected', 'waitlisted'))::NUMERIC AS registered_count,
      COUNT(r.id) FILTER (WHERE r.status = 'cancelled' AND r.status_changed_at <= se.start_date - INTERVAL '48 hours')::NUMERIC AS at_48h,
      COUNT(r.id) FILTER (WHERE r.status = 'cancelled' AND r.status_changed_at > se.start_date - INTERVAL '48 hours' AND r.status_changed_at <= se.start_date - INTERVAL '24 hours')::NUMERIC AS at_24h,
      COUNT(r.id) FILTER (WHERE r.status = 'cancelled' AND r.status_changed_at > se.start_date - INTERVAL '24 hours' AND r.status_changed_at <= se.start_date - INTERVAL '2 hours')::NUMERIC AS at_2h,
      COUNT(r.id) FILTER (WHERE r.status = 'cancelled' AND r.status_changed_at > se.start_date - INTERVAL '2 hours')::NUMERIC AS after_2h
    FROM similar_events se
    LEFT JOIN public.event_rsvps r ON r.event_id = se.id
    GROUP BY se.id, se.capacity
  ),
  rates AS (
    SELECT
      COALESCE(AVG(at_48h / NULLIF(registered_count, 0)), 0.05)::NUMERIC AS rate_48h,
      COALESCE(AVG(at_24h / NULLIF(registered_count, 0)), 0.07)::NUMERIC AS rate_24h,
      COALESCE(AVG(at_2h / NULLIF(registered_count, 0)), 0.04)::NUMERIC AS rate_2h,
      COALESCE(AVG(after_2h / NULLIF(registered_count, 0)), 0.02)::NUMERIC AS rate_after_2h,
      COUNT(*)::INTEGER AS sample_count
    FROM per_event
    WHERE registered_count > 0
  )
  SELECT
    sample_count,
    LEAST(0.95, GREATEST(0, rate_48h + rate_24h + rate_2h + rate_after_2h + v_weather_modifier)) * v_base_capacity,
    jsonb_build_array(
      jsonb_build_object('hours_before_event', 168, 'predicted_churn_rate', 0, 'predicted_churn_count', 0),
      jsonb_build_object('hours_before_event', 72, 'predicted_churn_rate', ROUND(rate_48h * 100, 2), 'predicted_churn_count', ROUND(rate_48h * v_base_capacity)),
      jsonb_build_object('hours_before_event', 48, 'predicted_churn_rate', ROUND((rate_48h + rate_24h) * 100, 2), 'predicted_churn_count', ROUND((rate_48h + rate_24h) * v_base_capacity)),
      jsonb_build_object('hours_before_event', 24, 'predicted_churn_rate', ROUND((rate_48h + rate_24h + rate_2h) * 100, 2), 'predicted_churn_count', ROUND((rate_48h + rate_24h + rate_2h) * v_base_capacity)),
      jsonb_build_object('hours_before_event', 2, 'predicted_churn_rate', ROUND((rate_48h + rate_24h + rate_2h + rate_after_2h) * 100, 2), 'predicted_churn_count', ROUND((rate_48h + rate_24h + rate_2h + rate_after_2h) * v_base_capacity)),
      jsonb_build_object('hours_before_event', 0, 'predicted_churn_rate', ROUND(LEAST(0.95, GREATEST(0, rate_48h + rate_24h + rate_2h + rate_after_2h + v_weather_modifier)) * 100, 2), 'predicted_churn_count', ROUND(LEAST(0.95, GREATEST(0, rate_48h + rate_24h + rate_2h + rate_after_2h + v_weather_modifier)) * v_base_capacity))
    )
  INTO v_similar_count, v_expected_dropouts, v_matrix
  FROM rates;

  SELECT COUNT(*)::INTEGER
  INTO v_waitlist_count
  FROM public.event_rsvps
  WHERE event_id = p_event_id AND status = 'waitlisted';

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'capacity', v_base_capacity,
    'waitlist_count', v_waitlist_count,
    'similar_event_count', COALESCE(v_similar_count, 0),
    'expected_no_shows', ROUND(v_expected_dropouts),
    'recommended_overbook_capacity', LEAST(v_base_capacity + v_waitlist_count, v_base_capacity + ROUND(v_expected_dropouts)),
    'weather_modifier', v_weather_modifier,
    'assumption', 'This forecast assumes normal conditions and historical behavior. Severe weather, transportation disruption, or unusual event changes can invalidate it.',
    'prediction_matrix', v_matrix,
    'actual_matrix', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hours_before_event', bucket.hours_before_event, 'actual_churn_count', bucket.actual_count) ORDER BY bucket.hours_before_event DESC)
      FROM (
        VALUES
          (168, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at <= v_event.start_date - INTERVAL '168 hours')),
          (72, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at > v_event.start_date - INTERVAL '168 hours' AND r.status_changed_at <= v_event.start_date - INTERVAL '72 hours')),
          (48, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at > v_event.start_date - INTERVAL '72 hours' AND r.status_changed_at <= v_event.start_date - INTERVAL '48 hours')),
          (24, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at > v_event.start_date - INTERVAL '48 hours' AND r.status_changed_at <= v_event.start_date - INTERVAL '24 hours')),
          (2, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at > v_event.start_date - INTERVAL '24 hours' AND r.status_changed_at <= v_event.start_date - INTERVAL '2 hours')),
          (0, (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = p_event_id AND r.status = 'cancelled' AND r.status_changed_at > v_event.start_date - INTERVAL '2 hours'))
      ) AS bucket(hours_before_event, actual_count)
    ), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.predict_event_churn(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.predict_event_churn(UUID, NUMERIC) TO authenticated, service_role;
COMMENT ON FUNCTION public.predict_event_churn(UUID, NUMERIC) IS 'Transparent historical waitlist churn heuristic for organizer capacity planning. Not a guarantee.';

NOTIFY pgrst, 'reload schema';
