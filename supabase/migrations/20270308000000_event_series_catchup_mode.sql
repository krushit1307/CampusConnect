-- ============================================================
-- Migration: Automated Event Series Catch-Up Mode
-- Issue: #4215
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add recording_url and materials_url to public.events
-- ------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS materials_url TEXT;

-- ------------------------------------------------------------
-- 2. Create table for tracking Event Series Catch-Up Dispatch and Recovery Clicks
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_series_catchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  missed_event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  next_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_url TEXT,
  materials_url TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  vod_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  vod_clicked_at TIMESTAMPTZ,
  materials_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  materials_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(missed_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_series_catchups_series_user
  ON public.event_series_catchups (series_id, user_id);

CREATE INDEX IF NOT EXISTS idx_series_catchups_missed_event
  ON public.event_series_catchups (missed_event_id);

ALTER TABLE public.event_series_catchups ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own catchup progress (record link clicks)
DROP POLICY IF EXISTS "Users can view their catchups" ON public.event_series_catchups;
CREATE POLICY "Users can view their catchups"
  ON public.event_series_catchups FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their catchup click events" ON public.event_series_catchups;
CREATE POLICY "Users can update their catchup click events"
  ON public.event_series_catchups FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Organizers and service role can manage catchups
DROP POLICY IF EXISTS "Organizers can view series catchup analytics" ON public.event_series_catchups;
CREATE POLICY "Organizers can view series catchup analytics"
  ON public.event_series_catchups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.event_series s
      JOIN public.clubs c ON c.id = s.club_id
      WHERE s.id = event_series_catchups.series_id
        AND (
          c.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('admin', 'president', 'officer', 'treasurer')
          )
        )
    )
  );

GRANT SELECT, UPDATE ON public.event_series_catchups TO authenticated;
GRANT ALL ON public.event_series_catchups TO service_role;

-- ------------------------------------------------------------
-- 3. RPC: process_series_no_show_catchups
-- Identifies no-show users for an event in an active series and creates catchup rows
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_series_no_show_catchups(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id UUID;
  v_recording_url TEXT;
  v_materials_url TEXT;
  v_missed_event_title TEXT;
  v_next_event_id UUID;
  v_next_event_title TEXT;
  v_processed_count INT := 0;
BEGIN
  -- 1. Get Event and Series details
  SELECT series_id, recording_url, materials_url, title
  INTO v_series_id, v_recording_url, v_materials_url, v_missed_event_title
  FROM public.events
  WHERE id = p_event_id;

  IF v_series_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Event is not part of a series');
  END IF;

  -- 2. Find next event in the series
  SELECT id, title
  INTO v_next_event_id, v_next_event_title
  FROM public.events
  WHERE series_id = v_series_id
    AND (event_date > (SELECT event_date FROM public.events WHERE id = p_event_id)
         OR (event_date IS NULL AND id <> p_event_id))
  ORDER BY event_date ASC NULLS LAST
  LIMIT 1;

  -- 3. Find no-show users (RSVP'd or registered, but checked_in = false / status <> 'attended')
  -- and insert into event_series_catchups
  INSERT INTO public.event_series_catchups (
    series_id,
    missed_event_id,
    next_event_id,
    user_id,
    recording_url,
    materials_url,
    email_sent,
    email_sent_at
  )
  SELECT 
    v_series_id,
    p_event_id,
    v_next_event_id,
    r.user_id,
    v_recording_url,
    v_materials_url,
    TRUE,
    NOW()
  FROM public.event_rsvps r
  WHERE r.event_id = p_event_id
    AND COALESCE(r.checked_in, FALSE) = FALSE
    AND r.status NOT IN ('cancelled', 'refunded')
  ON CONFLICT (missed_event_id, user_id) DO UPDATE
  SET 
    recording_url = EXCLUDED.recording_url,
    materials_url = EXCLUDED.materials_url,
    next_event_id = EXCLUDED.next_event_id,
    updated_at = NOW();

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'series_id', v_series_id,
    'missed_event_id', p_event_id,
    'missed_event_title', v_missed_event_title,
    'next_event_id', v_next_event_id,
    'next_event_title', v_next_event_title,
    'catchups_generated', v_processed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_series_no_show_catchups(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. RPC: record_series_catchup_click
-- Tracks VOD or Materials click for recovery analytics
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_series_catchup_click(
  p_catchup_id UUID,
  p_link_type TEXT -- 'vod' or 'materials'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_link_type = 'vod' THEN
    UPDATE public.event_series_catchups
    SET 
      vod_clicked = TRUE,
      vod_clicked_at = COALESCE(vod_clicked_at, NOW()),
      updated_at = NOW()
    WHERE id = p_catchup_id;
  ELSIF p_link_type = 'materials' THEN
    UPDATE public.event_series_catchups
    SET 
      materials_clicked = TRUE,
      materials_clicked_at = COALESCE(materials_clicked_at, NOW()),
      updated_at = NOW()
    WHERE id = p_catchup_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'catchup_id', p_catchup_id, 'link_type', p_link_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_series_catchup_click(UUID, TEXT) TO authenticated, anon;
