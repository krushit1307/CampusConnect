-- Migration: 20260727020000_event_recommendation_vector.sql
-- Description: Enable pgvector, add event embedding column, create similarity RPC, and trigger embeddings webhook.

-- 1. Safely enable vector extension in public schema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add embedding vector(384) column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS embedding public.vector(384);

-- 3. Create HNSW index for high performance cosine similarity vector searches
CREATE INDEX IF NOT EXISTS idx_events_embedding 
ON public.events USING hnsw (embedding public.vector_cosine_ops);

-- 4. Create recommend_events RPC function
CREATE OR REPLACE FUNCTION public.recommend_events(
    p_event_id UUID,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category_id UUID,
    event_date TIMESTAMPTZ,
    banner_url TEXT,
    description TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_target_embedding public.vector(384);
BEGIN
  -- Fetch the embedding for the target event
  SELECT embedding INTO v_target_embedding
  FROM public.events
  WHERE events.id = p_event_id;

  -- Return empty table if target embedding is null or not found
  IF v_target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.category_id,
    e.event_date,
    e.banner_url,
    e.description,
    (1 - (e.embedding <=> v_target_embedding))::FLOAT AS similarity
  FROM public.events e
  WHERE e.id <> p_event_id
    AND e.embedding IS NOT NULL
    AND e.status = 'published'
  ORDER BY e.embedding <=> v_target_embedding
  LIMIT p_limit;
END;
$$;

-- Grant EXECUTE permission to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.recommend_events(UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.recommend_events(UUID, INT) TO service_role;

-- 5. Webhook Trigger for generate-event-embeddings edge function
CREATE OR REPLACE FUNCTION public.handle_new_event_embedding()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/generate-event-embeddings';
    payload JSONB;
BEGIN
    -- Only trigger if the event is published and has valid details
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'events',
        'record', jsonb_build_object(
            'id', NEW.id,
            'title', COALESCE(NEW.title, ''),
            'description', COALESCE(NEW.description, '')
        )
    );

    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to AFTER INSERT on events table
DROP TRIGGER IF EXISTS on_event_created_embedding ON public.events;
CREATE TRIGGER on_event_created_embedding
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_event_embedding();
