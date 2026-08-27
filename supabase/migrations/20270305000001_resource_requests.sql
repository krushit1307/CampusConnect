
CREATE TYPE resource_request_status AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'failed');

CREATE TABLE IF NOT EXISTS public.event_resource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    resources JSONB NOT NULL DEFAULT '[]'::jsonb,
    status resource_request_status NOT NULL DEFAULT 'pending',
    external_ticket_id TEXT,
    provider TEXT NOT NULL DEFAULT 'zendesk',
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.event_resource_requests ENABLE ROW LEVEL SECURITY;

-- Policies for event_resource_requests
CREATE POLICY "Event creators can view their resource requests" ON public.event_resource_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_resource_requests.event_id
            AND events.created_by = auth.uid()
        )
    );

CREATE POLICY "Event creators can insert resource requests" ON public.event_resource_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_resource_requests.event_id
            AND events.created_by = auth.uid()
        )
    );

CREATE POLICY "Event creators can update their resource requests" ON public.event_resource_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_resource_requests.event_id
            AND events.created_by = auth.uid()
        )
    );
