-- Issue #4526: Real-Time Audio/Visual Check Presenter Ping
-- Records active presenter readiness pings, responses, and AWOL timeouts for auditability.

CREATE TABLE IF NOT EXISTS public.event_presenter_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  presenter_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ping_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pinged'
    CHECK (status IN ('pinged', 'confirmed_ready', 'awol')),
  timeout_seconds INTEGER NOT NULL DEFAULT 15,
  response_time_ms INTEGER,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presenter_pings_event
  ON public.event_presenter_pings (event_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_presenter_pings_presenter
  ON public.event_presenter_pings (presenter_user_id);

DROP TRIGGER IF EXISTS trg_presenter_pings_updated_at ON public.event_presenter_pings;
CREATE TRIGGER trg_presenter_pings_updated_at
  BEFORE UPDATE ON public.event_presenter_pings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_presenter_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presenter pings are visible to event admins and presenter" ON public.event_presenter_pings;
CREATE POLICY "Presenter pings are visible to event admins and presenter"
  ON public.event_presenter_pings FOR SELECT TO authenticated
  USING (
    public.is_event_admin(event_id, auth.uid()) OR presenter_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Organizers can create presenter pings" ON public.event_presenter_pings;
CREATE POLICY "Organizers can create presenter pings"
  ON public.event_presenter_pings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_event_admin(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "Presenters and admins can update pings" ON public.event_presenter_pings;
CREATE POLICY "Presenters and admins can update pings"
  ON public.event_presenter_pings FOR UPDATE TO authenticated
  USING (
    public.is_event_admin(event_id, auth.uid()) OR presenter_user_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.event_presenter_pings TO authenticated;
GRANT ALL ON public.event_presenter_pings TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_presenter_pings;
