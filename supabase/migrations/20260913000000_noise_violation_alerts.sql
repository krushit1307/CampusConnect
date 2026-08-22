-- Migration: 20260913000000_noise_violation_alerts.sql
-- Description: Issue #3684 - Build a 'Real-Time "Decibel/Noise" Violation Alert'

-- Create noise_violation_logs table for logging decibel threshold violations & liability tracking
CREATE TABLE IF NOT EXISTS public.noise_violation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    venue_id TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    decibels INT NOT NULL,
    duration_minutes INT NOT NULL,
    warning_level TEXT NOT NULL DEFAULT 'CRITICAL', -- 'WARNING' | 'CRITICAL'
    warning_count INT NOT NULL DEFAULT 1,
    alert_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying noise violations by event and venue
CREATE INDEX IF NOT EXISTS idx_noise_violation_event ON public.noise_violation_logs (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_noise_violation_venue ON public.noise_violation_logs (venue_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.noise_violation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Noise violation logs readable by authenticated users" ON public.noise_violation_logs;
CREATE POLICY "Noise violation logs readable by authenticated users"
    ON public.noise_violation_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Noise violation logs insertable by authenticated users" ON public.noise_violation_logs;
CREATE POLICY "Noise violation logs insertable by authenticated users"
    ON public.noise_violation_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.noise_violation_logs;
