-- Issue #4298: Real-Time Audio/Visual Check Fallback Broadcaster.
-- The media server reports health transitions to an Edge Function. These tables
-- keep the viewer-visible source state durable and make every transition auditable.

CREATE TABLE IF NOT EXISTS public.event_broadcast_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  presenter_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  primary_stream_url TEXT,
  fallback_slate_url TEXT NOT NULL DEFAULT '/technical-difficulties.mp4',
  active_source TEXT NOT NULL DEFAULT 'primary'
    CHECK (active_source IN ('primary', 'fallback')),
  state TEXT NOT NULL DEFAULT 'primary'
    CHECK (state IN ('primary', 'fallback', 'recovering', 'ended')),
  connection_state TEXT NOT NULL DEFAULT 'connected'
    CHECK (connection_state IN ('connected', 'disconnected', 'failed', 'checking')),
  failure_reason TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  fallback_activated_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.event_broadcast_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.event_broadcast_sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  connection_state TEXT NOT NULL CHECK (connection_state IN ('connected', 'disconnected', 'failed', 'checking')),
  requested_source TEXT NOT NULL CHECK (requested_source IN ('primary', 'fallback')),
  av_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
  provider_switch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (provider_switch_status IN ('pending', 'succeeded', 'failed', 'not_configured')),
  provider_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_sessions_event
  ON public.event_broadcast_sessions (event_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_health_events_session_time
  ON public.event_broadcast_health_events (session_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_broadcast_sessions_updated_at ON public.event_broadcast_sessions;
CREATE TRIGGER trg_broadcast_sessions_updated_at
  BEFORE UPDATE ON public.event_broadcast_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_broadcast_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_broadcast_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Broadcast state is visible to event attendees" ON public.event_broadcast_sessions;
CREATE POLICY "Broadcast state is visible to event attendees"
  ON public.event_broadcast_sessions FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Organizers can start broadcast sessions" ON public.event_broadcast_sessions;
CREATE POLICY "Organizers can start broadcast sessions"
  ON public.event_broadcast_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_event_admin(event_id, auth.uid()));

DROP POLICY IF EXISTS "Broadcast health is visible to event attendees" ON public.event_broadcast_health_events;
CREATE POLICY "Broadcast health is visible to event attendees"
  ON public.event_broadcast_health_events FOR SELECT TO authenticated
  USING (TRUE);

REVOKE INSERT, UPDATE, DELETE ON public.event_broadcast_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_broadcast_health_events FROM anon, authenticated;
GRANT SELECT ON public.event_broadcast_sessions, public.event_broadcast_health_events TO authenticated;
GRANT ALL ON public.event_broadcast_sessions, public.event_broadcast_health_events TO service_role;

CREATE OR REPLACE FUNCTION public.start_event_broadcast_session(
  p_event_id UUID,
  p_presenter_user_id UUID,
  p_primary_stream_url TEXT DEFAULT NULL,
  p_fallback_slate_url TEXT DEFAULT '/technical-difficulties.mp4'
)
RETURNS public.event_broadcast_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.event_broadcast_sessions;
BEGIN
  IF NOT public.is_event_admin(p_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only an event organizer can start a broadcast session.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.event_broadcast_sessions (
    event_id, presenter_user_id, primary_stream_url, fallback_slate_url, state, active_source, connection_state
  ) VALUES (
    p_event_id, p_presenter_user_id, NULLIF(BTRIM(p_primary_stream_url), ''),
    COALESCE(NULLIF(BTRIM(p_fallback_slate_url), ''), '/technical-difficulties.mp4'),
    'primary', 'primary', 'checking'
  )
  ON CONFLICT (event_id) DO UPDATE SET
    presenter_user_id = EXCLUDED.presenter_user_id,
    primary_stream_url = EXCLUDED.primary_stream_url,
    fallback_slate_url = EXCLUDED.fallback_slate_url,
    state = CASE WHEN event_broadcast_sessions.state = 'ended' THEN 'primary' ELSE event_broadcast_sessions.state END,
    updated_at = NOW()
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_presenter_av_check(
  p_session_id UUID,
  p_connection_state TEXT,
  p_av_check_passed BOOLEAN
)
RETURNS public.event_broadcast_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.event_broadcast_sessions;
  v_next_state TEXT;
BEGIN
  SELECT * INTO v_session FROM public.event_broadcast_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Broadcast session not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_event_admin(v_session.event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only an event organizer can report an A/V check.' USING ERRCODE = '42501';
  END IF;
  IF p_connection_state NOT IN ('connected', 'disconnected', 'failed', 'checking') THEN
    RAISE EXCEPTION 'Invalid broadcast connection state.' USING ERRCODE = '22023';
  END IF;
  v_next_state := CASE
    WHEN p_av_check_passed AND p_connection_state = 'connected' THEN 'primary'
    WHEN p_connection_state IN ('disconnected', 'failed') THEN 'fallback'
    ELSE v_session.state
  END;
  UPDATE public.event_broadcast_sessions
  SET connection_state = p_connection_state,
      state = v_next_state,
      active_source = CASE WHEN v_next_state = 'fallback' THEN 'fallback' ELSE 'primary' END,
      last_heartbeat_at = NOW(),
      fallback_activated_at = CASE WHEN v_next_state = 'fallback' AND state <> 'fallback' THEN NOW() ELSE fallback_activated_at END,
      recovered_at = CASE WHEN v_next_state = 'primary' AND state = 'fallback' THEN NOW() ELSE recovered_at END,
      failure_reason = CASE WHEN v_next_state = 'fallback' THEN 'Presenter A/V check or browser connection reported a failure.' ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_session.id
  RETURNING * INTO v_session;
  INSERT INTO public.event_broadcast_health_events (session_id, event_id, connection_state, requested_source, av_check_passed, provider_switch_status, metadata)
  VALUES (v_session.id, v_session.event_id, p_connection_state, v_session.active_source, p_av_check_passed, 'not_configured', jsonb_build_object('source', 'presenter_av_check'));
  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_broadcast_media_signal(
  p_event_id UUID,
  p_connection_state TEXT,
  p_av_check_passed BOOLEAN DEFAULT FALSE,
  p_failure_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.event_broadcast_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.event_broadcast_sessions;
  v_next_state TEXT;
BEGIN
  SELECT * INTO v_session FROM public.event_broadcast_sessions WHERE event_id = p_event_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Broadcast session not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_connection_state NOT IN ('connected', 'disconnected', 'failed', 'checking') THEN
    RAISE EXCEPTION 'Invalid broadcast connection state.' USING ERRCODE = '22023';
  END IF;
  v_next_state := CASE
    WHEN p_av_check_passed AND p_connection_state = 'connected' THEN 'primary'
    WHEN p_connection_state IN ('disconnected', 'failed') THEN 'fallback'
    ELSE v_session.state
  END;
  UPDATE public.event_broadcast_sessions
  SET connection_state = p_connection_state,
      state = v_next_state,
      active_source = CASE WHEN v_next_state = 'fallback' THEN 'fallback' ELSE 'primary' END,
      last_heartbeat_at = NOW(),
      fallback_activated_at = CASE WHEN v_next_state = 'fallback' AND state <> 'fallback' THEN NOW() ELSE fallback_activated_at END,
      recovered_at = CASE WHEN v_next_state = 'primary' AND state = 'fallback' THEN NOW() ELSE recovered_at END,
      failure_reason = CASE WHEN v_next_state = 'fallback' THEN COALESCE(p_failure_reason, 'Media server connection failed.') ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_session.id
  RETURNING * INTO v_session;
  INSERT INTO public.event_broadcast_health_events (session_id, event_id, connection_state, requested_source, av_check_passed, provider_switch_status, metadata)
  VALUES (v_session.id, v_session.event_id, p_connection_state, v_session.active_source, p_av_check_passed, 'pending', COALESCE(p_metadata, '{}'::jsonb));
  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_broadcast_media_signal(UUID, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_event_broadcast_session(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_presenter_av_check(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_broadcast_media_signal(UUID, TEXT, BOOLEAN, TEXT, JSONB) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_broadcast_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_broadcast_health_events;
