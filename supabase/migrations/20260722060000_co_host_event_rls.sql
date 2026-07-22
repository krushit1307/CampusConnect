-- ============================================================
-- Migration: 20260722060000_co_host_event_rls.sql
-- Issue: #591
-- Description:
--   Updates the UPDATE RLS policy on public.events so that
--   admins of any co-hosting club (listed in event_co_hosts)
--   can also edit event details (description, location, etc.).
--
--   Previously only primary club admins / creators could UPDATE.
--   This policy now also allows:
--     - Approved admins of any club in event_co_hosts for that event.
-- ============================================================

-- Drop and recreate the UPDATE policy on events
DROP POLICY IF EXISTS "Club admins can update events." ON public.events;

CREATE POLICY "Club admins can update events."
ON public.events
FOR UPDATE
USING (
  -- 1. Primary club admin
  public.is_club_admin(club_id, auth.uid())
  OR
  -- 2. Primary club creator/owner
  EXISTS (
    SELECT 1
    FROM public.clubs
    WHERE id = events.club_id
      AND created_by = auth.uid()
  )
  OR
  -- 3. Admin of any co-hosting club
  EXISTS (
    SELECT 1
    FROM public.event_co_hosts ech
    WHERE ech.event_id = events.id
      AND public.is_club_admin(ech.club_id, auth.uid())
  )
);
