-- Migration: Create club_meeting_notes table for collaborative notes
-- Issue #1433: Real-time Collaborative Notes for Club Meetings

CREATE TABLE IF NOT EXISTS public.club_meeting_notes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled Meeting Notes',
  content_text  TEXT,                    -- Cached plain-text for search/preview
  yjs_state     TEXT,                    -- Base64-encoded Yjs document state
  created_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS club_meeting_notes_club_id_idx ON public.club_meeting_notes(club_id);
CREATE INDEX IF NOT EXISTS club_meeting_notes_created_at_idx ON public.club_meeting_notes(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_club_meeting_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_meeting_notes_updated_at ON public.club_meeting_notes;
CREATE TRIGGER trg_club_meeting_notes_updated_at
  BEFORE UPDATE ON public.club_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION update_club_meeting_notes_updated_at();

-- Row-Level Security
ALTER TABLE public.club_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Club admins/members can read notes for their club
CREATE POLICY "club_members_read_notes" ON public.club_meeting_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_meeting_notes.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );

-- Only club admins/owners can create notes
CREATE POLICY "club_admins_create_notes" ON public.club_meeting_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_meeting_notes.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
        AND cm.status = 'approved'
    )
  );

-- Only club admins/owners can update notes
CREATE POLICY "club_admins_update_notes" ON public.club_meeting_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_meeting_notes.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
        AND cm.status = 'approved'
    )
  );

-- Only club admins/owners can delete notes
CREATE POLICY "club_admins_delete_notes" ON public.club_meeting_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_meeting_notes.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
        AND cm.status = 'approved'
    )
  );

-- Enable Supabase Realtime for presence tracking on the notes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_meeting_notes;
