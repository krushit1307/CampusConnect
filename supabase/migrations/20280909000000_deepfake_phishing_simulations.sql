-- Migration: Automated Club Leadership Mandatory Phishing Simulation (Deepfake Video Phishing)
-- Resolves #5146

CREATE TABLE IF NOT EXISTS public.authority_avatar_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_title TEXT NOT NULL, -- e.g. 'Dean of Students', 'University President'
    full_name TEXT NOT NULL,
    voice_model_id TEXT NOT NULL,
    avatar_video_url TEXT NOT NULL,
    opted_in BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.phishing_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_club_id UUID NOT NULL,
    target_president_name TEXT NOT NULL,
    target_phone_number TEXT NOT NULL,
    authority_avatar_id UUID REFERENCES public.authority_avatar_profiles(id),
    urgency_reason TEXT NOT NULL,
    requested_amount NUMERIC(18, 2) NOT NULL,
    synthetic_script TEXT NOT NULL,
    generated_video_url TEXT,
    sms_message_sid TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SMS_DISPATCHED', 'FAILED_SIMULATION', 'PASSED_SIMULATION', 'DEBRIEFED'
    clicked_link BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_transfer BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.phishing_debriefing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id UUID REFERENCES public.phishing_simulations(id) ON DELETE CASCADE,
    president_user_id UUID NOT NULL,
    debrief_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deepfake_awareness_acknowledged BOOLEAN NOT NULL DEFAULT TRUE
);

-- RPC: Record Phishing Simulation Trigger Interaction
CREATE OR REPLACE FUNCTION public.record_phishing_simulation_action(
    p_simulation_id UUID,
    p_action TEXT
) RETURNS JSONB AS $$
DECLARE
    v_sim public.phishing_simulations%ROWTYPE;
    v_risk_score INT := 0;
    v_status TEXT;
BEGIN
    SELECT * INTO v_sim FROM public.phishing_simulations WHERE id = p_simulation_id FOR UPDATE;

    IF v_sim.id IS NULL THEN
        RAISE EXCEPTION 'Phishing simulation campaign not found';
    END IF;

    IF p_action = 'REPORTED_PHISHING' THEN
        v_status := 'PASSED_SIMULATION';
        v_risk_score := 10;
        
        UPDATE public.phishing_simulations
        SET status = v_status,
            risk_score = v_risk_score,
            updated_at = NOW()
        WHERE id = p_simulation_id;
    ELSE
        v_status := 'FAILED_SIMULATION';
        v_risk_score := 95;
        
        UPDATE public.phishing_simulations
        SET status = v_status,
            clicked_link = TRUE,
            attempted_transfer = (p_action = 'INITIATED_TRANSFER'),
            risk_score = v_risk_score,
            updated_at = NOW()
        WHERE id = p_simulation_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'simulation_id', p_simulation_id,
        'status', v_status,
        'risk_score', v_risk_score
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
