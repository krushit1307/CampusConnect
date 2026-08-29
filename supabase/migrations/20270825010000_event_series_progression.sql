-- Migration: Automated Event Series Progression Tracking & Gamification
-- Addresses Issue #3934

CREATE TABLE IF NOT EXISTS public.event_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    club_id UUID,
    total_events INT NOT NULL DEFAULT 1,
    required_completion_percentage INT NOT NULL DEFAULT 100,
    reward_type VARCHAR(50) DEFAULT 'PITCH_FUNDING_ELIGIBILITY' CHECK (reward_type IN ('PITCH_FUNDING_ELIGIBILITY', 'CERTIFICATE_OF_MASTERY', 'BADGE', 'SWAG_GRANT')),
    reward_title VARCHAR(255) DEFAULT 'Startup Pitch Grant & Certificate',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_series_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    session_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, session_number),
    UNIQUE(series_id, event_id)
);

CREATE TABLE IF NOT EXISTS public.event_series_user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    attended_event_ids UUID[] DEFAULT '{}',
    events_attended INT DEFAULT 0,
    total_events INT DEFAULT 0,
    completion_percentage NUMERIC(5,2) DEFAULT 0.00,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    reward_claimed BOOLEAN DEFAULT FALSE,
    reward_claimed_at TIMESTAMPTZ,
    last_attended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_series_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
    milestone_name VARCHAR(100) NOT NULL,
    required_attended_count INT NOT NULL,
    badge_icon VARCHAR(50) DEFAULT 'trophy',
    perk_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_series_progress_user ON public.event_series_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_series_progress_series ON public.event_series_user_progress(series_id);
CREATE INDEX IF NOT EXISTS idx_series_events_lookup ON public.event_series_events(series_id, session_number);

-- RLS
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for event series" ON public.event_series FOR SELECT USING (true);
CREATE POLICY "Public read for series events" ON public.event_series_events FOR SELECT USING (true);
CREATE POLICY "Public read for series milestones" ON public.event_series_milestones FOR SELECT USING (true);

CREATE POLICY "Users can view their own series progress" ON public.event_series_user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their series progress" ON public.event_series_user_progress
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger / Stored function to automatically recalculate completion percentage
CREATE OR REPLACE FUNCTION public.recalculate_series_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total INT;
    v_attended INT;
    v_percentage NUMERIC(5,2);
    v_req_percentage INT;
BEGIN
    SELECT total_events, required_completion_percentage 
    INTO v_total, v_req_percentage
    FROM public.event_series
    WHERE id = NEW.series_id;

    IF v_total IS NULL OR v_total = 0 THEN
        v_total := 1;
    END IF;

    v_attended := array_length(NEW.attended_event_ids, 1);
    IF v_attended IS NULL THEN
        v_attended := 0;
    END IF;

    v_percentage := ROUND((v_attended::NUMERIC / v_total::NUMERIC) * 100.0, 2);
    IF v_percentage > 100.0 THEN
        v_percentage := 100.0;
    END IF;

    NEW.events_attended := v_attended;
    NEW.total_events := v_total;
    NEW.completion_percentage := v_percentage;

    IF v_percentage >= v_req_percentage AND NOT NEW.is_completed THEN
        NEW.is_completed := TRUE;
        NEW.completed_at := NOW();
    ELSIF v_percentage < v_req_percentage THEN
        NEW.is_completed := FALSE;
        NEW.completed_at := NULL;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalculate_series_progress ON public.event_series_user_progress;
CREATE TRIGGER trg_recalculate_series_progress
BEFORE INSERT OR UPDATE ON public.event_series_user_progress
FOR EACH ROW EXECUTE FUNCTION public.recalculate_series_progress();
