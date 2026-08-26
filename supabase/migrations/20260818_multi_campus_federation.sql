-- Migration: Multi-Campus Federation Protocol
-- Issue #3325

-- 1. Create table for trusted federated servers
CREATE TABLE IF NOT EXISTS public.federated_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE,
    institution_name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    public_key TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Add federation flag to events table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'events' 
        AND column_name = 'is_federated_public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN is_federated_public BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 3. Create table for ingested remote events from other campus instances
CREATE TABLE IF NOT EXISTS public.remote_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_server_domain TEXT NOT NULL,
    origin_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    banner_url TEXT,
    host_institution TEXT NOT NULL,
    federated_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_origin_event UNIQUE (origin_server_domain, origin_event_id)
);

-- Enable RLS
ALTER TABLE public.federated_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_events ENABLE ROW LEVEL SECURITY;

-- Policies for federated_servers
CREATE POLICY "Admins can view and manage federated servers"
    ON public.federated_servers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policies for remote_events (Read access for all authenticated users, insert/update via service role / edge function)
CREATE POLICY "Anyone can view remote events"
    ON public.remote_events
    FOR SELECT
    TO public
    USING (true);

-- Indexing for fast federation queries
CREATE INDEX IF NOT EXISTS idx_remote_events_origin ON public.remote_events (origin_server_domain, origin_event_id);
CREATE INDEX IF NOT EXISTS idx_remote_events_start_time ON public.remote_events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_federated_public ON public.events (is_federated_public) WHERE is_federated_public = true;
