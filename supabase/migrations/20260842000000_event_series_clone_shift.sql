-- Migration: 20260842000000_event_series_clone_shift.sql
-- Description: Automated Event Series Clone & Shift tool preserving relative temporal spacing (#3538)

CREATE OR REPLACE FUNCTION public.clone_event_series_shifted(
  p_series_id TEXT,
  p_new_start_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_first_event_date TIMESTAMPTZ;
  v_time_delta INTERVAL;
  v_new_series_id TEXT;
  v_cloned_count INT := 0;
  v_event RECORD;
  v_cloned_events JSONB := '[]'::jsonb;
BEGIN
  -- Find the earliest event in the target series
  SELECT MIN(event_date) INTO v_first_event_date
  FROM public.events
  WHERE series_id = p_series_id;

  IF v_first_event_date IS NULL THEN
    RAISE EXCEPTION 'No events found for series_id: %', p_series_id;
  END IF;

  -- Calculate the time delta interval between old first event and new start date
  v_time_delta := p_new_start_date - v_first_event_date;
  v_new_series_id := gen_random_uuid()::text;

  -- Iterate through all events in the old series and duplicate them with shifted timestamps
  FOR v_event IN
    SELECT * FROM public.events
    WHERE series_id = p_series_id
    ORDER BY event_date ASC
  LOOP
    INSERT INTO public.events (
      title,
      description,
      event_date,
      venue_id,
      capacity,
      image_url,
      tags,
      status,
      series_id,
      created_by
    )
    VALUES (
      v_event.title,
      v_event.description,
      v_event.event_date + v_time_delta,
      v_event.venue_id,
      v_event.capacity,
      v_event.image_url,
      v_event.tags,
      'draft', -- Cloned events are safely placed in Draft state for review (#3538)
      v_new_series_id,
      auth.uid()
    );

    v_cloned_count := v_cloned_count + 1;
    v_cloned_events := v_cloned_events || jsonb_build_object(
      'title', v_event.title,
      'original_date', v_event.event_date,
      'shifted_date', v_event.event_date + v_time_delta
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'cloned_count', v_cloned_count,
    'new_series_id', v_new_series_id,
    'cloned_events', v_cloned_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_event_series_shifted(TEXT, TIMESTAMPTZ) TO authenticated;
