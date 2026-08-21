-- Migration: 20260811190000_lost_and_found_vector_search.sql
-- Description: Enable pgvector, create lost_items table with 512-dim vector embeddings,
--               cosine distance RPC match function, and auto-purge expired items RPC (#2747).

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create lost_items table
CREATE TABLE IF NOT EXISTS public.lost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    image_url TEXT,
    location_found TEXT,
    status TEXT NOT NULL DEFAULT 'unclaimed', -- unclaimed, claimed, returned
    pii_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    embedding vector(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Index for fast cosine vector similarity searches
CREATE INDEX IF NOT EXISTS lost_items_embedding_idx 
ON public.lost_items 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-flagged lost items"
    ON public.lost_items FOR SELECT
    USING (pii_flagged = FALSE);

CREATE POLICY "Authenticated users can post lost items"
    ON public.lost_items FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can update lost items"
    ON public.lost_items FOR UPDATE
    USING (auth.uid() = user_id);

-- 2. RPC function for Vector Similarity Search using Cosine Distance (<=>)
CREATE OR REPLACE FUNCTION public.match_lost_items(
    query_embedding vector(512),
    match_threshold FLOAT DEFAULT 0.85,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category TEXT,
    image_url TEXT,
    location_found TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        l.id,
        l.title,
        l.description,
        l.category,
        l.image_url,
        l.location_found,
        l.status,
        l.created_at,
        (1 - (l.embedding <=> query_embedding)) AS similarity
    FROM public.lost_items l
    WHERE l.pii_flagged = FALSE
      AND l.status = 'unclaimed'
      AND (1 - (l.embedding <=> query_embedding)) >= match_threshold
    ORDER BY l.embedding <=> query_embedding ASC
    LIMIT match_count;
$$;

-- 3. RPC function to auto-purge unverified lost items older than 30 days
CREATE OR REPLACE FUNCTION public.purge_expired_lost_items()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.lost_items
    WHERE expires_at < NOW() OR (created_at < NOW() - INTERVAL '30 days' AND status = 'unclaimed');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
