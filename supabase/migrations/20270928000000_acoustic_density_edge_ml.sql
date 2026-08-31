-- =============================================================================
-- Migration: 20270928000000_acoustic_density_edge_ml.sql
-- Description: Issue #5378 - Acoustic Density Edge ML Overcrowding Triangulation
-- =============================================================================

BEGIN;

-- 1. Create acoustic_microphones table
CREATE TABLE IF NOT EXISTS public.acoustic_microphones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    firmware_version TEXT NOT NULL DEFAULT 'v1.0.0',
    is_model_flashed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create acoustic_density_telemetry table
CREATE TABLE IF NOT EXISTS public.acoustic_density_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microphone_id UUID NOT NULL REFERENCES public.acoustic_microphones(id) ON DELETE CASCADE,
    density_score INTEGER NOT NULL CHECK (density_score >= 0 AND density_score <= 100),
    mqtt_topic TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create acoustic_overcrowding_alerts table
CREATE TABLE IF NOT EXISTS public.acoustic_overcrowding_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microphone_id UUID NOT NULL REFERENCES public.acoustic_microphones(id) ON DELETE CASCADE,
    density_score INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('TRIGGERED', 'RESOLVED')) DEFAULT 'TRIGGERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 4. Enable RLS
ALTER TABLE public.acoustic_microphones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acoustic_density_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acoustic_overcrowding_alerts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Allow public select of acoustic microphones"
ON public.acoustic_microphones FOR SELECT USING (true);

CREATE POLICY "Allow public select of acoustic density telemetry"
ON public.acoustic_density_telemetry FOR SELECT USING (true);

CREATE POLICY "Allow public select of acoustic alerts"
ON public.acoustic_overcrowding_alerts FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of microphones"
ON public.acoustic_microphones FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage of telemetry"
ON public.acoustic_density_telemetry FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage of acoustic alerts"
ON public.acoustic_overcrowding_alerts FOR ALL TO authenticated USING (true);

-- 6. RPC to ingest MQTT Edge ML acoustic density telemetry and trigger security notifications
CREATE OR REPLACE FUNCTION public.ingest_acoustic_density(
    p_microphone_id UUID,
    p_density_score INTEGER,
    p_mqtt_topic TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_microphone RECORD;
    v_active_alert_id UUID;
    v_new_alert_id UUID;
    v_admin_id UUID;
    v_venue_name TEXT;
    v_alert_triggered BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- 1. Verify microphone exists
    SELECT * INTO v_microphone FROM public.acoustic_microphones 
    WHERE id = p_microphone_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Acoustic microphone array device not found.');
    END IF;

    -- 2. Insert telemetry log (Privacy Guaranteed: continuous audio deleted locally, only score sent)
    INSERT INTO public.acoustic_density_telemetry (microphone_id, density_score, mqtt_topic, recorded_at)
    VALUES (p_microphone_id, p_density_score, p_mqtt_topic, p_now);

    -- 3. Evaluate overcrowding threshold (density_score >= 85)
    IF p_density_score >= 85 THEN
        -- Check if an alert is already active
        SELECT id INTO v_active_alert_id 
        FROM public.acoustic_overcrowding_alerts
        WHERE microphone_id = p_microphone_id AND status = 'TRIGGERED';

        IF v_active_alert_id IS NULL THEN
            -- Create new overcrowding alert
            INSERT INTO public.acoustic_overcrowding_alerts (microphone_id, density_score, status, created_at)
            VALUES (p_microphone_id, p_density_score, 'TRIGGERED', p_now)
            RETURNING id INTO v_new_alert_id;

            v_alert_triggered := TRUE;

            -- Get venue info
            SELECT COALESCE(v.building || ' - ' || v.name, v.name) INTO v_venue_name
            FROM public.venues v
            WHERE v.id = v_microphone.venue_id;

            -- Dispatch security notifications to all system administrators
            FOR v_admin_id IN SELECT id FROM public.profiles WHERE role = 'system_admin'
            LOOP
                INSERT INTO public.notifications (user_id, type, title, message, link)
                VALUES (
                    v_admin_id,
                    'security_alert',
                    'Acoustic Overcrowding Incident',
                    'Anomalous sound density score of ' || p_density_score::TEXT || '% detected in room ' || v_microphone.room_number || ' (' || COALESCE(v_venue_name, 'Unknown Venue') || '). Privacy-preserved acoustic threshold exceeded.',
                    '/facility-dashboard'
                );
            END LOOP;
        END IF;
    END IF;

    SELECT jsonb_build_object(
        'success', TRUE,
        'alert_triggered', v_alert_triggered,
        'density_score', p_density_score,
        'alert_id', COALESCE(v_new_alert_id, v_active_alert_id)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
