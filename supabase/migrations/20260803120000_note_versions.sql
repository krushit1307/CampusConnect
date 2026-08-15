-- Migration: Create club_meeting_note_versions table for Rich-Text Version History & Diff Viewer
-- Issue #1501: Rich-text Version History and Diff Viewer for Collaborative Notes

CREATE TABLE IF NOT EXISTS public.club_meeting_note_versions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id         UUID NOT NULL REFERENCES public.club_meeting_notes(id) ON DELETE CASCADE,
  version_number  INT NOT NULL DEFAULT 1,
  title           TEXT,
  content_text    TEXT,                    -- Plain-text snapshot for diffing & preview
  yjs_state       TEXT,                    -- Base64-encoded Yjs document state blob
  summary         TEXT,                    -- Optional commit/snapshot comment
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS club_meeting_note_versions_note_id_idx ON public.club_meeting_note_versions(note_id);
CREATE INDEX IF NOT EXISTS club_meeting_note_versions_created_at_idx ON public.club_meeting_note_versions(created_at DESC);

-- Enable RLS
ALTER TABLE public.club_meeting_note_versions ENABLE ROW LEVEL SECURITY;

-- Club members can read note versions for notes in their club
CREATE POLICY "club_members_read_note_versions" ON public.club_meeting_note_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_meeting_notes n
      JOIN public.club_members cm ON cm.club_id = n.club_id
      WHERE n.id = club_meeting_note_versions.note_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );

-- Club members/admins can insert note versions
CREATE POLICY "club_members_insert_note_versions" ON public.club_meeting_note_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_meeting_notes n
      JOIN public.club_members cm ON cm.club_id = n.club_id
      WHERE n.id = club_meeting_note_versions.note_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );

-- Only club admins can delete note versions
CREATE POLICY "club_admins_delete_note_versions" ON public.club_meeting_note_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_meeting_notes n
      WHERE n.id = club_meeting_note_versions.note_id
        AND public.is_club_admin(n.club_id, auth.uid())
    )
  );
