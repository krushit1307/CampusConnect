-- Migration: 20270902000000_guest_network_provisioning.sql
-- Description: Implement 'Dynamic "Multi-Campus" Guest Network Provisioning' (#4819)

-- 1. Create guest_network_credentials table
CREATE TABLE IF NOT EXISTS public.guest_network_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    essid TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.guest_network_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view guest credentials" ON public.guest_network_credentials;
CREATE POLICY "Users can view guest credentials"
ON public.guest_network_credentials FOR SELECT TO authenticated, anon
USING (
    rsvp_id IN (
        SELECT id FROM public.event_rsvps WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert guest credentials" ON public.guest_network_credentials;
CREATE POLICY "Users can insert guest credentials"
ON public.guest_network_credentials FOR INSERT TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update guest credentials" ON public.guest_network_credentials;
CREATE POLICY "Users can update guest credentials"
ON public.guest_network_credentials FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);
