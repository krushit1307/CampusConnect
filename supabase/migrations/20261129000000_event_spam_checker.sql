-- Issue #3448: Automated Event Description Plagiarism/Spam Checker
-- Rate limits event creation, quarantines near-duplicate descriptions, and alerts
-- Student Union moderators without trusting client-supplied moderation fields.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS spam_similarity REAL,
  ADD COLUMN IF NOT EXISTS spam_reason TEXT,
  ADD COLUMN IF NOT EXISTS spam_original_status TEXT,
  ADD COLUMN IF NOT EXISTS spam_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS spam_reviewed_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_events_created_by_created_at
  ON public.events (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_club_created_at
  ON public.events (club_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_description_trgm
  ON public.events USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_events_pending_spam_review
  ON public.events (status, created_at DESC)
  WHERE status = 'pending_spam_review';

COMMENT ON COLUMN public.events.spam_similarity IS
  'Highest pg_trgm similarity to a recent event description from the same club.';
COMMENT ON COLUMN public.events.spam_reason IS
  'Machine-readable reason for event moderation quarantine.';

CREATE OR REPLACE FUNCTION public.is_event_spam_moderator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        COALESCE(p.is_admin, FALSE)
        OR p.role::TEXT IN ('admin', 'safety_admin', 'system_admin')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    WHERE cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND cm.role = 'admin'
      AND LOWER(c.name) = 'student union'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_event_spam_moderator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_event_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
  v_duplicate_similarity REAL;
BEGIN
  IF NEW.created_by IS NULL OR NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for both dimensions of the limit so two
  -- simultaneous requests cannot both observe the same count and bypass it.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('event-spam:user:' || NEW.created_by::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('event-spam:club:' || NEW.club_id::TEXT, 0)
  );

  -- Five existing published events in the last hour means this insert would
  -- be the sixth and is blocked atomically inside the database transaction.
  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.events e
  WHERE e.created_at >= NOW() - INTERVAL '1 hour'
    AND (e.created_by = NEW.created_by OR e.club_id = NEW.club_id)
    AND COALESCE(e.status, 'scheduled') NOT IN (
      'draft',
      'pending_spam_review',
      'pending_risk_review',
      'rejected',
      'cancelled',
      'canceled'
    );

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Event publishing rate limit exceeded. Try again later.',
      DETAIL = 'event_rate_limit_exceeded';
  END IF;

  IF NULLIF(BTRIM(NEW.description), '') IS NOT NULL THEN
    SELECT MAX(similarity(BTRIM(e.description), BTRIM(NEW.description)))
    INTO v_duplicate_similarity
    FROM public.events e
    WHERE e.club_id = NEW.club_id
      AND e.created_at >= NOW() - INTERVAL '30 days'
      AND e.description IS NOT NULL
      AND NULLIF(BTRIM(e.description), '') IS NOT NULL;

    IF COALESCE(v_duplicate_similarity, 0) >= 0.95 THEN
      NEW.spam_original_status := COALESCE(NEW.status, 'scheduled');
      NEW.spam_similarity := v_duplicate_similarity;
      NEW.spam_reason := 'duplicate_description';
      NEW.status := 'pending_spam_review';

      -- Notifications are inserted by the trusted trigger, so clients cannot
      -- suppress or redirect moderation alerts.
      INSERT INTO public.notifications (user_id, type, title, message, link)
      SELECT p.id,
             'event_spam_review',
             'Event requires spam review',
             'A new event from ' || COALESCE(c.name, 'a club') ||
             ' was quarantined because its description closely matches a recent event.',
             '/admin/events?status=pending_spam_review'
      FROM public.profiles p
      LEFT JOIN public.club_members cm ON cm.user_id = p.id
        AND cm.status = 'approved'
        AND cm.role = 'admin'
      LEFT JOIN public.clubs moderator_club ON moderator_club.id = cm.club_id
        AND LOWER(moderator_club.name) = 'student union'
      LEFT JOIN public.clubs c ON c.id = NEW.club_id
      WHERE COALESCE(p.is_admin, FALSE)
         OR p.role::TEXT IN ('admin', 'safety_admin', 'system_admin')
         OR moderator_club.id IS NOT NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderate_event_before_insert ON public.events;
CREATE TRIGGER trg_moderate_event_before_insert
  BEFORE INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.moderate_event_before_insert();

-- Rebuild the latest public policies with an explicit quarantine exclusion.
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON public.events;
DROP POLICY IF EXISTS "Events are viewable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are viewable by anonymous guests" ON public.events;
DROP POLICY IF EXISTS "Public can view published events" ON public.events;

CREATE POLICY "Events are viewable by authenticated users" ON public.events
  FOR SELECT TO authenticated
  USING (
    (
      status IS DISTINCT FROM 'pending_spam_review'
      OR public.is_event_spam_moderator(auth.uid())
    )
    AND (deleted_at IS NULL OR public.is_system_admin())
    AND (
      is_private IS FALSE OR is_private IS NULL
      OR auth.uid() = created_by
      OR EXISTS (
        SELECT 1
        FROM public.club_members
        WHERE club_members.club_id = events.club_id
          AND club_members.user_id = auth.uid()
          AND club_members.status = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM public.clubs
        WHERE clubs.id = events.club_id
          AND clubs.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.event_cohosts
        WHERE event_cohosts.event_id = events.id
          AND event_cohosts.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Events are viewable by anonymous guests" ON public.events
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND status IS DISTINCT FROM 'pending_spam_review'
    AND is_public_showcase = TRUE
  );

CREATE POLICY "Public can view published events" ON public.events
  FOR SELECT
  USING (
    status IN ('published', 'approved')
    AND status IS DISTINCT FROM 'pending_spam_review'
  );

DROP POLICY IF EXISTS "Spam moderators can update quarantined events" ON public.events;
CREATE POLICY "Spam moderators can update quarantined events" ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_event_spam_moderator(auth.uid()))
  WITH CHECK (public.is_event_spam_moderator(auth.uid()));

DROP POLICY IF EXISTS "Spam moderators can delete quarantined events" ON public.events;
CREATE POLICY "Spam moderators can delete quarantined events" ON public.events
  FOR DELETE TO authenticated
  USING (public.is_event_spam_moderator(auth.uid()));

CREATE OR REPLACE FUNCTION public.review_event_spam(
  p_event_id UUID,
  p_decision TEXT
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events;
BEGIN
  IF NOT public.is_event_spam_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Only Student Union moderators can review quarantined events.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approve', 'delete') THEN
    RAISE EXCEPTION 'Decision must be approve or delete.' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approve' THEN
    UPDATE public.events
    SET status = COALESCE(spam_original_status, 'scheduled'),
        spam_reviewed_at = NOW(),
        spam_reviewed_by = auth.uid(),
        spam_reason = NULL
    WHERE id = p_event_id
      AND status = 'pending_spam_review'
    RETURNING * INTO v_event;
  ELSE
    UPDATE public.events
    SET status = 'rejected',
        deleted_at = COALESCE(deleted_at, NOW()),
        spam_reviewed_at = NOW(),
        spam_reviewed_by = auth.uid()
    WHERE id = p_event_id
      AND status = 'pending_spam_review'
    RETURNING * INTO v_event;
  END IF;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Quarantined event was not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_event_spam(UUID, TEXT) TO authenticated;
