-- ============================================================
-- Migration: 20260727100000_presence_heartbeat.sql
-- Description:
-- Creates the presence_heartbeats table to track client pings,
-- and configures row-level security (RLS) policies.
-- ============================================================

-- 1. Create public.presence_heartbeats table
CREATE TABLE IF NOT EXISTS public.presence_heartbeats (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_pinged_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security (RLS) on public.presence_heartbeats
ALTER TABLE public.presence_heartbeats ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS policies on public.presence_heartbeats
DROP POLICY IF EXISTS "Users can insert/update their own heartbeat" ON public.presence_heartbeats;
CREATE POLICY "Users can insert/update their own heartbeat" ON public.presence_heartbeats
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select heartbeats" ON public.presence_heartbeats;
CREATE POLICY "Users can select heartbeats" ON public.presence_heartbeats
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role has full access to presence_heartbeats" ON public.presence_heartbeats;
CREATE POLICY "Service role has full access to presence_heartbeats" ON public.presence_heartbeats
    FOR ALL TO service_role USING (true) WITH CHECK (true);
