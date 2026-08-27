-- Migration: 20260912000000_caterer_dietary_alerts.sql
-- Description: Issue #3676 - Implement 'Automated "Dietary Restriction" Caterer Alert'

-- 1. Create event_caterer_contracts table
CREATE TABLE IF NOT EXISTS public.event_caterer_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    caterer_name TEXT NOT NULL,
    caterer_email TEXT NOT NULL,
    caterer_phone TEXT,
    rfp_finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id)
);

-- 2. Create caterer_dietary_alerts table
CREATE TABLE IF NOT EXISTS public.caterer_dietary_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    attendee_name TEXT NOT NULL,
    dietary_tag TEXT NOT NULL,
    severity_level TEXT NOT NULL DEFAULT 'SEVERE',
    caterer_email TEXT NOT NULL,
    caterer_phone TEXT,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledgment_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACKNOWLEDGED'
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying alerts by event and status
CREATE INDEX IF NOT EXISTS idx_caterer_alerts_event ON public.caterer_dietary_alerts (event_id, acknowledgment_status);
CREATE INDEX IF NOT EXISTS idx_caterer_alerts_token ON public.caterer_dietary_alerts (token);

-- Enable RLS
ALTER TABLE public.event_caterer_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caterer_dietary_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Caterer contracts viewable by authenticated users" ON public.event_caterer_contracts;
CREATE POLICY "Caterer contracts viewable by authenticated users"
    ON public.event_caterer_contracts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Caterer contracts manageble by authenticated users" ON public.event_caterer_contracts;
CREATE POLICY "Caterer contracts manageble by authenticated users"
    ON public.event_caterer_contracts FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Caterer alerts viewable by authenticated users" ON public.caterer_dietary_alerts;
CREATE POLICY "Caterer alerts viewable by authenticated users"
    ON public.caterer_dietary_alerts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Caterer alerts manageable by authenticated users" ON public.caterer_dietary_alerts;
CREATE POLICY "Caterer alerts manageable by authenticated users"
    ON public.caterer_dietary_alerts FOR ALL TO authenticated USING (true);

-- Enable Realtime publication for caterer_dietary_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.caterer_dietary_alerts;
