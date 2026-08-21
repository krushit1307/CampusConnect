-- Migration: 20260828000000_multi_day_schedule_builder.sql
-- Description: Dynamic Interactive Schedule Builder for multi-day events (tracks + sessions + favorites)

-- ─── 1. schedule_tracks table ──────────────────────────────────────────────
-- A "track" is a parallel column on the schedule grid, e.g. "Main Stage", "Room 204".

CREATE TABLE IF NOT EXISTS public.schedule_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366F1',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS schedule_tracks_event_id_idx ON public.schedule_tracks(event_id);

-- ─── 2. schedule_sessions table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  track_id     UUID REFERENCES public.schedule_tracks(id) ON DELETE SET NULL,
  -- Denormalized so a session can be shown even if its track is later renamed/removed,
  -- and to support quick CSV/text imports before tracks exist.
  track_name   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  speaker      TEXT,
  location     TEXT,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_sessions_time_check CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS schedule_sessions_event_id_idx ON public.schedule_sessions(event_id);
CREATE INDEX IF NOT EXISTS schedule_sessions_track_id_idx ON public.schedule_sessions(track_id);
CREATE INDEX IF NOT EXISTS schedule_sessions_start_time_idx ON public.schedule_sessions(event_id, start_time);

-- ─── 3. session_favorites table (attendee's personal itinerary) ───────────

CREATE TABLE IF NOT EXISTS public.session_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.schedule_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ, -- set once the 10-minute-before push has been sent (avoids duplicate sends)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS session_favorites_user_id_idx ON public.session_favorites(user_id);
CREATE INDEX IF NOT EXISTS session_favorites_session_id_idx ON public.session_favorites(session_id);

-- ─── 4. updated_at triggers (reuses existing helper function) ─────────────

CREATE TRIGGER set_updated_at_schedule_tracks
BEFORE UPDATE ON public.schedule_tracks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_schedule_sessions
BEFORE UPDATE ON public.schedule_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep track_name in sync with schedule_tracks.name so renaming a track
-- doesn't require rewriting every session row from the client.
CREATE OR REPLACE FUNCTION public.sync_schedule_session_track_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.track_id IS NOT NULL THEN
    SELECT name INTO NEW.track_name FROM public.schedule_tracks WHERE id = NEW.track_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_schedule_session_track_name_trigger
BEFORE INSERT OR UPDATE OF track_id ON public.schedule_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_schedule_session_track_name();

CREATE OR REPLACE FUNCTION public.propagate_track_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.schedule_sessions SET track_name = NEW.name WHERE track_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER propagate_track_rename_trigger
AFTER UPDATE OF name ON public.schedule_tracks
FOR EACH ROW EXECUTE FUNCTION public.propagate_track_rename();

-- ─── 5. Overlap guard within the same track ────────────────────────────────
-- Two sessions on the SAME track cannot overlap in time (parallel tracks are
-- fine — that's the whole point — but a room/track double-booking is a bug).

CREATE OR REPLACE FUNCTION public.prevent_schedule_session_track_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.track_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.schedule_sessions s
    WHERE s.track_id = NEW.track_id
      AND s.id <> NEW.id
      AND s.start_time < NEW.end_time
      AND s.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'Session overlaps with another session already on this track'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_schedule_session_track_overlap_trigger
BEFORE INSERT OR UPDATE OF track_id, start_time, end_time ON public.schedule_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_schedule_session_track_overlap();

-- ─── 6. Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.schedule_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_favorites ENABLE ROW LEVEL SECURITY;

-- Anyone can read tracks/sessions for a published event (public schedule page).
CREATE POLICY "Anyone can view schedule tracks"
  ON public.schedule_tracks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view schedule sessions"
  ON public.schedule_sessions FOR SELECT
  USING (true);

-- Only the event's club admins/organizers (or the event creator) can manage the schedule.
-- Reuses the same "is this user allowed to manage this event" check used by other
-- event-management RLS policies in this project (club owner/admin or event creator).
CREATE POLICY "Organizers can insert schedule tracks"
  ON public.schedule_tracks FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Organizers can update schedule tracks"
  ON public.schedule_tracks FOR UPDATE
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Organizers can delete schedule tracks"
  ON public.schedule_tracks FOR DELETE
  USING (public.can_manage_event(event_id));

CREATE POLICY "Organizers can insert schedule sessions"
  ON public.schedule_sessions FOR INSERT
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Organizers can update schedule sessions"
  ON public.schedule_sessions FOR UPDATE
  USING (public.can_manage_event(event_id))
  WITH CHECK (public.can_manage_event(event_id));

CREATE POLICY "Organizers can delete schedule sessions"
  ON public.schedule_sessions FOR DELETE
  USING (public.can_manage_event(event_id));

-- Favorites are private to each attendee.
CREATE POLICY "Users can view their own favorites"
  ON public.session_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON public.session_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.session_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 7. can_manage_event() helper (create if this project doesn't already have one) ─
-- Guarded with a DO block so this migration is safe to run even if an equivalent
-- helper already exists under a different name — adjust to call the project's
-- existing helper instead if one is found (see 20260716000007_helper_rls_functions.sql).

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    LEFT JOIN public.club_members cm
      ON cm.club_id = e.club_id AND cm.user_id = auth.uid()
    WHERE e.id = p_event_id
      AND (
        e.created_by = auth.uid()
        OR cm.role IN ('owner', 'admin')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_event(UUID) TO authenticated;

-- ─── 8. RPC: sessions starting in ~10 minutes for favorited-session push reminders ──

CREATE OR REPLACE FUNCTION public.get_upcoming_favorited_sessions_for_push_reminders()
RETURNS TABLE (
  favorite_id UUID,
  session_id  UUID,
  session_title TEXT,
  event_id    UUID,
  start_time  TIMESTAMPTZ,
  track_name  TEXT,
  location    TEXT,
  user_id     UUID,
  endpoint    TEXT,
  p256dh      TEXT,
  auth        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id AS favorite_id,
    s.id AS session_id,
    s.title AS session_title,
    s.event_id AS event_id,
    s.start_time AS start_time,
    s.track_name AS track_name,
    s.location AS location,
    f.user_id AS user_id,
    ps.endpoint AS endpoint,
    ps.p256dh AS p256dh,
    ps.auth AS auth
  FROM public.session_favorites f
  JOIN public.schedule_sessions s ON s.id = f.session_id
  JOIN public.push_subscriptions ps ON ps.user_id = f.user_id
  WHERE f.notified_at IS NULL
    AND s.start_time >= (now() + INTERVAL '9 minutes')
    AND s.start_time <= (now() + INTERVAL '11 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_session_favorite_notified(p_favorite_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.session_favorites SET notified_at = now() WHERE id = p_favorite_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_upcoming_favorited_sessions_for_push_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_favorited_sessions_for_push_reminders() TO service_role;
REVOKE EXECUTE ON FUNCTION public.mark_session_favorite_notified(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_session_favorite_notified(UUID) TO service_role;

-- ─── 9. Schedule the reminder job to run every minute ──────────────────────

DO $$
BEGIN
  PERFORM extensions.cron.schedule('session-favorite-reminder-push', '* * * * *', $$
  SELECT net.http_post(
      'http://localhost:54321/functions/v1/session-reminder-push',
      '{}'::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      )
  );
  $$);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
