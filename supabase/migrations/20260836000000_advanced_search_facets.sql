-- Migration: 20260836000000_advanced_search_facets.sql
-- Description: Advanced search filters and facets with indexes for sub-100ms performance (#2973)

-- 1. Ensure required columns exist on public.events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS has_food BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gives_points BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;

-- 2. Indexes on commonly filtered columns for performance (<100ms response time)
CREATE INDEX IF NOT EXISTS idx_events_is_free ON public.events (is_free);
CREATE INDEX IF NOT EXISTS idx_events_price ON public.events (price);
CREATE INDEX IF NOT EXISTS idx_events_has_food ON public.events (has_food);
CREATE INDEX IF NOT EXISTS idx_events_gives_points ON public.events (gives_points);
CREATE INDEX IF NOT EXISTS idx_events_is_virtual ON public.events (is_virtual);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events (start_date);

-- 3. Faceted Search RPC with pagination and dynamic filter criteria (#2973)
CREATE OR REPLACE FUNCTION public.search_events_faceted(
  p_query_text TEXT DEFAULT NULL,
  p_date_range TEXT DEFAULT 'all',
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_is_free BOOLEAN DEFAULT NULL,
  p_has_food BOOLEAN DEFAULT NULL,
  p_gives_points BOOLEAN DEFAULT NULL,
  p_format TEXT DEFAULT 'all',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  price NUMERIC,
  is_free BOOLEAN,
  has_food BOOLEAN,
  gives_points BOOLEAN,
  is_virtual BOOLEAN,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_normalized_query TEXT := NULLIF(TRIM(p_query_text), '');
  v_offset INT := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 20));
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT e.*
    FROM public.events e
    WHERE
      -- Query string match (title or description)
      (v_normalized_query IS NULL OR e.title ILIKE '%' || v_normalized_query || '%' OR COALESCE(e.description, '') ILIKE '%' || v_normalized_query || '%')
      -- Date Range Filter
      AND (
        p_date_range = 'all'
        OR (p_date_range = 'today' AND e.start_date::date = CURRENT_DATE)
        OR (p_date_range = 'this_weekend' AND e.start_date >= date_trunc('week', NOW()) + INTERVAL '5 days' AND e.start_date < date_trunc('week', NOW()) + INTERVAL '7 days')
        OR (p_date_range = 'custom' AND (p_start_date IS NULL OR e.start_date >= p_start_date) AND (p_end_date IS NULL OR e.start_date <= p_end_date))
      )
      -- Cost Filter
      AND (p_is_free IS NULL OR e.is_free = p_is_free)
      -- Perks Filters
      AND (p_has_food IS NULL OR e.has_food = p_has_food)
      AND (p_gives_points IS NULL OR e.gives_points = p_gives_points)
      -- Format Filter (in_person vs virtual)
      AND (
        p_format = 'all'
        OR (p_format = 'virtual' AND e.is_virtual = true)
        OR (p_format = 'in_person' AND e.is_virtual = false)
      )
  ),
  counted AS (
    SELECT COUNT(*) AS full_count FROM filtered
  )
  SELECT
    f.id,
    f.title,
    f.description,
    f.location,
    f.start_date,
    f.end_date,
    COALESCE(f.price, 0),
    COALESCE(f.is_free, true),
    COALESCE(f.has_food, false),
    COALESCE(f.gives_points, false),
    COALESCE(f.is_virtual, false),
    c.full_count
  FROM filtered f, counted c
  ORDER BY f.start_date ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_events_faceted TO authenticated, anon;
