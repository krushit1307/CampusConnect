-- Migration: 20280907000000_parametric_insurance.sql
-- Description: Create tables to track Parametric Insurance policies and Oracle Consensus reports

CREATE TABLE IF NOT EXISTS public.parametric_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    premium_amount NUMERIC NOT NULL,
    coverage_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.oracle_weather_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES public.parametric_policies(id) ON DELETE CASCADE,
    oracle_source TEXT NOT NULL CHECK (oracle_source IN ('NOAA', 'AccuWeather', 'IoT_Rain_Gauge')),
    precipitation_inches NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.parametric_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_weather_reports ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Allow select on parametric policies for all authenticated users"
    ON public.parametric_policies FOR SELECT
    TO authenticated
    USING (true);

-- Insert policies
CREATE POLICY "Allow users to buy policies"
    ON public.parametric_policies FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Select reports
CREATE POLICY "Allow select on weather reports"
    ON public.oracle_weather_reports FOR SELECT
    TO authenticated
    USING (true);

-- Insert reports
CREATE POLICY "Allow oracle inserts"
    ON public.oracle_weather_reports FOR INSERT
    TO authenticated
    WITH CHECK (true);
