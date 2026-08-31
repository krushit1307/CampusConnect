-- Issue #5015: Sponsorship Exclusivity Register
--
-- Exclusivity is the thing being sold and the thing nobody records. What is
-- stored here is the promise — a brand, a category, a scope, a term and a
-- strength — rather than the PDF it was written into.
--
-- Categories are self-referencing because exclusivity binds downward: a grant
-- over financial services precludes a retail bank and an insurer, and a flat
-- list would force every deal to be written at one granularity.
--
-- Terms are half-open. A season running to June and a one-night deal in March
-- overlap for one night, which is one night more than the promise allowed, and
-- a grant ending the day another begins does not collide with it. Both cases
-- need real interval arithmetic, which is why the exclusion constraint below
-- uses a range rather than a pair of date comparisons.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A reusable venue registry. public.event_venues records the venue *of an
-- event*, which cannot be the target of a venue-scoped grant that outlives any
-- one event.
CREATE TABLE IF NOT EXISTS public.campus_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sponsor_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The corporate parent is the whole point of this table. Two brands under one
-- drinks group share nothing in their names, and a carve-out negotiated against
-- one of them has to follow the group or it is worthless the moment the group
-- re-brands.
CREATE TABLE IF NOT EXISTS public.sponsor_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_group_id UUID REFERENCES public.sponsor_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS sponsor_brands_group_idx
  ON public.sponsor_brands (parent_group_id)
  WHERE parent_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sponsor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  parent_category_id UUID REFERENCES public.sponsor_categories(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_category_id IS NULL OR parent_category_id <> id)
);

CREATE INDEX IF NOT EXISTS sponsor_categories_parent_idx
  ON public.sponsor_categories (parent_category_id);

CREATE TABLE IF NOT EXISTS public.exclusivity_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.sponsor_brands(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.sponsor_categories(id) ON DELETE RESTRICT,
  -- Four different products. Treating every grant as union-wide blocks
  -- legitimate deals; treating every one as event-local misses the ones that
  -- matter.
  scope_level TEXT NOT NULL CHECK (scope_level IN ('EVENT', 'CLUB_SEASON', 'VENUE', 'UNION_WIDE')),
  scope_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  scope_club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  scope_season_id TEXT,
  scope_venue_id UUID REFERENCES public.campus_venues(id) ON DELETE CASCADE,
  -- Half-open. Stored as a range so overlap is an interval question, which is
  -- the only formulation that catches a one-night intersection.
  term TSTZRANGE NOT NULL,
  strength TEXT NOT NULL CHECK (strength IN ('ABSOLUTE', 'ABOVE_TIER', 'FIRST_REFUSAL')),
  -- For ABOVE_TIER: competitors at this tier or better are blocked, lesser ones
  -- are not. A boolean here would either block the small deals the term was
  -- written to permit, or permit the headline deal it exists to prevent.
  blocks_competitors_at_or_above_tier INTEGER CHECK (
    blocks_competitors_at_or_above_tier IS NULL OR blocks_competitors_at_or_above_tier > 0
  ),
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier > 0),
  signed_at TIMESTAMPTZ NOT NULL,
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT isempty(term)),
  CHECK (strength <> 'ABOVE_TIER' OR blocks_competitors_at_or_above_tier IS NOT NULL),
  CHECK (
    (scope_level = 'EVENT' AND scope_event_id IS NOT NULL)
    OR (scope_level = 'CLUB_SEASON' AND scope_club_id IS NOT NULL AND scope_season_id IS NOT NULL)
    OR (scope_level = 'VENUE' AND scope_venue_id IS NOT NULL)
    OR (scope_level = 'UNION_WIDE')
  )
);

CREATE INDEX IF NOT EXISTS exclusivity_grants_term_idx
  ON public.exclusivity_grants USING GIST (term);
CREATE INDEX IF NOT EXISTS exclusivity_grants_category_idx
  ON public.exclusivity_grants (category_id, scope_level);

