-- Migration: 20260826000005_dietary_predictive_model.sql
-- Description: Dynamic Dietary Restriction Predictive Model schema, tables, and RPCs for Catering Logistics (Issue #4290)

CREATE TABLE IF NOT EXISTS public.club_historical_dietary_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_title TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  total_attendees INT NOT NULL CHECK (total_attendees > 0),
  general_count INT NOT NULL DEFAULT 0,
  vegan_count INT NOT NULL DEFAULT 0,
  vegetarian_count INT NOT NULL DEFAULT 0,
  gluten_free_count INT NOT NULL DEFAULT 0,
  halal_count INT NOT NULL DEFAULT 0,
  kosher_count INT NOT NULL DEFAULT 0,
  dairy_free_count INT NOT NULL DEFAULT 0,
  nut_allergy_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_dietary_logs_club ON public.club_historical_dietary_logs (club_id, event_date DESC);

CREATE TABLE IF NOT EXISTS public.event_dietary_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  venue_capacity INT NOT NULL CHECK (venue_capacity > 0),
  predicted_breakdown JSONB NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  safety_buffer_percentage DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  historical_events_analyzed INT NOT NULL DEFAULT 5,
  is_algorithmic_estimate BOOLEAN NOT NULL DEFAULT true,
  caterer_order_submitted BOOLEAN NOT NULL DEFAULT false,
  caterer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dietary_predictions_event ON public.event_dietary_predictions (event_id);

-- Enable RLS
ALTER TABLE public.club_historical_dietary_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dietary_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to dietary predictions"
  ON public.event_dietary_predictions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert of dietary predictions"
  ON public.event_dietary_predictions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update of dietary predictions"
  ON public.event_dietary_predictions
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow read access to historical dietary logs"
  ON public.club_historical_dietary_logs
  FOR SELECT
  USING (true);

-- RPC: Query last N (default 5) events for a club and compute aggregate dietary distribution
CREATE OR REPLACE FUNCTION public.get_club_historical_dietary_ratios(
  p_club_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  total_events INT,
  total_sampled_attendees INT,
  avg_vegan_ratio DOUBLE PRECISION,
  avg_vegetarian_ratio DOUBLE PRECISION,
  avg_gluten_free_ratio DOUBLE PRECISION,
  avg_halal_ratio DOUBLE PRECISION,
  avg_kosher_ratio DOUBLE PRECISION,
  avg_dairy_free_ratio DOUBLE PRECISION,
  avg_nut_allergy_ratio DOUBLE PRECISION,
  avg_general_ratio DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events_count INT;
  v_total_attendees INT;
  v_sum_vegan INT;
  v_sum_veg INT;
  v_sum_gf INT;
  v_sum_halal INT;
  v_sum_kosher INT;
  v_sum_dairy INT;
  v_sum_nut INT;
  v_sum_general INT;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(total_attendees), 0),
    COALESCE(SUM(vegan_count), 0),
    COALESCE(SUM(vegetarian_count), 0),
    COALESCE(SUM(gluten_free_count), 0),
    COALESCE(SUM(halal_count), 0),
    COALESCE(SUM(kosher_count), 0),
    COALESCE(SUM(dairy_free_count), 0),
    COALESCE(SUM(nut_allergy_count), 0),
    COALESCE(SUM(general_count), 0)
  INTO
    v_events_count,
    v_total_attendees,
    v_sum_vegan,
    v_sum_veg,
    v_sum_gf,
    v_sum_halal,
    v_sum_kosher,
    v_sum_dairy,
    v_sum_nut,
    v_sum_general
  FROM (
    SELECT *
    FROM public.club_historical_dietary_logs
    WHERE club_id = p_club_id
    ORDER BY event_date DESC
    LIMIT p_limit
  ) sub;

  IF v_total_attendees = 0 THEN
    -- Fallback default campus demographic baseline (10% Vegan, 12% Veg, 5% GF, 8% Halal, 2% Kosher, 4% Dairy-Free, 3% Nut, 56% General)
    RETURN QUERY SELECT
      0,
      0,
      0.10::FLOAT,
      0.12::FLOAT,
      0.05::FLOAT,
      0.08::FLOAT,
      0.02::FLOAT,
      0.04::FLOAT,
      0.03::FLOAT,
      0.56::FLOAT;
  ELSE
    RETURN QUERY SELECT
      v_events_count,
      v_total_attendees,
      (v_sum_vegan::FLOAT / v_total_attendees::FLOAT),
      (v_sum_veg::FLOAT / v_total_attendees::FLOAT),
      (v_sum_gf::FLOAT / v_total_attendees::FLOAT),
      (v_sum_halal::FLOAT / v_total_attendees::FLOAT),
      (v_sum_kosher::FLOAT / v_total_attendees::FLOAT),
      (v_sum_dairy::FLOAT / v_total_attendees::FLOAT),
      (v_sum_nut::FLOAT / v_total_attendees::FLOAT),
      (v_sum_general::FLOAT / v_total_attendees::FLOAT);
  END IF;
END;
$$;
