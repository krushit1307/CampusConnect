-- ============================================================
-- Migration: 20260722060000_co_host_event_rls.sql
-- Issue: #591
-- Description:
--   Creates the event_co_hosts table (if not exists from prior migrations)
--   and updates the UPDATE RLS policy on public.events so that
--   admins of any co-hosting club can also edit event details.
--
--   Previously only primary club admins / creators could UPDATE.
--   This policy now also allows:
--     - Approved admins of any club in event_co_hosts for that event.
-- ============================================================

-- 1. Create event_co_hosts table (idempotent)
CREATE TABLE IF NOT EXISTS public.event_co_hosts (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id  UUID NOT NULL REFERENCES public.clubs(id)  ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_event_co_hosts_club_id
    ON public.event_co_hosts(club_id);

ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read co-host entries
DROP POLICY IF EXISTS "Co-hosts are viewable by everyone." ON public.event_co_hosts;
CREATE POLICY "Co-hosts are viewable by everyone."
ON public.event_co_hosts FOR SELECT
USING (true);

-- INSERT: only primary club admins/creator can add co-hosts
DROP POLICY IF EXISTS "Primary club admins can add co-hosts." ON public.event_co_hosts;
CREATE POLICY "Primary club admins can add co-hosts."
ON public.event_co_hosts FOR INSERT
WITH CHECK (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id)
          AND created_by = auth.uid()
    )
);

-- DELETE: only primary club admins/creator can remove co-hosts
DROP POLICY IF EXISTS "Primary club admins can delete co-hosts." ON public.event_co_hosts;
CREATE POLICY "Primary club admins can delete co-hosts."
ON public.event_co_hosts FOR DELETE
USING (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id)
          AND created_by = auth.uid()
    )
);

-- 2. Update the events UPDATE policy to include co-host admins
DROP POLICY IF EXISTS "Club admins can update events." ON public.events;

CREATE POLICY "Club admins can update events."
ON public.events
FOR UPDATE
USING (
  -- Primary club admin
  public.is_club_admin(club_id, auth.uid())
  OR
  -- Primary club creator/owner
  EXISTS (
    SELECT 1
    FROM public.clubs
    WHERE id = events.club_id
      AND created_by = auth.uid()
  )
  OR
  -- Admin of any co-hosting club (#591)
  EXISTS (
    SELECT 1
    FROM public.event_co_hosts ech
    WHERE ech.event_id = events.id
      AND public.is_club_admin(ech.club_id, auth.uid())
  )
);