-- One brand cannot hold two overlapping grants over the same category at the
-- same scope. This is the one conflict expressible without walking the category
-- hierarchy, so it is enforced here rather than left to the service.
ALTER TABLE public.exclusivity_grants
  DROP CONSTRAINT IF EXISTS exclusivity_grants_no_self_overlap;
ALTER TABLE public.exclusivity_grants
  ADD CONSTRAINT exclusivity_grants_no_self_overlap
  EXCLUDE USING GIST (
    brand_id WITH =,
    category_id WITH =,
    scope_level WITH =,
    term WITH &&
  );

-- The reason a deal was signable in the first place. Named against a brand, and
-- read as covering that brand's whole corporate group.
CREATE TABLE IF NOT EXISTS public.exclusivity_carve_outs (
  grant_id UUID NOT NULL REFERENCES public.exclusivity_grants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.sponsor_brands(id) ON DELETE CASCADE,
  note TEXT,
  PRIMARY KEY (grant_id, brand_id)
);

CREATE TABLE IF NOT EXISTS public.exclusivity_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The earlier promise.
  incumbent_grant_id UUID NOT NULL REFERENCES public.exclusivity_grants(id) ON DELETE CASCADE,
  -- The later signature.
  challenger_grant_id UUID NOT NULL REFERENCES public.exclusivity_grants(id) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('BLOCK', 'OFFER_REQUIRED')),
  -- Higher is more serious: the incumbent's strength weighted by the breadth of
  -- what it covers.
  severity INTEGER NOT NULL CHECK (severity > 0),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- An undispositioned conflict is outstanding, not resolved.
  disposition TEXT NOT NULL DEFAULT 'OUTSTANDING' CHECK (
    disposition IN ('OUTSTANDING', 'WAIVED_BY_INCUMBENT', 'RELEASED', 'BREACHED')
  ),
  dispositioned_at TIMESTAMPTZ,
  dispositioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  UNIQUE (incumbent_grant_id, challenger_grant_id),
  CHECK (incumbent_grant_id <> challenger_grant_id),
  CHECK ((disposition = 'OUTSTANDING') = (dispositioned_at IS NULL))
);

CREATE INDEX IF NOT EXISTS exclusivity_conflicts_outstanding_idx
  ON public.exclusivity_conflicts (severity DESC)
  WHERE disposition = 'OUTSTANDING';

-- A category cannot become its own ancestor. A cycle here would make the
-- downward-binding rule non-terminating, and the resolver would be walking it
-- at the moment somebody is waiting for an answer about a signature.
CREATE OR REPLACE FUNCTION public.reject_cyclic_sponsor_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cursor_id UUID := NEW.parent_category_id;
  hops INTEGER := 0;
BEGIN
  WHILE cursor_id IS NOT NULL AND hops < 64 LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'Sponsor category % cannot be its own ancestor', NEW.id;
    END IF;
    SELECT parent_category_id INTO cursor_id
    FROM public.sponsor_categories
    WHERE id = cursor_id;
    hops := hops + 1;
  END LOOP;

  IF hops >= 64 THEN
    RAISE EXCEPTION 'Sponsor category hierarchy above % is too deep or cyclic', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsor_categories_acyclic ON public.sponsor_categories;
CREATE TRIGGER sponsor_categories_acyclic
  BEFORE INSERT OR UPDATE ON public.sponsor_categories
  FOR EACH ROW EXECUTE FUNCTION public.reject_cyclic_sponsor_category();

ALTER TABLE public.campus_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusivity_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusivity_carve_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusivity_conflicts ENABLE ROW LEVEL SECURITY;

-- Venues, brands and the category tree are reference data. The commercial terms
-- are not: a committee about to sign needs the answer, not the other side's
-- contract.
CREATE POLICY campus_venues_public_read ON public.campus_venues FOR SELECT USING (TRUE);
CREATE POLICY sponsor_brands_public_read ON public.sponsor_brands FOR SELECT USING (TRUE);
CREATE POLICY sponsor_groups_public_read ON public.sponsor_groups FOR SELECT USING (TRUE);
CREATE POLICY sponsor_categories_public_read ON public.sponsor_categories FOR SELECT USING (TRUE);
