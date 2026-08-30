-- =============================================================================
-- Migration: 20270912000000_thermal_overcrowding_detector.sql
-- Description: Issue #5007 - Dynamic "Mental Health" Thermal Overcrowding Detection
-- =============================================================================

BEGIN;

-- 1. Create thermostat_telemetry table
CREATE TABLE IF NOT EXISTS public.thermostat_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    temperature_fahrenheit NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create thermal_alerts table
CREATE TABLE IF NOT EXISTS public.thermal_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    initial_temp NUMERIC NOT NULL,
    current_temp NUMERIC NOT NULL,
    temp_spike NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('TRIGGERED', 'RESOLVED')) DEFAULT 'TRIGGERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 3. Indexes for fast rolling metrics lookup
CREATE INDEX IF NOT EXISTS idx_thermostat_telemetry_lookup 
    ON public.thermostat_telemetry(venue_id, recorded_at ASC);

CREATE INDEX IF NOT EXISTS idx_thermal_alerts_venue 
    ON public.thermal_alerts(venue_id, status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.thermostat_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thermal_alerts ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Allow public select of telemetry"
ON public.thermostat_telemetry FOR SELECT USING (true);

CREATE POLICY "Allow public select of thermal alerts"
ON public.thermal_alerts FOR SELECT USING (true);

CREATE POLICY "Admins and managers can manage telemetry"
ON public.thermostat_telemetry FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('system_admin', 'facility_manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('system_admin', 'facility_manager')
    )
);

CREATE POLICY "Admins and managers can manage thermal alerts"
ON public.thermal_alerts FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('system_admin', 'facility_manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('system_admin', 'facility_manager')
    )
);

-- 6. Ingest reading function that performs Delta T lookback checks
CREATE OR REPLACE FUNCTION public.ingest_thermostat_reading(
    p_venue_id UUID,
    p_temperature NUMERIC,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_baseline_temp NUMERIC;
    v_baseline_time TIMESTAMPTZ;
    v_delta_t NUMERIC;
    v_active_alert_id UUID;
    v_new_alert_id UUID;
    v_admin_id UUID;
    v_venue_name TEXT;
    v_alert_triggered BOOLEAN := FALSE;
BEGIN
    -- 1. Insert telemetry reading
    INSERT INTO public.thermostat_telemetry (venue_id, temperature_fahrenheit, recorded_at)
    VALUES (p_venue_id, p_temperature, p_now);

    -- 2. Fetch oldest reading in rolling 20 minutes lookback window
    SELECT temperature_fahrenheit, recorded_at 
    INTO v_baseline_temp, v_baseline_time
    FROM public.thermostat_telemetry
    WHERE venue_id = p_venue_id
      AND recorded_at >= p_now - INTERVAL '20 minutes'
      AND recorded_at < p_now
    ORDER BY recorded_at ASC
    LIMIT 1;

    -- If no historical data point exists in window, default baseline to the current reading
    IF NOT FOUND THEN
        v_baseline_temp := p_temperature;
        v_baseline_time := p_now;
    END IF;

    -- Calculate Delta T spike rate
    v_delta_t := p_temperature - v_baseline_temp;

    -- 3. Evaluate anomaly trigger (Delta T >= 10 degrees Fahrenheit)
    IF v_delta_t >= 10.0 THEN
        -- Check if alert is already active to prevent duplicates
        SELECT id INTO v_active_alert_id 
        FROM public.thermal_alerts 
        WHERE venue_id = p_venue_id AND status = 'TRIGGERED';

        IF v_active_alert_id IS NULL THEN
            -- Create thermal alert
            INSERT INTO public.thermal_alerts (venue_id, initial_temp, current_temp, temp_spike, status, created_at)
            VALUES (p_venue_id, v_baseline_temp, p_temperature, v_delta_t, 'TRIGGERED', p_now)
            RETURNING id INTO v_new_alert_id;

            v_alert_triggered := TRUE;

            -- Get venue display details
            SELECT COALESCE(building || ' - ' || name, name) INTO v_venue_name 
            FROM public.venues WHERE id = p_venue_id;

            -- Dispatch emergency alerts to all system admins in public.notifications
            FOR v_admin_id IN SELECT id FROM public.profiles WHERE role = 'system_admin'
            LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link)
                VALUES (
                    v_admin_id,
                    'security_alert',
                    'Thermal Overcrowding Incident',
                    'Anomalous biological heat surge of ' || ROUND(v_delta_t, 1)::TEXT || ' F detected in ' || COALESCE(v_venue_name, 'room') || '. Safe capacity exceeded.',
                    '/facility-dashboard'
                );
            END LOOP;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'delta_t', ROUND(v_delta_t, 2),
        'baseline_temp', ROUND(v_baseline_temp, 2),
        'alert_triggered', v_alert_triggered,
        'alert_id', COALESCE(v_new_alert_id, v_active_alert_id)
    );
END;
$$;

COMMIT;
