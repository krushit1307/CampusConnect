-- Migration: Cosine Similarity Recommendations
-- Timestamp: 20260805100000

-- 1. Add user_tags to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_tags text[] DEFAULT '{}'::text[];

-- 2. Add club_tags and active to clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS club_tags text[] DEFAULT '{}'::text[];
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 3. Create indices for tag querying speed
CREATE INDEX IF NOT EXISTS idx_profiles_user_tags ON public.profiles USING gin (user_tags);
CREATE INDEX IF NOT EXISTS idx_clubs_club_tags ON public.clubs USING gin (club_tags);
CREATE INDEX IF NOT EXISTS idx_clubs_active ON public.clubs (active);

-- 4. Create the calculate_cosine_similarity function
CREATE OR REPLACE FUNCTION public.calculate_cosine_similarity(arrayA text[], arrayB text[])
RETURNS double precision AS $$
DECLARE
    intersection_count integer;
    lenA integer;
    lenB integer;
BEGIN
    IF arrayA IS NULL OR arrayB IS NULL THEN
        RETURN 0.0;
    END IF;

    lenA := cardinality(arrayA);
    lenB := cardinality(arrayB);

    IF lenA = 0 OR lenB = 0 THEN
        RETURN 0.0;
    END IF;

    -- Calculate tag intersections using sets
    SELECT count(*) INTO intersection_count
    FROM (
        SELECT unnest(arrayA)
        INTERSECT
        SELECT unnest(arrayB)
    ) AS temp;

    IF intersection_count = 0 THEN
        RETURN 0.0;
    END IF;

    -- Cosine Similarity: intersection_count / sqrt(lenA * lenB)
    RETURN intersection_count::double precision / sqrt(lenA::double precision * lenB::double precision);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create get_cosine_recommendations RPC wrapper function
CREATE OR REPLACE FUNCTION public.get_cosine_recommendations(p_user_id UUID, p_limit INT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    logo_url TEXT,
    club_tags TEXT[],
    score DOUBLE PRECISION
) AS $$
DECLARE
    v_user_tags text[];
BEGIN
    -- Fetch user's tags
    SELECT user_tags INTO v_user_tags
    FROM public.profiles
    WHERE profiles.id = p_user_id;

    IF v_user_tags IS NULL OR cardinality(v_user_tags) = 0 THEN
        -- If user has no tags, return active clubs with score 0
        RETURN QUERY
        SELECT c.id, c.name, c.description, c.logo_url, c.club_tags, 0.0::double precision as score
        FROM public.clubs c
        WHERE c.active = true
        ORDER BY c.created_at DESC
        LIMIT p_limit;
    ELSE
        -- Return similarity ordered clubs
        RETURN QUERY
        SELECT c.id, c.name, c.description, c.logo_url, c.club_tags,
               public.calculate_cosine_similarity(v_user_tags, c.club_tags) as score
        FROM public.clubs c
        WHERE c.active = true
        ORDER BY score DESC, c.created_at DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
