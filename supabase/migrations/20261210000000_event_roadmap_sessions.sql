-- Issue #3606: Interactive Event Roadmap for Multi-Day Festivals
-- Sessions are child schedule blocks for a parent event. Itinerary rows are
-- user-owned selections used by the attendee roadmap and calendar export.

CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  description TEXT,
  track TEXT NOT NULL DEFAULT 'Main track' CHECK (char_length(btrim(track)) BETWEEN 2 AND 80),
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_sessions_valid_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.event_itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_event_time
  ON public.event_sessions (event_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event_track
  ON public.event_sessions (event_id, track, starts_at);
CREATE INDEX IF NOT EXISTS idx_event_itinerary_items_user
  ON public.event_itinerary_items (user_id, created_at DESC);

ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_itinerary_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event sessions are viewable by event visitors" ON public.event_sessions;
CREATE POLICY "Event sessions are viewable by event visitors"
  ON public.event_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_sessions.event_id));

DROP POLICY IF EXISTS "Event organizers can manage sessions" ON public.event_sessions;
CREATE POLICY "Event organizers can manage sessions"
  ON public.event_sessions FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_sessions.event_id
        AND e.created_by = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_sessions.event_id
        AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their itineraries" ON public.event_itinerary_items;
CREATE POLICY "Users can view their itineraries"
  ON public.event_itinerary_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can save their itineraries" ON public.event_itinerary_items;
CREATE POLICY "Users can save their itineraries"
  ON public.event_itinerary_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their itineraries" ON public.event_itinerary_items;
CREATE POLICY "Users can remove their itineraries"
  ON public.event_itinerary_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at_event_sessions ON public.event_sessions;
CREATE TRIGGER set_updated_at_event_sessions
  BEFORE UPDATE ON public.event_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.event_sessions IS
  'Multi-track schedule sessions belonging to a parent event. Issue #3606.';
COMMENT ON TABLE public.event_itinerary_items IS
  'User-selected sessions for personalized event roadmaps and calendar export. Issue #3606.';
