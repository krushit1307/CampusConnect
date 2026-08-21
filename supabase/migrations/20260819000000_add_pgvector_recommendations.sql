-- 1. Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding vector (1536-dim for OpenAI ada-002/3-small) and cluster_id to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS cluster_id INTEGER DEFAULT 0 NOT NULL;

-- 3. Add embedding vector to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index for fast cosine vector distance lookups (<=> operator)
CREATE INDEX IF NOT EXISTS idx_profiles_embedding ON profiles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_events_embedding ON events USING ivfflat (embedding vector_cosine_ops);

-- 4. Stored procedure to fetch recommended events for a user based on cohort cluster
CREATE OR REPLACE FUNCTION get_cluster_recommended_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    event_id UUID,
    title TEXT,
    cluster_score BIGINT
) AS $$
DECLARE
    v_cluster_id INTEGER;
BEGIN
    SELECT cluster_id INTO v_cluster_id FROM profiles WHERE id = p_user_id;

    RETURN QUERY
    SELECT 
        e.id AS event_id,
        e.title,
        COUNT(r.id) AS cluster_score
    FROM events e
    JOIN rsvps r ON r.event_id = e.id
    JOIN profiles p ON p.id = r.user_id
    WHERE p.cluster_id = v_cluster_id
      AND r.user_id != p_user_id
    GROUP BY e.id, e.title
    ORDER BY cluster_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;