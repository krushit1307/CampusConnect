-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add an embedding vector column to the clubs table (sized for OpenAI text-embedding-3-small)
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS search_embedding vector(1536);

-- 3. Create an HNSW index for fast Cosine Similarity (<=>) distance queries
CREATE INDEX IF NOT EXISTS idx_clubs_search_embedding 
ON clubs USING hnsw (search_embedding vector_cosine_ops);

-- 4. Create a stored RPC function to perform semantic search
CREATE OR REPLACE FUNCTION search_clubs_semantically(
    p_query_embedding vector(1536),
    p_match_threshold float DEFAULT 0.3,
    p_match_count int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    tags TEXT[],
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.description,
        c.tags,
        -- Calculate cosine similarity (1 - cosine distance)
        1 - (c.search_embedding <=> p_query_embedding) AS similarity
    FROM clubs c
    WHERE c.search_embedding IS NOT NULL
      AND 1 - (c.search_embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY c.search_embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;