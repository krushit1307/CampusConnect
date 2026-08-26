-- Issue #4424: Dynamic "Mental Health" Resource A/B Testing

CREATE TABLE public.ab_test_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    target_impressions INT DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    concluded_at TIMESTAMPTZ,
    winner_variant_id UUID
);

CREATE TABLE public.ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.ab_test_experiments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    payload JSONB NOT NULL,
    impressions INT DEFAULT 0,
    conversions INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- We link the winner_variant_id back to ab_test_variants
ALTER TABLE public.ab_test_experiments
ADD CONSTRAINT fk_ab_test_winner 
FOREIGN KEY (winner_variant_id) REFERENCES public.ab_test_variants(id) ON DELETE SET NULL;

CREATE TABLE public.ab_test_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.ab_test_experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'conversion')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ab_test_events_experiment ON public.ab_test_events(experiment_id);
CREATE INDEX idx_ab_test_events_variant ON public.ab_test_events(variant_id);
CREATE UNIQUE INDEX idx_ab_test_events_unique_impression ON public.ab_test_events(variant_id, session_id, event_type);

-- RPC for recording an A/B test event
CREATE OR REPLACE FUNCTION public.record_ab_test_event(
    p_experiment_id UUID,
    p_variant_id UUID,
    p_session_id TEXT,
    p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ab_test_events (experiment_id, variant_id, user_id, session_id, event_type)
    VALUES (p_experiment_id, p_variant_id, auth.uid(), p_session_id, p_event_type)
    ON CONFLICT (variant_id, session_id, event_type) DO NOTHING;

    -- Update aggregate counts
    IF FOUND THEN
        IF p_event_type = 'impression' THEN
            UPDATE public.ab_test_variants SET impressions = impressions + 1 WHERE id = p_variant_id;
        ELSIF p_event_type = 'conversion' THEN
            UPDATE public.ab_test_variants SET conversions = conversions + 1 WHERE id = p_variant_id;
        END IF;
    END IF;
END;
$$;

-- Initialize the Crisis Banner test
DO $$
DECLARE
    v_exp_id UUID;
BEGIN
    INSERT INTO public.ab_test_experiments (name, description, target_impressions)
    VALUES ('Crisis Banner Copy Test', 'A/B testing crisis banner copy for sensitive events', 500)
    RETURNING id INTO v_exp_id;

    INSERT INTO public.ab_test_variants (experiment_id, name, payload)
    VALUES 
        (v_exp_id, 'Variant A (Call 911)', '{"title": "Emergency?", "copy": "Call 911 immediately if you are in physical danger.", "cta": "Call 911", "url": "tel:911", "color": "red"}'),
        (v_exp_id, 'Variant B (Text Counselor)', '{"title": "Need Support?", "copy": "Text a licensed campus counselor anytime, 24/7.", "cta": "Text a Counselor", "url": "sms:741741", "color": "blue"}');
END;
$$;
