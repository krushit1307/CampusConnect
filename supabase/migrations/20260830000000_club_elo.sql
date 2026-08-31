-- Migration for Dynamic "Club Leaderboard" ELO Ranking System (#4906)

-- 1. Add ELO rating to clubs
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS elo_rating NUMERIC(10, 2) DEFAULT 1200.00;

-- 2. Create match history ledger
CREATE TABLE IF NOT EXISTS public.club_elo_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    club_a_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    club_b_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    club_a_performance NUMERIC(10, 2) NOT NULL,
    club_b_performance NUMERIC(10, 2) NOT NULL,
    club_a_elo_before NUMERIC(10, 2) NOT NULL,
    club_b_elo_before NUMERIC(10, 2) NOT NULL,
    club_a_elo_after NUMERIC(10, 2) NOT NULL,
    club_b_elo_after NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.club_elo_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ELO matches"
    ON public.club_elo_matches FOR SELECT
    USING (true);

-- Schedule weekly ELO processing via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'process-club-elo-weekly',
    '0 0 * * 0', -- Every Sunday at midnight
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/process-club-elo',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    );
    $$
);
