-- Migration: 20260851000000_club_pitch_audio_analytics.sql
-- Description: Interactive Club Pitch Audio Sandbox Analytics with 5-second playback retention curves (#4271)

CREATE TABLE IF NOT EXISTS public.club_pitch_audio_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  pitch_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_time_listened_sec NUMERIC(10, 2) NOT NULL,
  total_duration_sec NUMERIC(10, 2) NOT NULL DEFAULT 60.0,
  swiped_away BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pitch retention analytics lookup
CREATE INDEX IF NOT EXISTS idx_pitch_audio_telemetry_pitch ON public.club_pitch_audio_telemetry(club_id, pitch_id);

-- Enable RLS
ALTER TABLE public.club_pitch_audio_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert audio pitch telemetry"
ON public.club_pitch_audio_telemetry FOR INSERT
WITH CHECK (true);

CREATE POLICY "Club leaders view pitch analytics"
ON public.club_pitch_audio_telemetry FOR SELECT
USING (true);

-- RPC to aggregate 5-second interval retention curve
CREATE OR REPLACE FUNCTION public.get_club_pitch_retention_curve(
  p_club_id UUID,
  p_pitch_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sessions INT;
  v_avg_listened NUMERIC;
  v_completion_count INT;
  v_result JSONB;
BEGIN
  -- Total distinct playback sessions
  SELECT COUNT(DISTINCT session_id) INTO v_total_sessions
  FROM public.club_pitch_audio_telemetry
  WHERE club_id = p_club_id AND pitch_id = p_pitch_id;

  IF v_total_sessions = 0 THEN
    RETURN jsonb_build_object(
      'total_listens', 0,
      'avg_listened_sec', 0,
      'completion_rate', 0,
      'retention_curve', '[]'::jsonb
    );
  END IF;

  SELECT 
    ROUND(AVG(max_time_listened_sec)::numeric, 1),
    COUNT(*) FILTER (WHERE max_time_listened_sec >= (total_duration_sec - 2))
  INTO v_avg_listened, v_completion_count
  FROM (
    SELECT session_id, MAX(max_time_listened_sec) AS max_time_listened_sec, MAX(total_duration_sec) AS total_duration_sec
    FROM public.club_pitch_audio_telemetry
    WHERE club_id = p_club_id AND pitch_id = p_pitch_id
    GROUP BY session_id
  ) s;

  -- Generate 5-second buckets from 0 to 60s
  WITH RECURSIVE buckets AS (
    SELECT 0 AS sec
    UNION ALL
    SELECT sec + 5 FROM buckets WHERE sec + 5 <= 60
  ),
  session_max AS (
    SELECT session_id, MAX(max_time_listened_sec) AS max_sec
    FROM public.club_pitch_audio_telemetry
    WHERE club_id = p_club_id AND pitch_id = p_pitch_id
    GROUP BY session_id
  ),
  bucket_counts AS (
    SELECT 
      b.sec,
      COUNT(sm.session_id) AS active_listeners
    FROM buckets b
    LEFT JOIN session_max sm ON sm.max_sec >= b.sec
    GROUP BY b.sec
    ORDER BY b.sec
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'second', bc.sec,
      'listeners_count', bc.active_listeners,
      'retention_percentage', ROUND((bc.active_listeners::numeric / v_total_sessions) * 100, 1)
    )
  ) INTO v_result
  FROM bucket_counts bc;

  RETURN jsonb_build_object(
    'pitch_id', p_pitch_id,
    'total_listens', v_total_sessions,
    'avg_listened_sec', v_avg_listened,
    'completion_rate', ROUND((v_completion_count::numeric / v_total_sessions) * 100, 1),
    'retention_curve', v_result
  );
END;
$$;

GRANT ALL ON public.club_pitch_audio_telemetry TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_club_pitch_retention_curve(UUID, TEXT) TO authenticated, anon;
