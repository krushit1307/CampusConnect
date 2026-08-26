-- Migration: 20260826000002_event_clash_dependency_graph.sql
-- Description: Creates schema, tables, and RPCs for Dynamic Event Clash Dependency Graph & Demographic Overlap Analyzer

CREATE TABLE IF NOT EXISTS public.event_demographic_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_event_tags_name ON public.event_demographic_tags (tag_name);
CREATE INDEX IF NOT EXISTS idx_event_tags_event_id ON public.event_demographic_tags (event_id);

CREATE TABLE IF NOT EXISTS public.event_clash_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_event_title TEXT NOT NULL,
  proposed_club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  proposed_start_time TIMESTAMPTZ NOT NULL,
  proposed_end_time TIMESTAMPTZ NOT NULL,
  target_tags TEXT[] NOT NULL DEFAULT '{}',
  max_clash_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  clash_severity TEXT NOT NULL DEFAULT 'none' CHECK (
    clash_severity IN ('none', 'low', 'medium', 'high', 'critical')
  ),
  conflicting_events_count INT NOT NULL DEFAULT 0,
  recommended_alternative_slot TIMESTAMPTZ,
  analysis_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clash_analyses_club_time ON public.event_clash_analyses (proposed_club_id, proposed_start_time);

-- Enable RLS
ALTER TABLE public.event_demographic_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_clash_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of event demographic tags"
  ON public.event_demographic_tags
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert of event tags"
  ON public.event_demographic_tags
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read of clash analyses"
  ON public.event_clash_analyses
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert of clash analyses"
  ON public.event_clash_analyses
  FOR INSERT
  WITH CHECK (true);

-- RPC: Calculate historical RSVP overlap percentage between two clubs
CREATE OR REPLACE FUNCTION public.get_club_rsvp_historical_overlap(
  club_a_id UUID,
  club_b_id UUID
)
RETURNS TABLE (
  club_a_attendees INT,
  club_b_attendees INT,
  shared_attendees INT,
  overlap_percentage DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_a INT;
  total_b INT;
  shared_cnt INT;
  pct DOUBLE PRECISION;
BEGIN
  -- Count distinct RSVPs for club A
  SELECT COUNT(DISTINCT r.user_id) INTO total_a
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.club_id = club_a_id AND r.status = 'attending';

  -- Count distinct RSVPs for club B
  SELECT COUNT(DISTINCT r.user_id) INTO total_b
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.club_id = club_b_id AND r.status = 'attending';

  -- Count shared users who RSVPed to both
  SELECT COUNT(DISTINCT r1.user_id) INTO shared_cnt
  FROM public.event_rsvps r1
  JOIN public.events e1 ON e1.id = r1.event_id
  JOIN public.event_rsvps r2 ON r2.user_id = r1.user_id
  JOIN public.events e2 ON e2.id = r2.event_id
  WHERE e1.club_id = club_a_id AND e2.club_id = club_b_id
    AND r1.status = 'attending' AND r2.status = 'attending';

  IF total_a IS NULL OR total_a = 0 THEN
    total_a := 1;
  END IF;

  pct := ROUND(((shared_cnt::FLOAT / total_a::FLOAT) * 100.0)::numeric, 2);

  RETURN QUERY SELECT total_a, total_b, shared_cnt, COALESCE(pct, 0.0);
END;
$$;
