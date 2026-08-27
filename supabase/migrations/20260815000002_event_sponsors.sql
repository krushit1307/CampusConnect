-- =============================================================================
-- Migration: Event Sponsorship Tiers
-- Issue: #2808 - Implement 'Sponsorship' Tiers and Dynamic Banners for Events
-- Description: Creates the sponsors table to manage corporate sponsors for 
-- events. Includes tier levels (Platinum, Gold, Silver, Bronze) and RLS 
-- policies to allow club admins to manage their event sponsors.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for sponsor tiers
CREATE TYPE sponsor_tier AS ENUM ('platinum', 'gold', 'silver', 'bronze');

-- Sponsors table
CREATE TABLE IF NOT EXISTS public.sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    website_url TEXT,
    tier_level sponsor_tier NOT NULL DEFAULT 'bronze',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups and ordering
CREATE INDEX IF NOT EXISTS idx_sponsors_event_id 
ON public.sponsors(event_id, tier_level, display_order);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

-- Anyone can view sponsors for published events
CREATE POLICY "Anyone can view sponsors for public events"
ON public.sponsors FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = sponsors.event_id
        AND (e.status = 'PUBLISHED' OR e.club_id IN (
            SELECT club_id FROM public.club_members 
            WHERE user_id = auth.uid() AND status = 'approved'
        ))
    )
);

-- Only club admins can insert/update/delete sponsors for their events
CREATE POLICY "Club admins can manage event sponsors"
ON public.sponsors FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = sponsors.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = sponsors.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
);
