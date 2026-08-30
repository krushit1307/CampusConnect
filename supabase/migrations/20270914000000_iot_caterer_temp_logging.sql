-- =============================================================================
-- Migration: 20270914000000_iot_caterer_temp_logging.sql
-- Description: Issue #5010 - Live IoT Temperature Logging & Food Safety Validation
-- =============================================================================

BEGIN;

-- 1. Extend event_caterer_contracts with shipment and Stripe block flags
ALTER TABLE public.event_caterer_contracts 
ADD COLUMN IF NOT EXISTS shipment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (shipment_status IN ('PENDING', 'SAFE', 'CONDEMNED')),
ADD COLUMN IF NOT EXISTS stripe_payment_blocked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 2. Create caterer_iot_temp_logs table for time-series IoT readings
CREATE TABLE IF NOT EXISTS public.caterer_iot_temp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.event_caterer_contracts(id) ON DELETE CASCADE,
    temperature_fahrenheit NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.caterer_iot_temp_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Allow public select of caterer temp logs"
ON public.caterer_iot_temp_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of caterer temp logs"
ON public.caterer_iot_temp_logs FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Time-series FDA Danger Zone Validation RPC
CREATE OR REPLACE FUNCTION public.upload_caterer_temp_logs(
    p_contract_id UUID,
    p_logs JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_record RECORD;
    v_danger_start TIMESTAMPTZ := NULL;
    v_is_condemned BOOLEAN := FALSE;
    v_event_id UUID;
    v_organizer_id UUID;
    v_caterer_name TEXT;
    v_event_title TEXT;
BEGIN
    -- Delete previous logs if overriding
    DELETE FROM public.caterer_iot_temp_logs WHERE contract_id = p_contract_id;

    -- Ingest logs
    FOR v_log_record IN 
        SELECT (value->>'temperature_fahrenheit')::NUMERIC AS temp, 
               (value->>'recorded_at')::TIMESTAMPTZ AS rec_time
        FROM jsonb_array_elements(p_logs)
    LOOP
        INSERT INTO public.caterer_iot_temp_logs (contract_id, temperature_fahrenheit, recorded_at)
        VALUES (p_contract_id, v_log_record.temp, v_log_record.rec_time);
    END LOOP;

    -- Fetch contract & event context
    SELECT event_id, caterer_name INTO v_event_id, v_caterer_name
    FROM public.event_caterer_contracts WHERE id = p_contract_id;

    SELECT created_by, title INTO v_organizer_id, v_event_title
    FROM public.events WHERE id = v_event_id;

    -- Run FDA Danger Zone Check: Exceeded 40°F (4°C) for more than 2 consecutive hours
    FOR v_log_record IN 
        SELECT temperature_fahrenheit AS temp, recorded_at AS rec_time
        FROM public.caterer_iot_temp_logs
        WHERE contract_id = p_contract_id
        ORDER BY recorded_at ASC
    LOOP
        IF v_log_record.temp > 40.0 THEN
            IF v_danger_start IS NULL THEN
                v_danger_start := v_log_record.rec_time;
            ELSIF v_log_record.rec_time - v_danger_start > INTERVAL '2 hours' THEN
                v_is_condemned := TRUE;
                EXIT; -- Danger threshold violated
            END IF;
        ELSE
            -- Temp fell back to safe range, reset consecutive run timer
            v_danger_start := NULL;
        END IF;
    END LOOP;

    -- Update contract state and dispatch warnings
    IF v_is_condemned THEN
        UPDATE public.event_caterer_contracts 
        SET shipment_status = 'CONDEMNED',
            stripe_payment_blocked = TRUE
        WHERE id = p_contract_id;

        -- Alert the organizer
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
            v_organizer_id,
            'food_safety_alert',
            '⚠️ FOOD CONDEMNED: FDA Danger Zone Exceeded',
            'Catering delivery from ' || COALESCE(v_caterer_name, 'vendor') || ' exceeded 40 F for over 2 consecutive hours. Stripe payment blocked. Throw it in the trash.',
            '/events/' || v_event_id::TEXT || '/dashboard'
        );

        RETURN jsonb_build_object(
            'success', TRUE,
            'shipment_status', 'CONDEMNED',
            'stripe_payment_blocked', TRUE,
            'message', 'FDA Danger Zone breached: Ambient temp exceeded 40 F for more than 2 consecutive hours. Shipment condemned.'
        );
    ELSE
        UPDATE public.event_caterer_contracts 
        SET shipment_status = 'SAFE',
            stripe_payment_blocked = FALSE
        WHERE id = p_contract_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'shipment_status', 'SAFE',
            'stripe_payment_blocked', FALSE,
            'message', 'Temperature log meets FDA criteria. Food shipment is safe.'
        );
    END IF;
END;
$$;

COMMIT;
