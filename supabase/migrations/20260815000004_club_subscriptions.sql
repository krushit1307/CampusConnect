-- =============================================================================
-- Migration: Club Push Subscriptions
-- Issue: #2817 - Implement Push Subscriptions for Specific Clubs
-- Description: Creates a junction table to track user opt-ins for specific 
-- club notifications. Distinct from the `club_members` table to allow users 
-- to subscribe to events without formally joining the club roster.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Club Subscriptions Junction Table
CREATE TABLE IF NOT EXISTS public.club_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    notify_events BOOLEAN NOT NULL DEFAULT TRUE,
    notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure a user can only subscribe to a club once
    UNIQUE(user_id, club_id)
);

-- Indexes for fast lookups when dispatching notifications
CREATE INDEX IF NOT EXISTS idx_club_subscriptions_club_id 
ON public.club_subscriptions(club_id) 
WHERE notify_events = TRUE;

CREATE INDEX IF NOT EXISTS idx_club_subscriptions_user_id 
ON public.club_subscriptions(user_id);

-- 2. Push Subscriptions Table (Web Push endpoints)
-- Stores the VAPID subscription payloads for each user's devices
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON public.push_subscriptions(user_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view, insert, and delete their own club subscriptions
CREATE POLICY "Users can manage own club subscriptions"
ON public.club_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view their own subscriptions for the settings page
CREATE POLICY "Users can view own club subscriptions"
ON public.club_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own push device subscriptions
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Edge Functions (Service Role) need to read subscriptions to dispatch notifications
-- Service role bypasses RLS automatically, so no explicit policy needed for dispatch.
