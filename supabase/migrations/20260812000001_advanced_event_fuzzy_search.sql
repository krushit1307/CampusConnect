-- Advanced fuzzy event search using pg_trgm.
-- Supports typo-tolerant search, category filtering and date filtering.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast fuzzy matching.
CREATE INDEX IF NOT EXISTS idx_events_title_trgm
ON public.events
USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_description_trgm
ON public.events
USING GIN (description gin_trgm_ops);

-- Fuzzy event search RPC.
CREATE OR REPLACE FUNCTION public.search_events(
  query_text TEXT,
  category_filter TEXT DEFAULT NULL,
  date_filter TEXT DEFAULT NULL
)
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  normalized_query TEXT := NULLIF(TRIM(query_text), '');
  similarity_threshold CONSTANT REAL := 0.3;
BEGIN
  IF normalized_query IS NULL THEN
    RETURN QUERY
    SELECT e.*
    FROM public.events e
    WHERE
      (
        category_filter IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.event_categories ec
          WHERE ec.id = e.category_id
            AND ec.name = category_filter
        )
      )
      AND (
        date_filter IS NULL
        OR (
          date_filter = 'this_week'
          AND e.start_date >= date_trunc('week', NOW())
          AND e.start_date < date_trunc('week', NOW()) + INTERVAL '7 days'
        )
      )
    ORDER BY COALESCE(e.start_date, e.event_date, e.created_at) ASC
    LIMIT 50;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.events e
  WHERE
    (
      similarity(e.title, normalized_query) > similarity_threshold
      OR similarity(COALESCE(e.description, ''), normalized_query) > similarity_threshold
    )
    AND (
      category_filter IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.event_categories ec
        WHERE ec.id = e.category_id
          AND ec.name = category_filter
      )
    )
    AND (
      date_filter IS NULL
      OR (
        date_filter = 'this_week'
        AND e.start_date >= date_trunc('week', NOW())
        AND e.start_date < date_trunc('week', NOW()) + INTERVAL '7 days'
      )
    )
  ORDER BY
    GREATEST(
      similarity(e.title, normalized_query),
      similarity(COALESCE(e.description, ''), normalized_query)
    ) DESC,
    COALESCE(e.start_date, e.event_date, e.created_at) ASC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_events(TEXT, TEXT, TEXT)
TO authenticated, anon;