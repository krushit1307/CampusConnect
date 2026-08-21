-- Peer-to-peer study sessions (issue #3452).
-- Course codes live on profiles so discovery is driven by academic overlap.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS course_codes TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS idx_profiles_course_codes
  ON public.profiles USING gin (course_codes);

CREATE TABLE IF NOT EXISTS public.micro_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL CHECK (course_code = upper(trim(course_code)) AND char_length(course_code) BETWEEN 2 AND 32),
  location TEXT NOT NULL CHECK (char_length(trim(location)) BETWEEN 2 AND 160),
  max_capacity INTEGER NOT NULL DEFAULT 6 CHECK (max_capacity BETWEEN 2 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_micro_events_active_course
  ON public.micro_events (course_code, expires_at)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.micro_event_participants (
  micro_event_id UUID NOT NULL REFERENCES public.micro_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (micro_event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_micro_event_participants_user
  ON public.micro_event_participants (user_id, micro_event_id);

ALTER TABLE public.micro_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active micro-events" ON public.micro_events;
CREATE POLICY "Authenticated users can view active micro-events"
  ON public.micro_events FOR SELECT TO authenticated
  USING (archived_at IS NULL AND expires_at > now());

DROP POLICY IF EXISTS "Users can create their own micro-events" ON public.micro_events;
CREATE POLICY "Users can create their own micro-events"
  ON public.micro_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can archive their micro-events" ON public.micro_events;
CREATE POLICY "Hosts can archive their micro-events"
  ON public.micro_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Hosts can delete their micro-events" ON public.micro_events;
CREATE POLICY "Hosts can delete their micro-events"
  ON public.micro_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view active participants" ON public.micro_event_participants;
CREATE POLICY "Authenticated users can view active participants"
  ON public.micro_event_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.micro_events m
      WHERE m.id = micro_event_id
        AND m.archived_at IS NULL
        AND m.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Users can join as themselves" ON public.micro_event_participants;
CREATE POLICY "Users can join as themselves"
  ON public.micro_event_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave their own sessions" ON public.micro_event_participants;
CREATE POLICY "Users can leave their own sessions"
  ON public.micro_event_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_micro_event(
  p_course_code TEXT,
  p_location TEXT,
  p_max_capacity INTEGER DEFAULT 6
)
RETURNS public.micro_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.micro_events;
  v_course_code TEXT := upper(trim(p_course_code));
  v_location TEXT := trim(p_location);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_course_code) < 2 OR char_length(v_course_code) > 32 THEN
    RAISE EXCEPTION 'Course code must be between 2 and 32 characters';
  END IF;
  IF char_length(v_location) < 2 OR char_length(v_location) > 160 THEN
    RAISE EXCEPTION 'Location must be between 2 and 160 characters';
  END IF;
  IF p_max_capacity < 2 OR p_max_capacity > 6 THEN
    RAISE EXCEPTION 'Capacity must be between 2 and 6 people';
  END IF;

  INSERT INTO public.micro_events (user_id, course_code, location, max_capacity)
  VALUES (auth.uid(), v_course_code, v_location, p_max_capacity)
  RETURNING * INTO v_event;

  INSERT INTO public.micro_event_participants (micro_event_id, user_id)
  VALUES (v_event.id, auth.uid());

  UPDATE public.profiles
  SET course_codes = ARRAY(
    SELECT DISTINCT code
    FROM unnest(COALESCE(course_codes, '{}'::TEXT[]) || ARRAY[v_course_code]) AS code
    ORDER BY code
  )
  WHERE id = auth.uid();

  RETURN v_event;
END;
$$;

-- Keep the hard capacity cap atomic by locking the session row before counting.
CREATE OR REPLACE FUNCTION public.join_micro_event(p_micro_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.micro_events%ROWTYPE;
  v_participant_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event
  FROM public.micro_events
  WHERE id = p_micro_event_id
  FOR UPDATE;

  IF NOT FOUND OR v_event.archived_at IS NOT NULL OR v_event.expires_at <= now() THEN
    RAISE EXCEPTION 'This study session is no longer active' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.micro_event_participants
    WHERE micro_event_id = p_micro_event_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_participant_count
  FROM public.micro_event_participants
  WHERE micro_event_id = p_micro_event_id;

  IF v_participant_count >= v_event.max_capacity THEN
    RAISE EXCEPTION 'This study session is full' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.micro_event_participants (micro_event_id, user_id)
  VALUES (p_micro_event_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_micro_event(p_micro_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.micro_event_participants
  WHERE micro_event_id = p_micro_event_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_micro_event(p_micro_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.micro_events
  SET archived_at = now()
  WHERE id = p_micro_event_id
    AND user_id = auth.uid()
    AND archived_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_matching_micro_events()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  course_code TEXT,
  location TEXT,
  max_capacity INTEGER,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  host_name TEXT,
  host_handle TEXT,
  participant_count INTEGER,
  is_joined BOOLEAN,
  is_host BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    m.course_code,
    m.location,
    m.max_capacity,
    m.created_at,
    m.expires_at,
    COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.handle, 'CampusConnect student') AS host_name,
    p.handle AS host_handle,
    (SELECT COUNT(*)::INTEGER FROM public.micro_event_participants mp WHERE mp.micro_event_id = m.id) AS participant_count,
    EXISTS (
      SELECT 1 FROM public.micro_event_participants mp
      WHERE mp.micro_event_id = m.id AND mp.user_id = auth.uid()
    ) AS is_joined,
    m.user_id = auth.uid() AS is_host
  FROM public.micro_events m
  JOIN public.profiles p ON p.id = m.user_id
  JOIN public.profiles viewer ON viewer.id = auth.uid()
  WHERE m.archived_at IS NULL
    AND m.expires_at > now()
    AND m.course_code = ANY(viewer.course_codes)
  ORDER BY m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.create_micro_event(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_micro_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_micro_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_micro_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_matching_micro_events() TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_expired_micro_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.micro_events
  SET archived_at = COALESCE(archived_at, now())
  WHERE archived_at IS NULL AND expires_at <= now();

  DELETE FROM public.micro_events
  WHERE archived_at < now() - interval '7 days';
END;
$$;

-- pg_cron is available in hosted Supabase projects; failures here do not affect user queries.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'cleanup-expired-micro-events',
  '*/15 * * * *',
  $$SELECT public.cleanup_expired_micro_events();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-micro-events'
);
