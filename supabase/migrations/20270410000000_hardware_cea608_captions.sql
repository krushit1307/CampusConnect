-- =============================================================================
-- Issue #4731 - Real-Time Audio/Visual Check Automated Subtitles (Hardware)
-- Identify the campus hardware encoder and burn Deepgram CEA-608/708 captions
-- into the H.264/RTMP feed (Blackmagic Web Presenter or AWS MediaLive).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_hardware_encoders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  encoder_type TEXT NOT NULL CHECK (
    encoder_type IN ('blackmagic_web_presenter', 'aws_medialive')
  ),
  rest_base_url TEXT NOT NULL,
  rtmp_url TEXT,
  channel_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_hardware_encoders_event
  ON public.event_hardware_encoders (event_id)
  WHERE is_active;

ALTER TABLE public.event_hardware_encoders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees can see active hardware encoder type" ON public.event_hardware_encoders;
CREATE POLICY "Attendees can see active hardware encoder type"
  ON public.event_hardware_encoders FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Organizers identify hardware encoder" ON public.event_hardware_encoders;
CREATE POLICY "Organizers identify hardware encoder"
  ON public.event_hardware_encoders FOR ALL TO authenticated
  USING (public.is_event_organizer(event_id, auth.uid()))
  WITH CHECK (public.is_event_organizer(event_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.upsert_event_hardware_encoder(
  p_event_id UUID,
  p_encoder_type TEXT,
  p_rest_base_url TEXT,
  p_rtmp_url TEXT DEFAULT NULL,
  p_channel_id TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS public.event_hardware_encoders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_hardware_encoders;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_event_organizer(p_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only event organizers can identify the hardware encoder.' USING ERRCODE = '42501';
  END IF;
  IF p_encoder_type NOT IN ('blackmagic_web_presenter', 'aws_medialive') THEN
    RAISE EXCEPTION 'Encoder must be blackmagic_web_presenter or aws_medialive.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(p_rest_base_url), '') IS NULL THEN
    RAISE EXCEPTION 'Hardware encoder REST URL is required.' USING ERRCODE = '22023';
  END IF;
  IF p_encoder_type = 'aws_medialive' AND NULLIF(BTRIM(p_channel_id), '') IS NULL THEN
    RAISE EXCEPTION 'AWS MediaLive channel id is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_hardware_encoders (
    event_id, encoder_type, rest_base_url, rtmp_url, channel_id, is_active, updated_at
  ) VALUES (
    p_event_id,
    p_encoder_type,
    BTRIM(p_rest_base_url),
    NULLIF(BTRIM(p_rtmp_url), ''),
    NULLIF(BTRIM(p_channel_id), ''),
    COALESCE(p_is_active, TRUE),
    NOW()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    encoder_type = EXCLUDED.encoder_type,
    rest_base_url = EXCLUDED.rest_base_url,
    rtmp_url = EXCLUDED.rtmp_url,
    channel_id = EXCLUDED.channel_id,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT SELECT ON public.event_hardware_encoders TO authenticated;
GRANT ALL ON public.event_hardware_encoders TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_event_hardware_encoder(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON TABLE public.event_hardware_encoders IS
  'University hardware encoder (Blackmagic Web Presenter or AWS MediaLive) used to burn CEA-608/708 into the RTMP feed (#4731).';
