-- =============================================================================
-- Migration: Automated Multi-Channel Cross-Posting
-- Issue: #3542 - Implement 'Automated Multi-Channel Cross-Posting'
-- Description: Creates the club_integrations table to securely store external
-- webhook URLs for platforms like Discord and Slack. Includes RLS policies
-- to ensure only club admins can manage their own integrations.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Club Integrations Table
CREATE TYPE integration_platform AS ENUM ('discord', 'slack', 'microsoft_teams');

CREATE TABLE IF NOT EXISTS public.club_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    platform integration_platform NOT NULL,
    webhook_url TEXT NOT NULL,
    channel_name TEXT, -- Optional: e.g., "#events-announcements"
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_tested_at TIMESTAMPTZ,
    last_test_status TEXT, -- 'success', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(club_id, platform, channel_name)
);

CREATE INDEX IF NOT EXISTS idx_club_integrations_club ON public.club_integrations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_integrations_active ON public.club_integrations(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.club_integrations ENABLE ROW LEVEL SECURITY;

-- Club Admins can manage their own integrations
CREATE POLICY "Club admins can manage own integrations"
ON public.club_integrations FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = club_integrations.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'president')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = club_integrations.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'president')
    )
);

-- System (Edge Functions) can read active integrations
CREATE POLICY "System can read active integrations"
ON public.club_integrations FOR SELECT
USING (auth.role() = 'service_role');
