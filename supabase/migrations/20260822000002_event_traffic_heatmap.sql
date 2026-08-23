-- Issue #3871: Event Traffic Heatmap for Admins
-- Traffic events are recorded through SECURITY DEFINER RPCs so clients cannot
-- write arbitrary user/category combinations or read raw analytics rows.

CREATE TABLE IF NOT EXISTS public.event_traffic_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('event_view', 'event_click')),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.event_categories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_traffic_events_occurred_at
  ON public.event_traffic_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_traffic_events_category_hour
  ON public.event_traffic_events (category_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_event_traffic_events_event
  ON public.event_traffic_events (event_id, occurred_at DESC);

ALTER TABLE public.event_traffic_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_traffic_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.event_traffic_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_event_traffic(
  p_event_id UUID,
  p_event_type TEXT DEFAULT 'event_view'
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  IF p_event_type NOT IN ('event_view', 'event_click') THEN
    RAISE EXCEPTION 'Unsupported event traffic type';
  END IF;

  SELECT category_id INTO v_category_id
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.event_traffic_events (
    event_type,
    event_id,
    category_id,
    user_id,
    occurred_at
  )
  VALUES (
    p_event_type,
    p_event_id,
    v_category_id,
    auth.uid(),
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_event_traffic(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_event_traffic_heatmap(
  p_start_date DATE DEFAULT (CURRENT_DATE - 29),
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  hour_of_day INTEGER,
  traffic_count BIGINT,
  unique_viewers BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  ) THEN
    RAISE EXCEPTION 'System administrator access required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'The end date must be on or after the start date';
  END IF;

  RETURN QUERY
  WITH categories AS (
    SELECT c.id, c.name
    FROM public.event_categories c
    WHERE c.name IS NOT NULL
    UNION ALL
    SELECT NULL::UUID, 'Uncategorized'
    WHERE EXISTS (
      SELECT 1
      FROM public.event_traffic_events t
      WHERE t.category_id IS NULL
        AND t.occurred_at >= p_start_date::TIMESTAMPTZ
        AND t.occurred_at < (p_end_date + 1)::TIMESTAMPTZ
    )
  ),
  hours AS (
    SELECT generate_series(0, 23)::INTEGER AS hour_of_day
  ),
  counts AS (
    SELECT
      t.category_id,
      EXTRACT(HOUR FROM t.occurred_at)::INTEGER AS hour_of_day,
      COUNT(*)::BIGINT AS traffic_count,
      COUNT(DISTINCT t.user_id)::BIGINT AS unique_viewers
    FROM public.event_traffic_events t
    WHERE t.occurred_at >= p_start_date::TIMESTAMPTZ
      AND t.occurred_at < (p_end_date + 1)::TIMESTAMPTZ
    GROUP BY t.category_id, EXTRACT(HOUR FROM t.occurred_at)
  )
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    h.hour_of_day,
    COALESCE(x.traffic_count, 0)::BIGINT,
    COALESCE(x.unique_viewers, 0)::BIGINT
  FROM categories c
  CROSS JOIN hours h
  LEFT JOIN counts x
    ON x.category_id IS NOT DISTINCT FROM c.id
   AND x.hour_of_day = h.hour_of_day
  ORDER BY c.name, h.hour_of_day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_traffic_heatmap(DATE, DATE) TO authenticated;

COMMENT ON TABLE public.event_traffic_events IS
  'Privacy-conscious event detail traffic records used only for aggregated admin analytics.';
COMMENT ON FUNCTION public.record_event_traffic(UUID, TEXT) IS
  'Records a validated event view/click with the event category resolved server-side.';
COMMENT ON FUNCTION public.get_event_traffic_heatmap(DATE, DATE) IS
  'Returns a complete category-by-hour traffic matrix for system administrators.';
