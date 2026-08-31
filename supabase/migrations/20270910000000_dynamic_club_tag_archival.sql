-- Issue #4669: Dynamic "Club Tag" Automated Archival
-- Archive taxonomy records instead of deleting them so historical event/club
-- relationships remain available for analytics and audit purposes.

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.club_tag_labels
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_status_check'
  ) THEN
    ALTER TABLE public.tags ADD CONSTRAINT tags_status_check CHECK (status IN ('active', 'archived'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'club_tag_labels_status_check'
  ) THEN
    ALTER TABLE public.club_tag_labels ADD CONSTRAINT club_tag_labels_status_check CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

-- Backfill timestamps from existing usage before the archival job is first run.
UPDATE public.tags t
SET last_used_at = COALESCE(
  (SELECT MAX(e.created_at) FROM public.event_tags et JOIN public.events e ON e.id = et.event_id WHERE et.tag_path = t.path),
  t.created_at
)
WHERE t.last_used_at IS NULL;

UPDATE public.club_tag_labels ctl
SET last_used_at = COALESCE(
  (SELECT MAX(c.created_at) FROM public.club_tags ct JOIN public.clubs c ON c.id = ct.club_id WHERE ct.tag_id = ctl.id),
  ctl.created_at
)
WHERE ctl.last_used_at IS NULL;

ALTER TABLE public.tags ALTER COLUMN last_used_at SET DEFAULT NOW();
ALTER TABLE public.tags ALTER COLUMN last_used_at SET NOT NULL;
ALTER TABLE public.club_tag_labels ALTER COLUMN last_used_at SET DEFAULT NOW();
ALTER TABLE public.club_tag_labels ALTER COLUMN last_used_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_active_status ON public.tags(status, last_used_at);
CREATE INDEX IF NOT EXISTS idx_club_tag_labels_active_status ON public.club_tag_labels(status, last_used_at);

CREATE OR REPLACE FUNCTION public.touch_event_tag_last_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tags SET last_used_at = NOW(), status = 'active' WHERE path = NEW.tag_path;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_event_tag_last_used ON public.event_tags;
CREATE TRIGGER trg_touch_event_tag_last_used
AFTER INSERT ON public.event_tags
FOR EACH ROW EXECUTE FUNCTION public.touch_event_tag_last_used();

CREATE OR REPLACE FUNCTION public.touch_club_tag_last_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.club_tag_labels SET last_used_at = NOW(), status = 'active' WHERE id = NEW.tag_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_club_tag_last_used ON public.club_tags;
CREATE TRIGGER trg_touch_club_tag_last_used
AFTER INSERT ON public.club_tags
FOR EACH ROW EXECUTE FUNCTION public.touch_club_tag_last_used();

CREATE OR REPLACE FUNCTION public.archive_inactive_tags()
RETURNS TABLE (archived_event_tags INTEGER, archived_club_tags INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_count INTEGER;
  club_count INTEGER;
BEGIN
  UPDATE public.tags
  SET status = 'archived'
  WHERE status = 'active' AND last_used_at < NOW() - INTERVAL '12 months';
  GET DIAGNOSTICS event_count = ROW_COUNT;

  UPDATE public.club_tag_labels
  SET status = 'archived'
  WHERE status = 'active' AND last_used_at < NOW() - INTERVAL '12 months';
  GET DIAGNOSTICS club_count = ROW_COUNT;

  RETURN QUERY SELECT event_count, club_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_club_tag_labels()
RETURNS SETOF public.club_tag_labels
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.club_tag_labels WHERE status = 'active' ORDER BY name;
$$;

-- Archived event tags must not match hierarchical discovery queries.
CREATE OR REPLACE FUNCTION public.get_events_by_tag(target_path ltree)
RETURNS SETOF public.events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.events e
  JOIN public.event_tags et ON e.id = et.event_id
  JOIN public.tags t ON t.path = et.tag_path
  WHERE et.tag_path <@ target_path AND t.status = 'active';
$$;

-- Keep club discovery taxonomy clean while retaining club_tags rows.
CREATE OR REPLACE FUNCTION public.get_filtered_clubs(
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS SETOF public.clubs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.clubs c
  WHERE (p_search IS NULL OR c.name ILIKE '%' || p_search || '%' OR c.description ILIKE '%' || p_search || '%')
    AND (p_category IS NULL OR c.category = p_category)
    AND (
      p_tags IS NULL OR cardinality(p_tags) = 0 OR EXISTS (
        SELECT 1
        FROM public.club_tags ct
        JOIN public.club_tag_labels ctl ON ctl.id = ct.tag_id
        WHERE ct.club_id = c.id AND ctl.status = 'active' AND lower(ctl.name) = ANY(p_tags)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.archive_inactive_tags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_club_tag_labels() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_events_by_tag(ltree) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_clubs(TEXT, TEXT, TEXT[]) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'archive-inactive-club-tags';
    PERFORM cron.schedule(
      'archive-inactive-club-tags',
      '0 3 1 * *',
      'SELECT public.archive_inactive_tags();'
    );
  END IF;
END $$;
