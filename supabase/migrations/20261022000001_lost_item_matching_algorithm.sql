-- Migration: 20261022000001_lost_item_matching_algorithm.sql
-- Description: Add type and coordinates to lost_items, create matches table and scoring triggers (#3249).

-- 1. Extend lost_items table
ALTER TABLE public.lost_items
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'lost' CHECK (type IN ('lost', 'found')),
    ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Index for spatial matching lookup
CREATE INDEX IF NOT EXISTS idx_lost_items_coords
    ON public.lost_items(lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 2. Create lost_item_matches table
CREATE TABLE IF NOT EXISTS public.lost_item_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
    found_item_id UUID NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_lost_found_match UNIQUE (lost_item_id, found_item_id)
);

-- Enable RLS on lost_item_matches
ALTER TABLE public.lost_item_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view matches for their own items"
    ON public.lost_item_matches FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.lost_items li
            WHERE (li.id = lost_item_matches.lost_item_id OR li.id = lost_item_matches.found_item_id)
            AND li.user_id = auth.uid()
        )
    );

-- 3. Match evaluation trigger function
CREATE OR REPLACE FUNCTION public.evaluate_lost_item_matches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate RECORD;
    v_match_count INTEGER;
    v_new_len INTEGER;
    v_cand_len INTEGER;
    v_total_unique INTEGER;
    v_tag_score DOUBLE PRECISION;
    v_spatial_score DOUBLE PRECISION;
    v_temporal_score DOUBLE PRECISION;
    v_total_score DOUBLE PRECISION;
    v_distance DOUBLE PRECISION;
    v_days_diff DOUBLE PRECISION;
    v_lost_id UUID;
    v_found_id UUID;
BEGIN
    -- Only evaluate unclaimed items
    IF NEW.status != 'unclaimed' THEN
        RETURN NEW;
    END IF;

    -- Loop over all unclaimed items of the opposite type
    FOR v_candidate IN
        SELECT id, user_id, search_tags, event_id, lat, lng, created_at
        FROM public.lost_items
        WHERE type != NEW.type
          AND status = 'unclaimed'
          AND user_id != NEW.user_id -- Don't match user with themselves
    LOOP
        -- A. Calculate Tag Similarity (up to 40 pts)
        v_new_len := COALESCE(jsonb_array_length(NEW.search_tags), 0);
        v_cand_len := COALESCE(jsonb_array_length(v_candidate.search_tags), 0);

        IF v_new_len > 0 AND v_cand_len > 0 THEN
            SELECT count(*) INTO v_match_count FROM (
                SELECT jsonb_array_elements_text(NEW.search_tags)
                INTERSECT
                SELECT jsonb_array_elements_text(v_candidate.search_tags)
            ) t;

            v_total_unique := v_new_len + v_cand_len - v_match_count;
            IF v_total_unique > 0 THEN
                v_tag_score := (v_match_count::DOUBLE PRECISION / v_total_unique) * 40.0;
            ELSE
                v_tag_score := 0.0;
            END IF;
        ELSE
            v_tag_score := 0.0;
        END IF;

        -- B. Calculate Spatial Proximity (up to 40 pts)
        IF NEW.event_id IS NOT NULL AND v_candidate.event_id = NEW.event_id THEN
            v_spatial_score := 40.0;
        ELSIF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL AND v_candidate.lat IS NOT NULL AND v_candidate.lng IS NOT NULL THEN
            -- Distance in km using haversine_distance function
            v_distance := public.haversine_distance(NEW.lat, NEW.lng, v_candidate.lat, v_candidate.lng);
            IF v_distance <= 0.05 THEN
                v_spatial_score := 40.0; -- 50 meters
            ELSIF v_distance <= 0.2 THEN
                v_spatial_score := 20.0; -- 200 meters
            ELSIF v_distance <= 0.5 THEN
                v_spatial_score := 10.0; -- 500 meters
            ELSE
                v_spatial_score := 0.0;
            END IF;
        ELSE
            v_spatial_score := 0.0;
        END IF;

        -- C. Calculate Temporal Proximity (up to 20 pts)
        v_days_diff := ABS(EXTRACT(EPOCH FROM (NEW.created_at - v_candidate.created_at))) / 86400.0;
        IF v_days_diff <= 1.0 THEN
            v_temporal_score := 20.0;
        ELSIF v_days_diff <= 3.0 THEN
            v_temporal_score := 15.0;
        ELSIF v_days_diff <= 7.0 THEN
            v_temporal_score := 10.0;
        ELSIF v_days_diff <= 14.0 THEN
            v_temporal_score := 5.0;
        ELSE
            v_temporal_score := 0.0;
        END IF;

        -- Sum matching score
        v_total_score := v_tag_score + v_spatial_score + v_temporal_score;

        -- Flag match if score >= 75
        IF v_total_score >= 75.0 THEN
            IF NEW.type = 'lost' THEN
                v_lost_id := NEW.id;
                v_found_id := v_candidate.id;
            ELSE
                v_lost_id := v_candidate.id;
                v_found_id := NEW.id;
            END IF;

            INSERT INTO public.lost_item_matches (lost_item_id, found_item_id, score)
            VALUES (v_lost_id, v_found_id, v_total_score)
            ON CONFLICT (lost_item_id, found_item_id) DO UPDATE
            SET score = EXCLUDED.score;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Bind trigger to lost_items
DROP TRIGGER IF EXISTS trigger_evaluate_lost_item_matches ON public.lost_items;
CREATE TRIGGER trigger_evaluate_lost_item_matches
    AFTER INSERT ON public.lost_items
    FOR EACH ROW
    EXECUTE FUNCTION public.evaluate_lost_item_matches();

-- 4. Transactional Outbox integration
DROP TRIGGER IF EXISTS trigger_lost_item_matches_outbox ON public.lost_item_matches;
CREATE TRIGGER trigger_lost_item_matches_outbox
    AFTER INSERT ON public.lost_item_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_outbox_event();
