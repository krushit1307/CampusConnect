-- ============================================================
-- Migration: 20260721110000_event_co_hosts_table.sql
-- Issue: #590
-- Description:
--   Creates `public.event_co_hosts` table to support multi-club co-hosting of events.
--   Enables Row Level Security (RLS) with policies:
--     - SELECT: Anyone can read co-hosts (public visibility).
--     - INSERT: Only administrators or creator of the PRIMARY hosting club (events.club_id) can add co-hosts.
--     - DELETE: Only administrators or creator of the PRIMARY hosting club (events.club_id) can remove co-hosts.
-- ============================================================

-- 1. Create table event_co_hosts
CREATE TABLE IF NOT EXISTS public.event_co_hosts (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, club_id)
);

-- 2. Create index on club_id for reverse lookup queries
CREATE INDEX IF NOT EXISTS idx_event_co_hosts_club_id ON public.event_co_hosts(club_id);

-- 3. Enable Row Level Security
ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- SELECT: Anyone can read co-hosts
DROP POLICY IF EXISTS "Co-hosts are viewable by everyone." ON public.event_co_hosts;
CREATE POLICY "Co-hosts are viewable by everyone."
ON public.event_co_hosts FOR SELECT
USING (true);

-- INSERT: Only primary hosting club admins or creator can add co-hosts
DROP POLICY IF EXISTS "Primary club admins can add co-hosts." ON public.event_co_hosts;
CREATE POLICY "Primary club admins can add co-hosts."
ON public.event_co_hosts FOR INSERT
WITH CHECK (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id)
          AND created_by = auth.uid()
    )
);

-- DELETE: Only primary hosting club admins or creator can delete co-hosts
DROP POLICY IF EXISTS "Primary club admins can delete co-hosts." ON public.event_co_hosts;
CREATE POLICY "Primary club admins can delete co-hosts."
ON public.event_co_hosts FOR DELETE
USING (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id)
          AND created_by = auth.uid()
    )
);
