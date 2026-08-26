-- Multi-level cascading club categories
-- Replaces the old flat, unmanageable "Club Category" list with a
-- self-referencing tree (e.g. Academic -> Engineering -> Robotics).

CREATE TABLE IF NOT EXISTS public.club_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.club_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Root categories share a slug namespace; children only need to be
  -- unique among their own siblings.
  CONSTRAINT club_categories_unique_slug_per_parent UNIQUE NULLS NOT DISTINCT (parent_id, slug),
  CONSTRAINT club_categories_depth_valid CHECK (depth BETWEEN 0 AND 2)
);

CREATE INDEX IF NOT EXISTS idx_club_categories_parent_id ON public.club_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_club_categories_depth ON public.club_categories(depth);

-- Keep `depth` consistent with the parent chain automatically, and cap
-- the tree at 3 levels (0 = "Academic", 1 = "Engineering", 2 = "Robotics")
-- so the UI never has to render an unbounded number of dropdowns.
CREATE OR REPLACE FUNCTION public.set_club_category_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
  ELSE
    SELECT depth INTO parent_depth FROM public.club_categories WHERE id = NEW.parent_id;
    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent category % does not exist', NEW.parent_id;
    END IF;
    IF parent_depth >= 2 THEN
      RAISE EXCEPTION 'Club categories only support 3 levels (depth 0-2)';
    END IF;
    NEW.depth := parent_depth + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_categories_set_depth ON public.club_categories;
CREATE TRIGGER trg_club_categories_set_depth
BEFORE INSERT OR UPDATE OF parent_id ON public.club_categories
FOR EACH ROW EXECUTE FUNCTION public.set_club_category_depth();

-- Clubs point at the single deepest category the creator picked
-- (e.g. the "Robotics" leaf, not "Academic" or "Engineering").
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.club_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clubs_category_id ON public.clubs(category_id);

-- RPC used by the <CascadingSelect> to "reverse engineer" the full
-- ancestor chain (root -> ... -> leaf) from a single deepest category id.
-- This is what lets the edit form pre-populate and open every dropdown
-- level on mount from just clubs.category_id.
CREATE OR REPLACE FUNCTION public.get_club_category_path(leaf_id UUID)
RETURNS TABLE (id UUID, parent_id UUID, name TEXT, slug TEXT, depth INTEGER)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT c.id, c.parent_id, c.name, c.slug, c.depth
    FROM public.club_categories c
    WHERE c.id = leaf_id
    UNION ALL
    SELECT p.id, p.parent_id, p.name, p.slug, p.depth
    FROM public.club_categories p
    JOIN ancestors a ON p.id = a.parent_id
  )
  SELECT * FROM ancestors ORDER BY depth ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_category_path(UUID) TO authenticated, anon;

ALTER TABLE public.club_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club categories are viewable by everyone." ON public.club_categories
  FOR SELECT USING (true);

CREATE POLICY "System admins can insert club categories." ON public.club_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can update club categories." ON public.club_categories
  FOR UPDATE TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can delete club categories." ON public.club_categories
  FOR DELETE TO authenticated USING (public.is_system_admin());

-- Seed a starter hierarchy. This is intentionally small; admins can
-- extend it later through the same table rather than editing code.
INSERT INTO public.club_categories (id, parent_id, name, slug, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', NULL, 'Academic', 'academic', 0),
  ('11111111-0000-0000-0000-000000000002', NULL, 'Arts & Culture', 'arts-culture', 1),
  ('11111111-0000-0000-0000-000000000003', NULL, 'Sports & Recreation', 'sports-recreation', 2),
  ('11111111-0000-0000-0000-000000000004', NULL, 'Service & Advocacy', 'service-advocacy', 3)
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO public.club_categories (id, parent_id, name, slug, sort_order) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Engineering', 'engineering', 0),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Computer Science', 'computer-science', 1),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Business', 'business', 2),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'Music', 'music', 0),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'Visual Arts', 'visual-arts', 1),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000003', 'Team Sports', 'team-sports', 0),
  ('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000003', 'Outdoor & Fitness', 'outdoor-fitness', 1)
ON CONFLICT (parent_id, slug) DO NOTHING;

INSERT INTO public.club_categories (id, parent_id, name, slug, sort_order) VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Robotics', 'robotics', 0),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Aerospace', 'aerospace', 1),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'Civil & Environmental', 'civil-environmental', 2),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'AI & Machine Learning', 'ai-machine-learning', 0),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', 'Cybersecurity', 'cybersecurity', 1),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000004', 'A Cappella', 'a-cappella', 0),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000004', 'Instrumental', 'instrumental', 1)
ON CONFLICT (parent_id, slug) DO NOTHING;
