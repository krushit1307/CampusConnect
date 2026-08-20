-- Migration: 20260909000000_kiosk_hardware_telemetry.sql
-- Description: Issue #3455 - Develop a 'Real-Time Hardware Metrics Dashboard' for Kiosks

-- 1. Create kiosk_devices table for real-time fleet telemetry
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
    device_id TEXT PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    battery_level INT NOT NULL DEFAULT 100,
    is_charging BOOLEAN NOT NULL DEFAULT true,
    ping_ms INT NOT NULL DEFAULT 20,
    network_type TEXT DEFAULT 'wifi',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying kiosks by event
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_event ON public.kiosk_devices (event_id, last_seen DESC);

-- Enable RLS
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view kiosk telemetry
DROP POLICY IF EXISTS "Kiosk devices readable by authenticated users" ON public.kiosk_devices;
CREATE POLICY "Kiosk devices readable by authenticated users"
    ON public.kiosk_devices FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated kiosk users / service role to upsert hardware metrics
DROP POLICY IF EXISTS "Kiosk devices insertable by authenticated users" ON public.kiosk_devices;
CREATE POLICY "Kiosk devices insertable by authenticated users"
    ON public.kiosk_devices FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Kiosk devices updatable by authenticated users" ON public.kiosk_devices;
CREATE POLICY "Kiosk devices updatable by authenticated users"
    ON public.kiosk_devices FOR UPDATE
    TO authenticated
    USING (true);

-- Enable Realtime publication for kiosk_devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_devices;
