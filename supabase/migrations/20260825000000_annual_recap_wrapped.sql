-- Migration: 20260825000000_annual_recap_wrapped.sql
-- Description: Implement Spotify Wrapped yearly activity tracker caching and RPC functions.

-- 1. Create yearly_recaps cache table
CREATE TABLE IF NOT EXISTS public.yearly_recaps (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year INT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, year)
);

-- Enable RLS
ALTER TABLE public.yearly_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own yearly recap" ON public.yearly_recaps;
CREATE POLICY "Users can view own yearly recap" ON public.yearly_recaps
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Create the internal computation helper function
CREATE OR REPLACE FUNCTION public.get_yearly_recap_computed(p_user_id UUID, p_year INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_events_attended INT;
    v_top_category TEXT;
    v_top_category_count INT;
    v_most_visited_club TEXT;
    v_total_comments_posted INT;
    v_busiest_month TEXT;
    v_user_percentile INT;
BEGIN
    -- 1. Total events checked in
    SELECT COALESCE(COUNT(*), 0)::INT
    INTO v_total_events_attended
    FROM public.event_rsvps r
    WHERE r.user_id = p_user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = p_year;

    -- 2. Top category and count
    SELECT cat.name, COUNT(*)::INT
    INTO v_top_category, v_top_category_count
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    JOIN public.event_categories cat ON e.category_id = cat.id
    WHERE r.user_id = p_user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = p_year;

    -- 3. Most visited club
    SELECT c.name
    INTO v_most_visited_club
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    JOIN public.clubs c ON e.club_id = c.id
    WHERE r.user_id = p_user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = p_year;

    -- 4. Total comments posted
    SELECT COALESCE(COUNT(*), 0)::INT
    INTO v_total_comments_posted
    FROM public.comments c
    WHERE c.author_id = p_user_id
      AND EXTRACT(YEAR FROM c.created_at) = p_year;

    -- 5. Busiest month (activity check-in + comments)
    SELECT TO_CHAR(activity_date, 'FMMonth')
    INTO v_busiest_month
    FROM (
      SELECT r.rsvp_at AS activity_date
      FROM public.event_rsvps r
      WHERE r.user_id = p_user_id
        AND r.checked_in = TRUE
        AND EXTRACT(YEAR FROM r.rsvp_at) = p_year
      UNION ALL
      SELECT c.created_at AS activity_date
      FROM public.comments c
      WHERE c.author_id = p_user_id
        AND EXTRACT(YEAR FROM c.created_at) = p_year
    ) sub
    GROUP BY EXTRACT(MONTH FROM activity_date), TO_CHAR(activity_date, 'FMMonth')
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- 6. User Percentile Rank (lower = more active, e.g. top 5%)
    IF v_total_events_attended > 0 THEN
        WITH user_counts AS (
          SELECT r.user_id, COUNT(*) AS attended_count
          FROM public.event_rsvps r
          WHERE r.checked_in = TRUE
            AND EXTRACT(YEAR FROM r.rsvp_at) = p_year
          GROUP BY r.user_id
        ),
        user_ranks AS (
          SELECT user_id, attended_count,
                 PERCENT_RANK() OVER (ORDER BY attended_count ASC) AS pct
          FROM user_counts
        )
        SELECT COALESCE(ROUND((1 - pct) * 100)::INT, 1)
        INTO v_user_percentile
        FROM user_ranks
        WHERE user_ranks.user_id = p_user_id;
    ELSE
        v_user_percentile := 100;
    END IF;

    -- Build and return JSONB
    RETURN jsonb_build_object(
        'total_events_attended', COALESCE(v_total_events_attended, 0),
        'top_category', COALESCE(v_top_category, 'None'),
        'top_category_count', COALESCE(v_top_category_count, 0),
        'most_visited_club', COALESCE(v_most_visited_club, 'None'),
        'total_comments_posted', COALESCE(v_total_comments_posted, 0),
        'busiest_month', COALESCE(v_busiest_month, 'None'),
        'user_percentile', COALESCE(v_user_percentile, 100)
    );
END;
$$;

-- 3. Create the RPC function generate_yearly_recap
CREATE OR REPLACE FUNCTION public.generate_yearly_recap(user_id UUID, target_year INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payload JSONB;
BEGIN
    -- Check cache table first
    SELECT payload INTO v_payload
    FROM public.yearly_recaps y
    WHERE y.user_id = generate_yearly_recap.user_id
      AND y.year = generate_yearly_recap.target_year;

    IF NOT FOUND THEN
        -- Compute on the fly
        v_payload := public.get_yearly_recap_computed(generate_yearly_recap.user_id, generate_yearly_recap.target_year);
        -- Save cache
        INSERT INTO public.yearly_recaps (user_id, year, payload, updated_at)
        VALUES (generate_yearly_recap.user_id, generate_yearly_recap.target_year, v_payload, NOW())
        ON CONFLICT (user_id, year) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = NOW();
    END IF;

    RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_yearly_recap(UUID, INT) TO authenticated, service_role;

-- 4. Create the precompute batch background task
CREATE OR REPLACE FUNCTION public.precompute_yearly_recaps(target_year INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_payload JSONB;
BEGIN
    FOR r IN SELECT id FROM public.profiles LOOP
        BEGIN
            v_payload := public.get_yearly_recap_computed(r.id, target_year);
            INSERT INTO public.yearly_recaps (user_id, year, payload, updated_at)
            VALUES (r.id, target_year, v_payload, NOW())
            ON CONFLICT (user_id, year) DO UPDATE
            SET payload = EXCLUDED.payload,
                updated_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Skip failed rows to avoid breaking batch loop
            CONTINUE;
        END;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.precompute_yearly_recaps(INT) TO service_role;

-- 5. Schedule pg_cron precompute job mid-December (December 15th at midnight)
DO $$
BEGIN
    BEGIN
        PERFORM cron.unschedule('precompute-yearly-recaps');
    EXCEPTION WHEN OTHERS THEN
        -- Ignore if job does not exist
    END;

    PERFORM cron.schedule('precompute-yearly-recaps', '0 0 15 12 *', 'SELECT public.precompute_yearly_recaps(EXTRACT(YEAR FROM NOW())::INT);');
END $$;
