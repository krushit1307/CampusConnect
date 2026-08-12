-- Migration: 20260726000000_enforce_private_events_rls.sql
-- Description: Add is_private column to events and enforce member-only RLS policy (#1187)

-- 1. Add is_private column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Update SELECT RLS Policy on events table
DROP POLICY IF EXISTS "Events are viewable by everyone." ON events;
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON events;

CREATE POLICY "Events are viewable by public or club members." ON events
  FOR SELECT USING (
    is_private IS FALSE OR is_private IS NULL OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'approved'
    ) OR
    EXISTS (
      SELECT 1 FROM clubs
      WHERE id = events.club_id
        AND created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM event_cohosts
      WHERE event_id = events.id
        AND user_id = auth.uid()
    )
  );
