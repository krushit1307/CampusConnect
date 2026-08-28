-- Migration: 20260901000000_sponsor_logo_ab_testing.sql
-- Description: Schema and RPC functions for Sponsor Logo A/B Testing Engine

CREATE TABLE IF NOT EXISTS public.sponsor_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    sponsor_name TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'CONCLUDED')),
    logo_a_url TEXT NOT NULL,
    logo_a_alt_text TEXT,
    logo_a_target_url TEXT NOT NULL,
    logo_b_url TEXT NOT NULL,
    logo_b_alt_text TEXT,
    logo_b_target_url TEXT NOT NULL,
    traffic_split_a INT NOT NULL DEFAULT 50 CHECK (traffic_split_a BETWEEN 0 AND 100),
    traffic_split_b INT NOT NULL DEFAULT 50 CHECK (traffic_split_b BETWEEN 0 AND 100),
    sample_threshold INT NOT NULL DEFAULT 1000,
    winning_variant TEXT CHECK (winning_variant IN ('LOGO_A', 'LOGO_B', NULL)),
    winner_declared_at TIMESTAMPTZ,
    auto_promote_winner BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sponsor_ab_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.sponsor_ab_tests(id) ON DELETE CASCADE,
    variant_key TEXT NOT NULL CHECK (variant_key IN ('LOGO_A', 'LOGO_B')),
    impressions INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    ctr NUMERIC(6, 4) GENERATED ALWAYS AS (
        CASE WHEN impressions > 0 THEN ROUND((clicks::numeric / impressions::numeric) * 100, 4)
        ELSE 0.0000 END
    ) STORED,
    last_interaction_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_test_variant UNIQUE(test_id, variant_key)
);

CREATE TABLE IF NOT EXISTS public.sponsor_ab_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.sponsor_ab_tests(id) ON DELETE CASCADE,
    variant_key TEXT NOT NULL CHECK (variant_key IN ('LOGO_A', 'LOGO_B')),
    event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
    user_id UUID,
    session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning fast analytics aggregation
CREATE INDEX IF NOT EXISTS idx_sponsor_ab_tests_event ON public.sponsor_ab_tests(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_ab_events_test_variant ON public.sponsor_ab_events(test_id, variant_key, event_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_ab_metrics_test ON public.sponsor_ab_metrics(test_id);

-- Enable RLS
ALTER TABLE public.sponsor_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_ab_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_ab_events ENABLE ROW LEVEL SECURITY;

-- Public Read Policy for Event Banners
CREATE POLICY "Anyone can view active sponsor A/B tests"
    ON public.sponsor_ab_tests FOR SELECT
    USING (status = 'ACTIVE' OR status = 'CONCLUDED');

CREATE POLICY "Anyone can record impressions and clicks"
    ON public.sponsor_ab_events FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can view metrics summary"
    ON public.sponsor_ab_metrics FOR SELECT
    USING (true);

-- Atomic RPC function to record event and auto-evaluate when threshold reached
CREATE OR REPLACE FUNCTION record_sponsor_ab_interaction(
    p_test_id UUID,
    p_variant_key TEXT,
    p_event_type TEXT,
    p_user_id UUID DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_impressions INT;
    v_threshold INT;
    v_auto_promote BOOLEAN;
    v_imp_a INT := 0;
    v_clk_a INT := 0;
    v_imp_b INT := 0;
    v_clk_b INT := 0;
    v_pa NUMERIC;
    v_pb NUMERIC;
    v_pooled NUMERIC;
    v_se NUMERIC;
    v_z NUMERIC;
    v_winning_variant TEXT := NULL;
BEGIN
    -- Insert event log
    INSERT INTO public.sponsor_ab_events (test_id, variant_key, event_type, user_id, session_id)
    VALUES (p_test_id, p_variant_key, p_event_type, p_user_id, p_session_id);

    -- Update aggregated metrics
    IF p_event_type = 'impression' THEN
        INSERT INTO public.sponsor_ab_metrics (test_id, variant_key, impressions, clicks, last_interaction_at)
        VALUES (p_test_id, p_variant_key, 1, 0, now())
        ON CONFLICT (test_id, variant_key)
        DO UPDATE SET impressions = sponsor_ab_metrics.impressions + 1, last_interaction_at = now();
    ELSIF p_event_type = 'click' THEN
        INSERT INTO public.sponsor_ab_metrics (test_id, variant_key, impressions, clicks, last_interaction_at)
        VALUES (p_test_id, p_variant_key, 0, 1, now())
        ON CONFLICT (test_id, variant_key)
        DO UPDATE SET clicks = sponsor_ab_metrics.clicks + 1, last_interaction_at = now();
    END IF;

    -- Fetch test configuration and total impressions
    SELECT sample_threshold, auto_promote_winner, winning_variant
    INTO v_threshold, v_auto_promote, v_winning_variant
    FROM public.sponsor_ab_tests
    WHERE id = p_test_id;

    SELECT COALESCE(SUM(impressions), 0) INTO v_total_impressions
    FROM public.sponsor_ab_metrics
    WHERE test_id = p_test_id;

    -- Check if auto-promotion threshold is reached and winner not declared yet
    IF v_auto_promote AND v_winning_variant IS NULL AND v_total_impressions >= v_threshold THEN
        SELECT impressions, clicks INTO v_imp_a, v_clk_a
        FROM public.sponsor_ab_metrics WHERE test_id = p_test_id AND variant_key = 'LOGO_A';

        SELECT impressions, clicks INTO v_imp_b, v_clk_b
        FROM public.sponsor_ab_metrics WHERE test_id = p_test_id AND variant_key = 'LOGO_B';

        v_pa := CASE WHEN v_imp_a > 0 THEN v_clk_a::numeric / v_imp_a::numeric ELSE 0.0 END;
        v_pb := CASE WHEN v_imp_b > 0 THEN v_clk_b::numeric / v_imp_b::numeric ELSE 0.0 END;

        -- We only promote B if B has a higher CTR than A with 99% significance (one-tailed: Z <= -2.326)
        IF v_pb > v_pa AND v_imp_a > 0 AND v_imp_b > 0 THEN
            v_pooled := (v_clk_a + v_clk_b)::numeric / (v_imp_a + v_imp_b)::numeric;
            IF v_pooled > 0 AND v_pooled < 1 THEN
                v_se := sqrt(v_pooled * (1.0 - v_pooled) * (1.0 / v_imp_a::numeric + 1.0 / v_imp_b::numeric));
                IF v_se > 0 THEN
                    v_z := (v_pa - v_pb) / v_se;
                    IF v_z <= -2.326 THEN
                        v_winning_variant := 'LOGO_B';
                    END IF;
                END IF;
            END IF;
        END IF;

        IF v_winning_variant IS NOT NULL THEN
            UPDATE public.sponsor_ab_tests
            SET winning_variant = v_winning_variant,
                winner_declared_at = now(),
                status = 'CONCLUDED',
                traffic_split_a = CASE WHEN v_winning_variant = 'LOGO_A' THEN 100 ELSE 0 END,
                traffic_split_b = CASE WHEN v_winning_variant = 'LOGO_B' THEN 100 ELSE 0 END,
                updated_at = now()
            WHERE id = p_test_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'test_id', p_test_id,
        'variant_key', p_variant_key,
        'event_type', p_event_type,
        'total_impressions', v_total_impressions,
        'winning_variant', v_winning_variant
    );
END;
$$;
