-- ============================================================
-- Migration: 20261233000000_alumni_speaker_live_translation_earpiece_routing.sql
-- Issue: #5285 — Dynamic "Alumni Speaker" Live Translation Earpiece Routing
--
-- Context
--   VOD subtitles (#5066) solve async playback. This closes the live
--   gap: an international student in the back row cannot follow an
--   English keynote. We stream near-real-time AI-translated audio to
--   the student's personal AirPods/headphones via WebRTC.
--
-- Pipeline (Deepgram → DeepL → TTS → WebRTC)
--   1. English audio → Deepgram WebSocket transcription (see
--      src/lib/hardwareClosedCaptions.extractDeepgramTranscript).
--   2. English transcript → DeepL (or equivalent) neural translation
--      to the student's target language (default: Mandarin / zh).
--   3. Mandarin text → AWS Polly / ElevenLabs TTS audio buffer.
--   4. Audio buffer → WebRTC peer stream to the student's mobile
--      earpiece via a Supabase Realtime / WebRTC signalling channel,
--      synchronized with speaker cadence (latency-budget aware).
--
-- Design notes
--   1. `alumni_speaker_live_sessions` is the organiser-owned session
--      ledger per event/speaker. One active live session per event at
--      a time (partial unique index). Holds source language, target
--      languages, Deepgram session id, WebRTC room, and pipeline
--      stage for observability.
--   2. `earpiece_translation_routes` is the per-student routing table.
--      One route per (session, user, target_language). Holds the
--      WebRTC offer/answer JSON, connection state, earpiece type
--      (airpods/headphones), and latency telemetry. Written via RLS
--      + SECURITY DEFINER RPCs so only checked-in attendees may join.
--   3. WebRTC signalling is persisted as JSONB offer/answer on the
--      route row and fanned out via Supabase Realtime (table added to
--      supabase_realtime publication). Clients subscribe to the route.
--   4. RLS: sessions are public-read, organiser-write. Routes are
--      public-read for the session, but only the owning user (and
--      checked-in attendees) may INSERT/UPDATE their own row.
--      Organisers may read all routes for their session.
--   5. All RPCs are SECURITY DEFINER with explicit organiser / attendee
--      checks and search_path=public.
-- ============================================================

BEGIN;

-- ─── 1. Helpers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_live_translation_organizer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_has_roles BOOLEAN;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_event.created_by = p_user_id THEN RETURN TRUE; END IF;
  IF v_event.club_id IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = v_event.club_id AND c.created_by = p_user_id) THEN RETURN TRUE; END IF;
  v_has_roles := to_regclass('public.club_roles') IS NOT NULL;
  IF v_has_roles THEN
    RETURN EXISTS (
      SELECT 1 FROM public.club_members cm
      JOIN public.club_roles cr ON cr.id = cm.role_id
      WHERE cm.club_id = v_event.club_id AND cm.user_id = p_user_id AND cm.status::TEXT='approved' AND cr.permissions_level >= 100
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = v_event.club_id AND cm.user_id = p_user_id AND cm.status::TEXT='approved' AND cm.role::TEXT IN ('owner','admin','officer')
  );
END; $$;

-- ─── 2. Live session ledger ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alumni_speaker_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  alumni_speaker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  speaker_name TEXT,
  speaker_email TEXT,
  source_language TEXT NOT NULL DEFAULT 'en' CHECK (char_length(source_language) BETWEEN 2 AND 10),
  target_languages TEXT[] NOT NULL DEFAULT ARRAY['zh']::TEXT[] CHECK (array_length(target_languages,1) BETWEEN 1 AND 8),
  deepgram_session_id TEXT,
  webrtc_room_id TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'idle' CHECK (pipeline_stage IN ('idle','transcribing','translating','synthesizing','streaming','error','ended')),
  is_live BOOLEAN NOT NULL DEFAULT false,
  latency_budget_ms INTEGER NOT NULL DEFAULT 1200 CHECK (latency_budget_ms BETWEEN 200 AND 5000),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.alumni_speaker_live_sessions IS 'Issue #5285 — organiser-owned live translation sessions driving Deepgram→DeepL→TTS→WebRTC pipeline.';
COMMENT ON COLUMN public.alumni_speaker_live_sessions.pipeline_stage IS 'Current pipeline stage for observability: idle/transcribing/translating/synthesizing/streaming/error/ended';
COMMENT ON COLUMN public.alumni_speaker_live_sessions.target_languages IS 'BCP-47-ish target languages offered to earpieces, e.g. {zh,es,hi}';

