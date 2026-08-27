-- ============================================================
-- Migration: Dynamic Event Post-Mortem Analyzer
-- Issue: #4208
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create table public.event_post_mortems
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_post_mortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Structured 5-question retrospective
  what_went_well TEXT NOT NULL,
  what_failed TEXT NOT NULL,
  advice_for_next_year TEXT NOT NULL,
  logistics_score INT NOT NULL CHECK (logistics_score BETWEEN 1 AND 5),
  budget_accuracy_score INT NOT NULL CHECK (budget_accuracy_score BETWEEN 1 AND 5),
  
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_post_mortems_club_id ON public.event_post_mortems(club_id);
CREATE INDEX IF NOT EXISTS idx_event_post_mortems_created_at ON public.event_post_mortems(created_at DESC);

-- ------------------------------------------------------------
-- 2. Row Level Security
-- ------------------------------------------------------------

ALTER TABLE public.event_post_mortems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view club post-mortems" ON public.event_post_mortems;
CREATE POLICY "Members can view club post-mortems"
  ON public.event_post_mortems FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = event_post_mortems.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = event_post_mortems.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can insert/update event post-mortems" ON public.event_post_mortems;
CREATE POLICY "Organizers can insert/update event post-mortems"
  ON public.event_post_mortems FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = event_post_mortems.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'president', 'officer', 'treasurer')
        AND cm.status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = event_post_mortems.club_id
        AND c.created_by = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.event_post_mortems TO authenticated;
GRANT ALL ON public.event_post_mortems TO service_role;

-- ------------------------------------------------------------
-- 3. Gating RPC: check_pending_post_mortems
-- Checks if an organizer has pending post-mortems for major events ended >24h ago
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_pending_post_mortems(
  p_user_id UUID,
  p_club_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_events JSONB;
  v_pending_count INT := 0;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_id', e.id,
          'title', e.title,
          'event_date', e.event_date,
          'end_date', e.end_date,
          'club_id', e.club_id,
          'hours_since_end', ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(e.end_date, e.event_date))) / 3600)
        )
        ORDER BY COALESCE(e.end_date, e.event_date) ASC
      ),
      '[]'::jsonb
    ),
    COUNT(e.id)
  INTO
    v_pending_events,
    v_pending_count
  FROM public.events e
  JOIN public.club_members cm ON cm.club_id = e.club_id
  WHERE cm.user_id = p_user_id
    AND cm.role IN ('admin', 'president', 'officer', 'treasurer')
    AND cm.status = 'approved'
    AND (p_club_id IS NULL OR e.club_id = p_club_id)
    AND COALESCE(e.end_date, e.event_date) <= v_cutoff
    AND NOT EXISTS (
      SELECT 1 FROM public.event_post_mortems pm
      WHERE pm.event_id = e.id
    );

  RETURN jsonb_build_object(
    'is_locked', (v_pending_count > 0),
    'pending_count', v_pending_count,
    'pending_events', v_pending_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_pending_post_mortems(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. Searchable Knowledge Base RPC: search_club_post_mortems
-- Searches retrospectives by keyword or club with text suggestions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_club_post_mortems(
  p_club_id UUID,
  p_query TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB;
BEGIN
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'event_id', pm.event_id,
          'event_title', e.title,
          'event_date', e.event_date,
          'what_went_well', pm.what_went_well,
          'what_failed', pm.what_failed,
          'advice_for_next_year', pm.advice_for_next_year,
          'logistics_score', pm.logistics_score,
          'budget_accuracy_score', pm.budget_accuracy_score,
          'tags', pm.tags,
          'created_at', pm.created_at
        )
        ORDER BY pm.created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_results
  FROM public.event_post_mortems pm
  JOIN public.events e ON e.id = pm.event_id
  WHERE pm.club_id = p_club_id
    AND (
      p_query IS NULL 
      OR p_query = '' 
      OR e.title ILIKE '%' || p_query || '%'
      OR pm.what_went_well ILIKE '%' || p_query || '%'
      OR pm.what_failed ILIKE '%' || p_query || '%'
      OR pm.advice_for_next_year ILIKE '%' || p_query || '%'
    );

  RETURN jsonb_build_object(
    'club_id', p_club_id,
    'post_mortems', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_club_post_mortems(UUID, TEXT) TO authenticated;
