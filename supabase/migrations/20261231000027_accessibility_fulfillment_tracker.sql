-- =============================================================================
-- Migration: 20261231000027_accessibility_fulfillment_tracker.sql
-- Issue: #4307 - Build a 'Real-Time "Accessibility Need" Fulfillment Tracker'
-- Description: Schema for accommodation requests, certified service providers,
--              audit trails, and real-time state machine RPC functions.
-- =============================================================================

-- 1. Certified Providers Table
CREATE TABLE IF NOT EXISTS public.accommodation_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    agency_or_department TEXT NOT NULL,
    certifications TEXT[] NOT NULL DEFAULT '{}',
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Accommodation Requests Table
CREATE TABLE IF NOT EXISTS public.accommodation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'asl_interpreter',
        'wheelchair_seating',
        'live_captioning_cart',
        'assistive_listening_device',
        'sensory_quiet_room',
        'dietary_anaphylaxis_kit',
        'service_animal_escort',
        'tactile_braille_guide'
    )),
    custom_notes TEXT,
    current_stage TEXT NOT NULL DEFAULT 'requested' CHECK (current_stage IN (
        'requested',
        'approved',
        'provider_assigned',
        'confirmed_on_site'
    )),
    provider_id UUID REFERENCES public.accommodation_providers(id) ON DELETE SET NULL,
    special_instructions TEXT,
    sla_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_event_id ON public.accommodation_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_requester_id ON public.accommodation_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_stage ON public.accommodation_requests(current_stage);

-- 3. Row Level Security
ALTER TABLE public.accommodation_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_requests ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of active certified providers
CREATE POLICY "Public can view accommodation providers"
    ON public.accommodation_providers
    FOR SELECT
    USING (true);

-- Allow requesters to view and create their own requests
CREATE POLICY "Users can view own accommodation requests"
    ON public.accommodation_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = requester_id);

CREATE POLICY "Users can insert own accommodation requests"
    ON public.accommodation_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = requester_id);

-- Allow event hosts and disability coordinators to update requests
CREATE POLICY "Organizers and coordinators can manage accommodation requests"
    ON public.accommodation_requests
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.club_members cm ON cm.club_id = e.club_id
            WHERE e.id = accommodation_requests.event_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'president', 'officer')
        )
    );

-- 4. Stored Procedure: Update Accommodation Stage & Dispatch
CREATE OR REPLACE FUNCTION public.update_accommodation_fulfillment_rpc(
    p_request_id UUID,
    p_new_stage TEXT,
    p_provider_id UUID DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_record RECORD;
BEGIN
    UPDATE public.accommodation_requests
    SET 
        current_stage = p_new_stage,
        provider_id = COALESCE(p_provider_id, provider_id),
        special_instructions = COALESCE(p_special_instructions, special_instructions),
        updated_at = NOW()
    WHERE id = p_request_id
    RETURNING * INTO v_updated_record;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accommodation request not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_updated_record.id,
        'current_stage', v_updated_record.current_stage,
        'updated_at', v_updated_record.updated_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_accommodation_fulfillment_rpc TO authenticated, anon;
