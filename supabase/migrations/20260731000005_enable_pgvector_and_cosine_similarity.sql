-- =============================================================================
-- Migration: Enable pgvector and Cosine Similarity Recommendations
-- Purpose: Provide mathematical club recommendations based on user interests
-- =============================================================================

-- 1. Enable the pgvector extension (requires Supabase dashboard enablement or superuser)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add a vector column to the clubs table to store tag embeddings
-- Assuming a master tag list of ~50 tags, we use a 50-dimensional vector.
-- Adjust the dimension (50) to match your actual master tag list size.
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS tag_vector vector(50);

-- 3. Create an index for lightning-fast cosine distance queries (<=> operator)
-- Using ivfflat for approximate nearest neighbor search, which is much faster for large datasets
CREATE INDEX IF NOT EXISTS idx_clubs_tag_vector 
ON public.clubs 
USING ivfflat (tag_vector vector_cosine_ops) 
WITH (lists = 100);

-- 4. Create the Recommendation RPC Function
-- This function calculates cosine similarity and handles the "Cold Start" problem.
CREATE OR REPLACE FUNCTION public.get_recommended_clubs(
  p_user_vector vector,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  club_id UUID,
  club_name TEXT,
  club_description TEXT,
  similarity_score FLOAT,
  is_cold_start BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_magnitude FLOAT;
BEGIN
  -- Calculate the magnitude (L2 norm) of the user vector
  -- If magnitude is 0, the user has selected zero interests (Cold Start Problem)
  v_magnitude := sqrt(p_user_vector <#> p_user_vector * -1); -- <#> is negative inner product, used to calculate magnitude

  IF v_magnitude = 0 OR p_user_vector IS NULL THEN
    -- COLD START FALLBACK: Return most popular clubs by member count
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.description,
      0.0 AS similarity_score,
      true AS is_cold_start
    FROM public.clubs c
    LEFT JOIN (
      SELECT club_id, COUNT(*) as member_count 
      FROM public.club_members 
      WHERE status = 'approved' 
      GROUP BY club_id
    ) cm ON c.id = cm.club_id
    ORDER BY COALESCE(cm.member_count, 0) DESC
    LIMIT p_limit;
  ELSE
    -- NORMAL PATH: Calculate Cosine Similarity
    -- Cosine Similarity = 1 - Cosine Distance
    -- The <=> operator in pgvector returns Cosine Distance (0 to 2). 
    -- We want similarity, so we order by distance ASC (which is similarity DESC).
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.description,
      (1 - (c.tag_vector <=> p_user_vector)) AS similarity_score,
      false AS is_cold_start
    FROM public.clubs c
    WHERE c.tag_vector IS NOT NULL
      -- Filter for similarity score > 0.5 (distance < 0.5)
      AND (1 - (c.tag_vector <=> p_user_vector)) > 0.5
    ORDER BY (c.tag_vector <=> p_user_vector) ASC
    LIMIT p_limit;
  END IF;
END;
$$;
