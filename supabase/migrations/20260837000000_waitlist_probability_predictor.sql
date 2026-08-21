-- Migration: 20260837000000_waitlist_probability_predictor.sql
-- Description: Algorithmic Waitlist Capacity Predictor RPC with new club global fallback (#2980)

CREATE OR REPLACE FUNCTION public.calculate_waitlist_probability(
  p_event_id UUID,
  p_user_position INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
  v_capacity INT := 100;
  v_is_free BOOLEAN := true;
  v_past_event_count INT := 0;
  v_historical_dropout_rate NUMERIC := 0.20;
  v_is_fallback BOOLEAN := false;
  v_estimated_dropouts INT := 0;
  v_probability NUMERIC := 50;
  v_tier TEXT := 'Medium';
  v_user_pos INT := GREATEST(1, COALESCE(p_user_position, 1));
BEGIN
  -- Fetch target event details
  SELECT
    club_id,
    COALESCE(capacity, 100),
    COALESCE(is_free, true)
  INTO
    v_club_id,
    v_capacity,
    v_is_free
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    -- Fallback for unrecorded event ID
    v_capacity := 100;
    v_is_free := true;
  END IF;

  -- Count past events for hosting club to evaluate history
  IF v_club_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_past_event_count
    FROM public.events
    WHERE club_id = v_club_id AND start_date < NOW();
  END IF;

  -- Historical Dropout Rate Calculation or Global Campus Fallback (#2980)
  IF v_past_event_count >= 2 THEN
    -- Calculate actual historic dropout rate for host club
    SELECT COALESCE(
      AVG(
        CASE
          WHEN total_registered > 0 THEN (cancelled_count::numeric / total_registered::numeric)
          ELSE 0.20
        END
      ), 0.20)
    INTO v_historical_dropout_rate
    FROM (
      SELECT
        e.id,
        COUNT(r.id) AS total_registered,
        COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS cancelled_count
      FROM public.events e
      LEFT JOIN public.event_rsvps r ON r.event_id = e.id
      WHERE e.club_id = v_club_id AND e.start_date < NOW()
      GROUP BY e.id
    ) sub;
    v_is_fallback := false;
  ELSE
    -- Global Campus Category Fallback for new clubs (#2980)
    -- Paid events have low ~3% dropouts; Free events have ~20%-25% dropouts
    IF v_is_free = false THEN
      v_historical_dropout_rate := 0.03; -- 3% dropout for paid events
    ELSE
      v_historical_dropout_rate := 0.22; -- 22% average dropout for free campus events
    END IF;
    v_is_fallback := true;
  END IF;

  -- Estimate expected dropouts
  v_estimated_dropouts := GREATEST(1, CEIL(v_capacity * v_historical_dropout_rate));

  -- Algorithmic admission probability calculation (#2980)
  IF v_user_pos <= v_estimated_dropouts THEN
    v_probability := ROUND(95.0 - ((v_user_pos - 1)::numeric / GREATEST(1, v_estimated_dropouts)::numeric) * 35.0, 1);
  ELSE
    v_probability := GREATEST(2.0, ROUND(55.0 - ((v_user_pos - v_estimated_dropouts)::numeric / GREATEST(1, v_capacity)::numeric) * 50.0, 1));
  END IF;

  -- Categorize probability tier
  IF v_probability >= 70.0 THEN
    v_tier := 'High';
  ELSIF v_probability >= 40.0 THEN
    v_tier := 'Medium';
  ELSIF v_probability >= 15.0 THEN
    v_tier := 'Low';
  ELSE
    v_tier := 'Unlikely';
  END IF;

  RETURN jsonb_build_object(
    'position', v_user_pos,
    'capacity', v_capacity,
    'probabilityPercentage', v_probability,
    'tier', v_tier,
    'estimatedDropouts', v_estimated_dropouts,
    'historicalDropoutRate', ROUND(v_historical_dropout_rate * 100, 1),
    'isFallback', v_is_fallback,
    'disclaimer', 'Estimated Probability based on historical attendance patterns — actual admission is not guaranteed.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_waitlist_probability TO authenticated, anon;
