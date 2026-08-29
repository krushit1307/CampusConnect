-- =============================================================================
-- Issue #4732 - Dynamic "Club Tag" Hierarchical Taxonomy
-- Parent/child DAG on public.tags so followed-tag event queries walk UP
-- (MachineLearning sees ComputerScience) and publish fan-out walks DOWN
-- (MachineLearning notifies NeuralNetworks subscribers).
-- =============================================================================

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

UPDATE public.tags SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.tags ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.tags ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tags_id_key ON public.tags (id);

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS parent_tag_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_parent_tag_id_fkey'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_parent_tag_id_fkey
      FOREIGN KEY (parent_tag_id) REFERENCES public.tags(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_parent_not_self'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_parent_not_self
      CHECK (parent_tag_id IS DISTINCT FROM id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_parent_tag_id ON public.tags (parent_tag_id);

CREATE OR REPLACE FUNCTION public.prevent_tag_parent_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_tag_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_tag_id = NEW.id THEN
    RAISE EXCEPTION 'tag cannot be its own parent';
  END IF;

  IF NEW.id IS NOT NULL AND EXISTS (
    WITH RECURSIVE walk AS (
      SELECT t.id, t.parent_tag_id
      FROM public.tags t
      WHERE t.id = NEW.parent_tag_id
      UNION
      SELECT t.id, t.parent_tag_id
      FROM public.tags t
      INNER JOIN walk w ON t.id = w.parent_tag_id
      WHERE t.parent_tag_id IS NOT NULL
    )
    SELECT 1 FROM walk WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'tag parent cycle detected';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tag_parent_cycle ON public.tags;
CREATE TRIGGER trg_prevent_tag_parent_cycle
BEFORE INSERT OR UPDATE OF parent_tag_id ON public.tags
FOR EACH ROW
EXECUTE FUNCTION public.prevent_tag_parent_cycle();

-- #Technology -> #ComputerScience -> #MachineLearning -> #NeuralNetworks
INSERT INTO public.tags (path)
VALUES
  ('Technology'),
  ('Technology.ComputerScience'),
  ('Technology.ComputerScience.MachineLearning'),
  ('Technology.ComputerScience.MachineLearning.NeuralNetworks')
ON CONFLICT (path) DO NOTHING;

UPDATE public.tags AS child
SET parent_tag_id = parent.id
FROM public.tags AS parent
WHERE nlevel(child.path) > 1
  AND parent.path = subpath(child.path, 0, nlevel(child.path) - 1)
  AND child.parent_tag_id IS NULL;

-- Events for a follower: the followed tag plus ancestors (walk UP).
CREATE OR REPLACE FUNCTION public.get_events_for_followed_tags(p_user_id UUID)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE followed_tags AS (
    SELECT t.id
    FROM public.user_tag_subscriptions uts
    JOIN public.club_tag_labels ctl ON ctl.id = uts.tag_id
    JOIN public.tags t
      ON lower(subpath(t.path, -1)::text)
       = lower(btrim(trim(both '#' FROM ctl.name)))
    WHERE uts.user_id = p_user_id
  ),
  ancestors AS (
    SELECT t.id, t.path, t.parent_tag_id
    FROM public.tags t
    WHERE t.id IN (SELECT id FROM followed_tags)
    UNION
    SELECT t.id, t.path, t.parent_tag_id
    FROM public.tags t
    INNER JOIN ancestors a ON t.id = a.parent_tag_id
  )
  SELECT e.*
  FROM public.events e
  WHERE EXISTS (
    SELECT 1
    FROM public.event_tags et
    JOIN public.tags t ON t.path = et.tag_path
    WHERE et.event_id = e.id
      AND t.id IN (SELECT id FROM ancestors)
  )
  OR EXISTS (
    SELECT 1
    FROM unnest(COALESCE(e.tags, ARRAY[]::TEXT[])) AS raw(tag)
    JOIN public.tags t
      ON lower(subpath(t.path, -1)::text)
       = lower(btrim(trim(both '#' FROM raw.tag)))
    WHERE t.id IN (SELECT id FROM ancestors)
      AND btrim(raw.tag) <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_events_for_followed_tags(UUID) TO authenticated;

-- Event tagged X notifies subscribers of X and of descendants (walk DOWN).
CREATE OR REPLACE FUNCTION public.get_tag_subscription_recipients(p_tags TEXT[])
RETURNS TABLE (user_id UUID, tag_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE event_taxonomy AS (
    SELECT t.id
    FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw(tag)
    JOIN public.tags t
      ON lower(subpath(t.path, -1)::text)
       = lower(btrim(trim(both '#' FROM raw.tag)))
    WHERE btrim(raw.tag) <> ''
  ),
  descendants AS (
    SELECT t.id, t.path
    FROM public.tags t
    WHERE t.id IN (SELECT id FROM event_taxonomy)
    UNION
    SELECT t.id, t.path
    FROM public.tags t
    INNER JOIN descendants d ON t.parent_tag_id = d.id
  )
  SELECT DISTINCT uts.user_id, ctl.name AS tag_name
  FROM descendants d
  JOIN public.tags t ON t.id = d.id
  JOIN public.club_tag_labels ctl
    ON lower(btrim(trim(both '#' FROM ctl.name)))
     = lower(subpath(t.path, -1)::text)
  JOIN public.user_tag_subscriptions uts ON uts.tag_id = ctl.id
  UNION
  SELECT DISTINCT uts.user_id, ctl.name AS tag_name
  FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw(tag)
  JOIN public.club_tag_labels ctl
    ON lower(ctl.name) = lower(btrim(trim(both '#' FROM raw.tag)))
  JOIN public.user_tag_subscriptions uts ON uts.tag_id = ctl.id
  WHERE btrim(raw.tag) <> '';
$$;

GRANT EXECUTE ON FUNCTION public.get_tag_subscription_recipients(TEXT[]) TO service_role;