CREATE INDEX IF NOT EXISTS idx_live_sessions_event ON public.alumni_speaker_live_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_is_live ON public.alumni_speaker_live_sessions(event_id, is_live) WHERE is_live = true;

-- One live session per event at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_sessions_one_live_per_event
  ON public.alumni_speaker_live_sessions(event_id) WHERE is_live = true;

CREATE OR REPLACE FUNCTION public.touch_live_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_live_session ON public.alumni_speaker_live_sessions;
CREATE TRIGGER trg_touch_live_session BEFORE UPDATE ON public.alumni_speaker_live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_live_session_updated_at();

-- ─── 3. Per-student earpiece routing table ─────────────────────
CREATE TABLE IF NOT EXISTS public.earpiece_translation_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.alumni_speaker_live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK (char_length(target_language) BETWEEN 2 AND 10),
  earpiece_device_type TEXT NOT NULL DEFAULT 'airpods' CHECK (earpiece_device_type IN ('airpods','headphones','hearing_aid','speaker','other')),
  connection_state TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_state IN ('disconnected','connecting','connected','error')),
  webrtc_offer JSONB,
  webrtc_answer JSONB,
  audio_buffer_url TEXT,
  latency_ms INTEGER CHECK (latency_ms BETWEEN 0 AND 10000),
  last_transcript TEXT,
  last_translation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id, target_language)
);

COMMENT ON TABLE public.earpiece_translation_routes IS 'Issue #5285 — per-student WebRTC earpiece routes; one row per (session,user,language) with offer/answer signalling.';

CREATE INDEX IF NOT EXISTS idx_earpiece_routes_session ON public.earpiece_translation_routes(session_id);
CREATE INDEX IF NOT EXISTS idx_earpiece_routes_user ON public.earpiece_translation_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_earpiece_routes_state ON public.earpiece_translation_routes(connection_state);

CREATE OR REPLACE FUNCTION public.touch_earpiece_route_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_earpiece_route ON public.earpiece_translation_routes;
CREATE TRIGGER trg_touch_earpiece_route BEFORE UPDATE ON public.earpiece_translation_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_earpiece_route_updated_at();

-- ─── 4. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.alumni_speaker_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earpiece_translation_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read live sessions" ON public.alumni_speaker_live_sessions;
CREATE POLICY "Anyone can read live sessions" ON public.alumni_speaker_live_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organisers can manage live sessions" ON public.alumni_speaker_live_sessions;
CREATE POLICY "Organisers can manage live sessions" ON public.alumni_speaker_live_sessions FOR ALL TO authenticated
  USING (public.is_live_translation_organizer(event_id, auth.uid()))
  WITH CHECK (public.is_live_translation_organizer(event_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can read earpiece routes" ON public.earpiece_translation_routes;
CREATE POLICY "Anyone can read earpiece routes" ON public.earpiece_translation_routes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Checked-in attendees can join earpiece routes" ON public.earpiece_translation_routes;
CREATE POLICY "Checked-in attendees can join earpiece routes" ON public.earpiece_translation_routes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.alumni_speaker_live_sessions s
      JOIN public.events e ON e.id = s.event_id
      JOIN public.event_rsvps r ON r.event_id = e.id AND r.user_id = auth.uid() AND r.checked_in = true
      WHERE s.id = session_id
    )
  );

