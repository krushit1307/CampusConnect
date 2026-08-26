-- Enable pg_trgm extension for fuzzy similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes for fast case-insensitive search
CREATE INDEX IF NOT EXISTS idx_clubs_name_trgm ON clubs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clubs_description_trgm ON clubs USING gin (description gin_trgm_ops);

-- Create the optimized search function for clubs
CREATE OR REPLACE FUNCTION search_clubs(query_text TEXT)
RETURNS SETOF clubs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF query_text IS NULL OR TRIM(query_text) = '' THEN
        RETURN QUERY SELECT * FROM clubs;
    ELSE
        RETURN QUERY 
        SELECT *
        FROM clubs
        WHERE name ILIKE '%' || query_text || '%'
           OR description ILIKE '%' || query_text || '%'
        ORDER BY similarity(name, query_text) DESC;
    END IF;
END;
$$;
