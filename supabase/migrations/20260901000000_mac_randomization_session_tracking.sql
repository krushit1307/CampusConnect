-- Migration: 20260901000000_mac_randomization_session_tracking.sql
-- Description: MAC Randomization Session Tracking for ZTNA Network

CREATE TABLE IF NOT EXISTS public.mac_session_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rsvp_id UUID REFERENCES public.event_rsvps(id),
    current_mac_address TEXT NOT NULL,
    previous_mac_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
    jwt_token TEXT NOT NULL,
    jwt_expires_at TIMESTAMPTZ NOT NULL,
    captive_portal_dismissed_at TIMESTAMPTZ,
    ise_device_id TEXT,
    campus_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_rotation_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mac_session_id ON public.mac_session_mapping(session_id);
CREATE INDEX idx_mac_current_mac ON public.mac_session_mapping(current_mac_address);
CREATE INDEX idx_mac_campus_id ON public.mac_session_mapping(campus_id);
CREATE INDEX idx_mac_user_id ON public.mac_session_mapping(user_id);
CREATE INDEX idx_mac_expires_at ON public.mac_session_mapping(jwt_expires_at);

CREATE TABLE IF NOT EXISTS public.ztna_network_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL UNIQUE,
    ise_server_url TEXT NOT NULL,
    ise_api_key TEXT NOT NULL,
    ise_api_secret TEXT NOT NULL,
    captive_portal_url TEXT NOT NULL,
    oauth_redirect_uri TEXT NOT NULL,
    jwt_signing_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ztna_campus_id ON public.ztna_network_config(campus_id);
CREATE INDEX idx_ztna_active ON public.ztna_network_config(is_active);

ALTER TABLE public.mac_session_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ztna_network_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mac_session_mapping
DROP POLICY IF EXISTS "Users can view own MAC sessions" ON public.mac_session_mapping;
CREATE POLICY "Users can view own MAC sessions"
ON public.mac_session_mapping FOR SELECT TO authenticated
USING (user_id = auth.uid() OR rsvp_id IN (
    SELECT id FROM public.event_rsvps WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "System can insert MAC sessions" ON public.mac_session_mapping;
CREATE POLICY "System can insert MAC sessions"
ON public.mac_session_mapping FOR INSERT TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "System can update MAC sessions" ON public.mac_session_mapping;
CREATE POLICY "System can update MAC sessions"
ON public.mac_session_mapping FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

-- RLS Policies for ztna_network_config (admin only)
DROP POLICY IF EXISTS "Admins can view network config" ON public.ztna_network_config;
CREATE POLICY "Admins can view network config"
ON public.ztna_network_config FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.club_memberships WHERE user_id = auth.uid() AND role = 'admin'
));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mac_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mac_session_update_timestamp ON public.mac_session_mapping;
CREATE TRIGGER mac_session_update_timestamp
BEFORE UPDATE ON public.mac_session_mapping
FOR EACH ROW
EXECUTE FUNCTION update_mac_session_timestamp();