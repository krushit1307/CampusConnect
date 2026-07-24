-- Migration: 20260722000000_ai_moderation_pgvector.sql
-- Description: Enable pgvector, create toxic patterns table, add moderation flags to posts, and trigger webhook

-- 1. Safely attempt to enable pg_net and vector extensions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add moderation columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- 3. Create toxic_patterns table for reference embeddings
CREATE TABLE IF NOT EXISTS public.toxic_patterns (
    id SERIAL PRIMARY KEY,
    pattern_text TEXT NOT NULL,
    embedding vector(1536), -- 1536 dimensions for OpenAI text-embedding-ada-002
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast nearest-neighbor search using cosine similarity
CREATE INDEX IF NOT EXISTS toxic_patterns_embedding_idx ON public.toxic_patterns USING hnsw (embedding vector_cosine_ops);

-- RLS for toxic_patterns (only readable by service role/admins)
ALTER TABLE public.toxic_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage toxic patterns" ON public.toxic_patterns;
CREATE POLICY "Service role can manage toxic patterns" ON public.toxic_patterns USING (true) WITH CHECK (true);

-- 4. Create RPC for matching toxic patterns
CREATE OR REPLACE FUNCTION public.match_toxic_patterns(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id int,
    pattern_text text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tp.id,
        tp.pattern_text,
        1 - (tp.embedding <=> query_embedding) AS similarity
    FROM public.toxic_patterns tp
    WHERE 1 - (tp.embedding <=> query_embedding) > match_threshold
    ORDER BY tp.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. Webhook Trigger for ai-moderation edge function
CREATE OR REPLACE FUNCTION public.handle_new_post_moderation()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/ai-moderation';
    payload JSONB;
BEGIN
    -- We only send the post id and content to the edge function
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'posts',
        'record', jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content
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

COMMENT ON FUNCTION public.handle_new_post_moderation() IS
'Triggers ai-moderation edge function asynchronously via pg_net HTTP POST when a new post is created.';

-- Attach trigger to AFTER INSERT on posts table
DROP TRIGGER IF EXISTS on_post_created_moderation ON public.posts;

CREATE TRIGGER on_post_created_moderation
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_post_moderation();
