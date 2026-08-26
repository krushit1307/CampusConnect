-- Migration: 20260848000000_event_collaborative_notes.sql
-- Description: Live Collaborative Event Notes Document with real-time multiplayer cursors and post-event freeze (#3564)

CREATE TABLE IF NOT EXISTS public.event_collaborative_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  version INT DEFAULT 1,
  is_frozen BOOLEAN DEFAULT false,
  frozen_at TIMESTAMPTZ DEFAULT NULL,
  contributors TEXT[] DEFAULT '{}',
  last_edited_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_note_cursors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_color TEXT NOT NULL,
  cursor_position INT DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per event document
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_collab_notes_event ON public.event_collaborative_notes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_note_cursors_event ON public.event_note_cursors(event_id);

-- Enable RLS
ALTER TABLE public.event_collaborative_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_note_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event collaborative notes"
ON public.event_collaborative_notes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users edit event collaborative notes"
ON public.event_collaborative_notes FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public manage note cursors"
ON public.event_note_cursors FOR ALL
USING (true);

GRANT ALL ON public.event_collaborative_notes TO authenticated, anon;
GRANT ALL ON public.event_note_cursors TO authenticated, anon;
