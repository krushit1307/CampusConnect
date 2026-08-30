-- Migration for Dynamic "Carpool" Autonomous Shuttle Predictive Dispatching (#4909)

-- 1. Add dorm_location to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dorm_location TEXT;

-- 2. Create shuttle pre-positioning clusters log
CREATE TABLE IF NOT EXISTS public.shuttle_pre_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    dorm_location TEXT NOT NULL,
    dispatch_time TIMESTAMPTZ NOT NULL,
    predicted_demand INTEGER NOT NULL,
    shuttles_dispatched INTEGER NOT NULL,
    status TEXT DEFAULT 'dispatching' CHECK (status IN ('dispatching', 'idling', 'boarding', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.shuttle_pre_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pre-positions"
    ON public.shuttle_pre_positions FOR SELECT
    USING (true);

-- 3. Schedule the Cron Job for 6:00 PM Daily
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'predictive-shuttle-dispatch-daily',
    '0 18 * * *', -- 6:00 PM every day
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/predictive-shuttle-dispatch',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    );
    $$
);
