-- Migration for Automated "Event Cancellation" Force Majeure Clause Validator (#4895)

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 6) DEFAULT 37.7749,
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 6) DEFAULT -122.4194;

CREATE TABLE IF NOT EXISTS public.event_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.vendor_contracts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    penalty_applied_cents INT NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENALIZED'
);

CREATE TABLE IF NOT EXISTS public.force_majeure_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cancellation_id UUID NOT NULL REFERENCES public.event_cancellations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    appeal_text TEXT NOT NULL,
    evidence_image_urls TEXT[],
    noaa_weather_data JSONB,
    llm_verdict BOOLEAN,
    llm_rationale TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.event_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.force_majeure_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can view own cancellations"
    ON public.event_cancellations FOR SELECT
    USING (organizer_id = auth.uid());

CREATE POLICY "Organizers can view own appeals"
    ON public.force_majeure_appeals FOR SELECT
    USING (organizer_id = auth.uid());

CREATE POLICY "Organizers can insert own appeals"
    ON public.force_majeure_appeals FOR INSERT
    WITH CHECK (organizer_id = auth.uid());

-- Allow edge functions (service_role) to update appeals
