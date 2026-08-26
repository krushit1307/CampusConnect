-- Migration: 20261123000000_interactive_campus_tours.sql
-- Description: Implement public showcase flags and guest RLS access rules for campus tours (#3456).

-- 1. Add is_public_showcase column to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_public_showcase BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Drop existing SELECT policies on events
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON public.events;

-- 3. Create SELECT policy for authenticated users
CREATE POLICY "Events are viewable by authenticated users" ON public.events
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_system_admin()) AND (
      is_private IS FALSE OR is_private IS NULL OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id = events.club_id
          AND club_members.user_id = auth.uid()
          AND club_members.status = 'approved'
      ) OR
      EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
      EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
    )
  );

-- 4. Create SELECT policy for anonymous guests (only public showcase events)
CREATE POLICY "Events are viewable by anonymous guests" ON public.events
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL AND
    is_public_showcase = true
  );
