-- Migration: AI-Driven Event Recommendation Engine
-- Timestamp: 20260808210000

-- 1. Add interest_vector vector(384) to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interest_vector public.vector(384);

-- 2. Tune HNSW index on events table
DROP INDEX IF EXISTS public.idx_events_embedding;
CREATE INDEX idx_events_embedding 
ON public.events USING hnsw (embedding public.vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 3. Create helper function to average array of vectors
CREATE OR REPLACE FUNCTION public.average_vectors(p_vectors public.vector(384)[])
RETURNS public.vector(384)
LANGUAGE plpgsql
AS $$
DECLARE
  v_num_vectors INT;
  v_dim INT := 384;
  v_sum float8[];
  v_arr float8[];
  v_result float8[];
BEGIN
  v_num_vectors := array_length(p_vectors, 1);
  IF v_num_vectors IS NULL OR v_num_vectors = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Initialize sum array
  v_sum := array_fill(0.0::float8, ARRAY[v_dim]);
  
  -- Loop through vectors and sum their elements
  FOR i IN 1..v_num_vectors LOOP
    IF p_vectors[i] IS NOT NULL THEN
      v_arr := (p_vectors[i])::float8[];
      FOR j IN 1..v_dim LOOP
        v_sum[j] := v_sum[j] + COALESCE(v_arr[j], 0.0);
      END LOOP;
    END IF;
  END LOOP;
  
  -- Divide by number of vectors to get average
  v_result := array_fill(0.0::float8, ARRAY[v_dim]);
  FOR j IN 1..v_dim LOOP
    v_result[j] := v_sum[j] / v_num_vectors;
  END LOOP;
  
  RETURN (v_result)::public.vector(384);
END;
$$;

-- 4. Create trigger function to update user interest vector when RSVPs change
CREATE OR REPLACE FUNCTION public.update_user_interest_vector()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_vectors public.vector(384)[];
  v_avg_vector public.vector(384);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Fetch all embeddings for events the user has RSVP'd to
  SELECT array_agg(e.embedding) INTO v_vectors
  FROM public.event_rsvps r
  JOIN public.events e ON r.event_id = e.id
  WHERE r.user_id = v_user_id AND e.embedding IS NOT NULL;

  -- Compute average vector
  v_avg_vector := public.average_vectors(v_vectors);

  -- Update user profile
  UPDATE public.profiles
  SET interest_vector = v_avg_vector
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to event_rsvps
DROP TRIGGER IF EXISTS on_rsvp_changed_update_interest ON public.event_rsvps;
CREATE TRIGGER on_rsvp_changed_update_interest
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_user_interest_vector();

-- 5. Create recommend_events_for_user RPC function
CREATE OR REPLACE FUNCTION public.recommend_events_for_user(
    p_user_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date TIMESTAMPTZ,
    location TEXT,
    banner_url TEXT,
    club_id UUID,
    similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_vector public.vector(384);
BEGIN
  -- Fetch user's interest vector
  SELECT interest_vector INTO v_user_vector
  FROM public.profiles
  WHERE profiles.id = p_user_id;

  -- If user has no interest vector (cold start or no RSVPs), return upcoming events ordered by date
  IF v_user_vector IS NULL THEN
    RETURN QUERY
    SELECT 
      e.id,
      e.title,
      e.description,
      e.event_date,
      e.location,
      e.banner_url,
      e.club_id,
      0.0::DOUBLE PRECISION AS similarity
    FROM public.events e
    WHERE e.event_date >= NOW()
      AND e.status = 'published'
      AND e.deleted_at IS NULL
    ORDER BY e.event_date ASC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT 
      e.id,
      e.title,
      e.description,
      e.event_date,
      e.location,
      e.banner_url,
      e.club_id,
      (1 - (e.embedding <=> v_user_vector))::DOUBLE PRECISION AS similarity
    FROM public.events e
    WHERE e.event_date >= NOW()
      AND e.status = 'published'
      AND e.deleted_at IS NULL
      AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> v_user_vector ASC
    LIMIT p_limit;
  END IF;
END;
$$;

-- 6. Create seed_user_interest_vector RPC function for cold start onboarding
CREATE OR REPLACE FUNCTION public.seed_user_interest_vector(
    p_user_id UUID,
    p_tags TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vectors public.vector(384)[];
  v_avg_vector public.vector(384);
BEGIN
  -- Fetch embeddings of events that contain any of the selected tags in their description/title/tags
  SELECT array_agg(e.embedding) INTO v_vectors
  FROM public.events e
  WHERE e.embedding IS NOT NULL
    AND (
      e.title ILIKE ANY(SELECT '%' || t || '%' FROM unnest(p_tags) t)
      OR e.description ILIKE ANY(SELECT '%' || t || '%' FROM unnest(p_tags) t)
    );

  -- Compute average vector
  v_avg_vector := public.average_vectors(v_vectors);

  -- Update user profile
  UPDATE public.profiles
  SET interest_vector = v_avg_vector
  WHERE id = p_user_id;
END;
$$;

-- Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.recommend_events_for_user(UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.recommend_events_for_user(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_user_interest_vector(UUID, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.seed_user_interest_vector(UUID, TEXT[]) TO service_role;
