-- Migration: Automated Club Succession Planning Health Score & Continuity Monitor
-- Addresses Issue #4138

-- Ensure expected_graduation_year exists on profiles/users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'expected_graduation_year'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN expected_graduation_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT + 2;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.club_succession_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL,
    club_name VARCHAR(255) NOT NULL,
    academic_year INT NOT NULL,
    total_executives INT NOT NULL DEFAULT 0,
    graduating_executives_count INT NOT NULL DEFAULT 0,
    graduating_executives_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    underclassmen_in_pipeline INT NOT NULL DEFAULT 0,
    health_score INT NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'HEALTHY' CHECK (risk_level IN ('HEALTHY', 'MODERATE_RISK', 'CRITICAL_SUCCESSION_RISK')),
    has_active_transition_plan BOOLEAN DEFAULT FALSE,
    flagged_to_student_union BOOLEAN DEFAULT FALSE,
    last_evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, academic_year)
);

CREATE TABLE IF NOT EXISTS public.club_succession_nominations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL,
    nominee_user_id UUID NOT NULL,
    nominee_name VARCHAR(255) NOT NULL,
    target_role VARCHAR(100) NOT NULL,
    graduation_year INT NOT NULL,
    nominated_by_user_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'SHADOWING', 'CONFIRMED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.club_leadership_transition_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL UNIQUE,
    current_president_id UUID NOT NULL,
    successor_id UUID,
    handover_checklist JSONB DEFAULT '[]'::jsonb,
    is_completed BOOLEAN DEFAULT FALSE,
    target_handover_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_succession_club ON public.club_succession_health_metrics(club_id);
CREATE INDEX IF NOT EXISTS idx_succession_risk ON public.club_succession_health_metrics(risk_level);
CREATE INDEX IF NOT EXISTS idx_succession_nominations_club ON public.club_succession_nominations(club_id);

-- RLS
ALTER TABLE public.club_succession_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_succession_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_leadership_transition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for club succession metrics" ON public.club_succession_health_metrics FOR SELECT USING (true);
CREATE POLICY "Public read for club nominations" ON public.club_succession_nominations FOR SELECT USING (true);
CREATE POLICY "Club officers can update nominations" ON public.club_succession_nominations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Club officers can manage transition plans" ON public.club_leadership_transition_plans FOR ALL USING (true) WITH CHECK (true);

-- Stored function to calculate club succession health
CREATE OR REPLACE FUNCTION public.calculate_club_succession_health(
    p_club_id UUID,
    p_current_academic_year INT
)
RETURNS JSONB AS $$
DECLARE
    v_total_execs INT := 0;
    v_grad_execs INT := 0;
    v_ratio NUMERIC(5,2) := 0.00;
    v_underclassmen_pipeline INT := 0;
    v_score INT := 100;
    v_risk VARCHAR(30) := 'HEALTHY';
    v_flagged BOOLEAN := FALSE;
BEGIN
    -- Query leadership count
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE p.expected_graduation_year <= p_current_academic_year)
    INTO v_total_execs, v_grad_execs
    FROM public.club_roles cr
    JOIN public.profiles p ON p.id = cr.user_id
    WHERE cr.club_id = p_club_id
      AND cr.role IN ('President', 'Admin', 'Executive', 'Vice President', 'Treasurer');

    -- Query underclassmen in pipeline / committee
    SELECT COUNT(*)
    INTO v_underclassmen_pipeline
    FROM public.club_roles cr
    JOIN public.profiles p ON p.id = cr.user_id
    WHERE cr.club_id = p_club_id
      AND cr.role IN ('Committee', 'Vice President', 'Officer-in-Training')
      AND p.expected_graduation_year > (p_current_academic_year + 1);

    IF v_total_execs > 0 THEN
        v_ratio := ROUND((v_grad_execs::NUMERIC / v_total_execs::NUMERIC) * 100.0, 2);
    ELSE
        v_ratio := 0.00;
    END IF;

    -- Heuristic computation
    IF v_ratio > 75.0 AND v_underclassmen_pipeline = 0 THEN
        v_risk := 'CRITICAL_SUCCESSION_RISK';
        v_score := GREATEST(10, 100 - (v_ratio::INT) - 20);
        v_flagged := TRUE;
    ELSIF v_ratio > 50.0 OR v_underclassmen_pipeline = 0 THEN
        v_risk := 'MODERATE_RISK';
        v_score := GREATEST(40, 100 - (v_ratio::INT / 2));
    ELSE
        v_risk := 'HEALTHY';
        v_score := 95;
    END IF;

    -- Upsert metrics record
    INSERT INTO public.club_succession_health_metrics (
        club_id,
        club_name,
        academic_year,
        total_executives,
        graduating_executives_count,
        graduating_executives_ratio,
        underclassmen_in_pipeline,
        health_score,
        risk_level,
        flagged_to_student_union,
        last_evaluated_at
    )
    VALUES (
        p_club_id,
        'Active Student Organization',
        p_current_academic_year,
        v_total_execs,
        v_grad_execs,
        v_ratio,
        v_underclassmen_pipeline,
        v_score,
        v_risk,
        v_flagged,
        NOW()
    )
    ON CONFLICT (club_id, academic_year) DO UPDATE
    SET 
        total_executives = EXCLUDED.total_executives,
        graduating_executives_count = EXCLUDED.graduating_executives_count,
        graduating_executives_ratio = EXCLUDED.graduating_executives_ratio,
        underclassmen_in_pipeline = EXCLUDED.underclassmen_in_pipeline,
        health_score = EXCLUDED.health_score,
        risk_level = EXCLUDED.risk_level,
        flagged_to_student_union = EXCLUDED.flagged_to_student_union,
        last_evaluated_at = NOW();

    RETURN jsonb_build_object(
        'club_id', p_club_id,
        'health_score', v_score,
        'risk_level', v_risk,
        'graduating_ratio', v_ratio,
        'underclassmen_in_pipeline', v_underclassmen_pipeline,
        'flagged', v_flagged
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