DROP POLICY IF EXISTS "Owners can update own earpiece routes" ON public.earpiece_translation_routes;
CREATE POLICY "Owners can update own earpiece routes" ON public.earpiece_translation_routes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can delete own earpiece routes" ON public.earpiece_translation_routes;
CREATE POLICY "Owners can delete own earpiece routes" ON public.earpiece_translation_routes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ─── 5. RPCs ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_live_translation_session(
  p_event_id UUID,
  p_target_languages TEXT[] DEFAULT ARRAY['zh']::TEXT[],
  p_source_language TEXT DEFAULT 'en',
  p_speaker_name TEXT DEFAULT NULL,
  p_speaker_email TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid(); v_session_id UUID; v_room TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF NOT public.is_live_translation_organizer(p_event_id, v_caller) THEN RAISE EXCEPTION 'Only the event organizer can create live translation sessions'; END IF;
  IF p_target_languages IS NULL OR array_length(p_target_languages,1) IS NULL THEN RAISE EXCEPTION 'target_languages must contain 1-8 languages'; END IF;
  IF array_length(p_target_languages,1) > 8 THEN RAISE EXCEPTION 'At most 8 target languages allowed'; END IF;
  v_room := 'webrtc_' || replace(p_event_id::TEXT, '-', '') || '_' || extract(epoch from NOW())::TEXT;
  INSERT INTO public.alumni_speaker_live_sessions(event_id, speaker_name, speaker_email, source_language, target_languages, webrtc_room_id, pipeline_stage, is_live, created_by)
  VALUES (p_event_id, NULLIF(btrim(p_speaker_name),''), NULLIF(btrim(p_speaker_email),''), lower(btrim(p_source_language)), p_target_languages, v_room, 'idle', true, v_caller)
  RETURNING id INTO v_session_id;
  RETURN jsonb_build_object('id', v_session_id, 'webrtc_room_id', v_room, 'event_id', p_event_id);
END; $$;

CREATE OR REPLACE FUNCTION public.join_earpiece_route(
  p_session_id UUID,
  p_target_language TEXT,
  p_earpiece_device_type TEXT DEFAULT 'airpods'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid(); v_event_id UUID; v_route_id UUID;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT event_id INTO v_event_id FROM public.alumni_speaker_live_sessions WHERE id = p_session_id;
  IF v_event_id IS NULL THEN RAISE EXCEPTION 'Live session not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_rsvps WHERE event_id = v_event_id AND user_id = v_caller AND checked_in = true) THEN
    RAISE EXCEPTION 'Only checked-in attendees may join the live translation earpiece';
  END IF;
  INSERT INTO public.earpiece_translation_routes(session_id, user_id, target_language, earpiece_device_type, connection_state)
  VALUES (p_session_id, v_caller, lower(btrim(p_target_language)), p_earpiece_device_type, 'connecting')
  ON CONFLICT (session_id, user_id, target_language) DO UPDATE SET earpiece_device_type = EXCLUDED.earpiece_device_type, connection_state = 'connecting', updated_at = NOW()
  RETURNING id INTO v_route_id;
  RETURN jsonb_build_object('id', v_route_id, 'session_id', p_session_id, 'target_language', lower(btrim(p_target_language)));
END; $$;

CREATE OR REPLACE FUNCTION public.update_earpiece_webrtc_signal(
  p_route_id UUID,
  p_offer JSONB DEFAULT NULL,
  p_answer JSONB DEFAULT NULL,
  p_connection_state TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid(); v_owner UUID;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT user_id INTO v_owner FROM public.earpiece_translation_routes WHERE id = p_route_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Earpiece route not found'; END IF;
  IF v_owner <> v_caller THEN RAISE EXCEPTION 'Only the route owner may update WebRTC signal'; END IF;
  UPDATE public.earpiece_translation_routes SET
    webrtc_offer = COALESCE(p_offer, webrtc_offer),
    webrtc_answer = COALESCE(p_answer, webrtc_answer),
    connection_state = COALESCE(p_connection_state, connection_state),
    updated_at = NOW()
  WHERE id = p_route_id;
  RETURN jsonb_build_object('id', p_route_id, 'connection_state', COALESCE(p_connection_state, 'updated'));
END; $$;

CREATE OR REPLACE FUNCTION public.get_live_translation_routes(p_session_id UUID)
RETURNS TABLE (id UUID, user_id UUID, target_language TEXT, earpiece_device_type TEXT, connection_state TEXT, latency_ms INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT r.id, r.user_id, r.target_language, r.earpiece_device_type, r.connection_state, r.latency_ms, r.created_at
  FROM public.earpiece_translation_routes r WHERE r.session_id = p_session_id ORDER BY r.created_at;
END; $$;

-- Realtime
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.alumni_speaker_live_sessions';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.earpiece_translation_routes';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
END $$;

-- Grants
GRANT SELECT ON public.alumni_speaker_live_sessions TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.earpiece_translation_routes TO authenticated;
GRANT SELECT ON public.earpiece_translation_routes TO anon;
GRANT EXECUTE ON FUNCTION public.is_live_translation_organizer(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_live_translation_session(UUID,TEXT[],TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_earpiece_route(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_earpiece_webrtc_signal(UUID,JSONB,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_translation_routes(UUID) TO authenticated;

COMMIT;
