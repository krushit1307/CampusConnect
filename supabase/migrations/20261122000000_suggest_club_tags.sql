-- Migration: 20261122000000_suggest_club_tags.sql
-- Description: Issue #3435 - Database triggers and utility helpers for suggesting tags
-- Seeds initial tag ontology and exposes a similarity search helper.

-- 1. Ensure initial tag_ontology is seeded
INSERT INTO public.tag_ontology (id, name, parent_id)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'Engineering', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'Robotics', '00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000006', 'Coding', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000007', 'Science', null),
  ('00000000-0000-0000-0000-000000000008', 'Arts', null),
  ('00000000-0000-0000-0000-000000000009', 'Music', '00000000-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000010', 'Sports', null),
  ('00000000-0000-0000-0000-000000000011', 'Fitness', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000012', 'Gaming', null)
ON CONFLICT (name) DO NOTHING;

-- 2. Create search helper for matching keywords against ontology
CREATE OR REPLACE FUNCTION public.suggest_ontology_tags(
    p_keywords TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_results JSONB;
BEGIN
    SELECT COALESCE(JSONB_AGG(name), '[]'::jsonb)
    INTO v_results
    FROM (
        SELECT DISTINCT ON (name) name
        FROM public.tag_ontology t
        JOIN UNNEST(p_keywords) kw ON (
            t.name ILIKE '%' || kw || '%' OR 
            similarity(t.name, kw) > 0.3
        )
        ORDER BY name, similarity(t.name, kw) DESC
        LIMIT 10
    ) sub;

    RETURN v_results;
END;
$$;
