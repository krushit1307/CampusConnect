-- Issue #5012: Allergen and Labelling Register
--
-- The regulated allergens are an enumerated set, not free text, and not the
-- same column as a dietary preference. "Vegetarian" is a choice the caterer
-- accommodates; sesame is a declaration attached to the food, true whether or
-- not anybody at the event has said anything.
--
-- Declared ingredients and precautionary cross-contamination advice are
-- separate tables with separate provenance — one comes from the recipe, one
-- from the room. Collapsing them produces both failures at once: a coeliac told
-- a naturally gluten-free item is unsafe, and a real wheat ingredient buried
-- under a "may contain" nobody reads.
--
-- A published recipe version is immutable. There is no UPDATE path to a
-- published version below; an amendment is a new row, and the labels printed
-- against the old one become invalid rather than merely old.

CREATE TYPE public.regulated_allergen AS ENUM (
  'CEREALS_CONTAINING_GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOYBEANS',
  'MILK',
  'NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHUR_DIOXIDE',
  'LUPIN',
  'MOLLUSCS'
);

CREATE TABLE IF NOT EXISTS public.food_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.food_recipes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  -- Null until published. A draft is not something a label may be printed
  -- against, and once this is set the row is frozen.
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amendment_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_id, version)
);

CREATE INDEX IF NOT EXISTS recipe_versions_published_idx
  ON public.recipe_versions (recipe_id, version DESC)
  WHERE published_at IS NOT NULL;

-- A component is either something bought in, with the allergens it declares, or
-- another recipe. The second is why resolution has to be transitive: the curry
-- contains a paste and the paste contains fish sauce.
CREATE TABLE IF NOT EXISTS public.recipe_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('INGREDIENT', 'COMPOSITE')),
  label TEXT NOT NULL,
  ingredient_ref TEXT,
  component_recipe_id UUID REFERENCES public.food_recipes(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (kind = 'INGREDIENT' AND ingredient_ref IS NOT NULL AND component_recipe_id IS NULL)
    OR (kind = 'COMPOSITE' AND component_recipe_id IS NOT NULL AND ingredient_ref IS NULL)
  )
);

-- A recipe containing itself directly. The transitive case is caught in the
-- resolver, which refuses rather than recursing; this catches the trivial one
-- at the point of insert, where a CHECK cannot reach because it would need a
-- subquery.
CREATE OR REPLACE FUNCTION public.reject_self_referential_component()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owning_recipe UUID;
BEGIN
  IF NEW.component_recipe_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT rv.recipe_id INTO owning_recipe
  FROM public.recipe_versions rv
  WHERE rv.id = NEW.recipe_version_id;

  IF owning_recipe = NEW.component_recipe_id THEN
    RAISE EXCEPTION 'Recipe % cannot be a component of itself', owning_recipe;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_components_no_self_reference ON public.recipe_components;
CREATE TRIGGER recipe_components_no_self_reference
  BEFORE INSERT OR UPDATE ON public.recipe_components
  FOR EACH ROW EXECUTE FUNCTION public.reject_self_referential_component();

CREATE INDEX IF NOT EXISTS recipe_components_version_idx
  ON public.recipe_components (recipe_version_id, position);
CREATE INDEX IF NOT EXISTS recipe_components_composite_idx
  ON public.recipe_components (component_recipe_id)
  WHERE component_recipe_id IS NOT NULL;

-- Allergens a component declares. From the recipe, and only from the recipe.
CREATE TABLE IF NOT EXISTS public.component_allergens (
  component_id UUID NOT NULL REFERENCES public.recipe_components(id) ON DELETE CASCADE,
  allergen public.regulated_allergen NOT NULL,
  PRIMARY KEY (component_id, allergen)
);

CREATE TABLE IF NOT EXISTS public.kitchen_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  location_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Present anywhere in the kitchen versus present on the equipment this batch
-- shares. Only the second defeats a free-from claim, which is the distinction
-- that lets a dedicated bench in a room full of flour still make one.
CREATE TABLE IF NOT EXISTS public.environment_allergens (
  environment_id UUID NOT NULL REFERENCES public.kitchen_environments(id) ON DELETE CASCADE,
  allergen public.regulated_allergen NOT NULL,
  on_shared_equipment BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (environment_id, allergen)
);

CREATE TABLE IF NOT EXISTS public.food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.food_recipes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  -- How the food reaches the person eating it. This, not what it is, decides
  -- which labelling requirement applies.
  sale_format TEXT NOT NULL CHECK (
    sale_format IN ('PREPACKED_FOR_DIRECT_SALE', 'PREPACKED_BY_THIRD_PARTY', 'MADE_TO_ORDER_LOOSE')
  ),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.issued_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  -- Bound to a version, not to a recipe. This is the column that makes a label
  -- go wrong loudly when the margarine is substituted.
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL REFERENCES public.kitchen_environments(id) ON DELETE RESTRICT,
  requirement TEXT NOT NULL CHECK (
    requirement IN (
      'FULL_INGREDIENT_LIST_WITH_EMPHASIS',
      'MANUFACTURER_LABEL_SUFFICIENT',
      'ALLERGEN_INFORMATION_ON_REQUEST'
    )
  ),
  state TEXT NOT NULL DEFAULT 'VALID' CHECK (state IN ('VALID', 'INVALIDATED_BY_AMENDMENT')),
  issued_at TIMESTAMPTZ NOT NULL,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invalidated_at TIMESTAMPTZ,
  invalidated_because TEXT,
  CHECK (
    (state = 'VALID' AND invalidated_at IS NULL)
    OR (state = 'INVALIDATED_BY_AMENDMENT' AND invalidated_at IS NOT NULL AND invalidated_because IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS issued_labels_valid_idx
  ON public.issued_labels (item_id) WHERE state = 'VALID';

-- Resolved from the recipe. Emphasised on the pack.
CREATE TABLE IF NOT EXISTS public.label_declared_allergens (
  label_id UUID NOT NULL REFERENCES public.issued_labels(id) ON DELETE CASCADE,
  allergen public.regulated_allergen NOT NULL,
  PRIMARY KEY (label_id, allergen)
);

-- Derived from the room. A separate table so it can never be read as the line
-- above by a query that forgot which column it was selecting.
CREATE TABLE IF NOT EXISTS public.label_precautionary_allergens (
  label_id UUID NOT NULL REFERENCES public.issued_labels(id) ON DELETE CASCADE,
  allergen public.regulated_allergen NOT NULL,
  PRIMARY KEY (label_id, allergen)
);

-- A stronger statement than an absent allergen: it describes the process too.
CREATE TABLE IF NOT EXISTS public.label_free_from_claims (
  label_id UUID NOT NULL REFERENCES public.issued_labels(id) ON DELETE CASCADE,
  allergen public.regulated_allergen NOT NULL,
  PRIMARY KEY (label_id, allergen)
);

-- A free-from claim may not coexist with the same allergen declared on the
-- label. The environment half of the rule needs the batch's equipment and is
-- enforced at issuance.
CREATE OR REPLACE FUNCTION public.reject_contradictory_free_from_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.label_declared_allergens d
    WHERE d.label_id = NEW.label_id AND d.allergen = NEW.allergen
  ) THEN
    RAISE EXCEPTION 'Cannot claim free from %: it is a declared ingredient on label %',
      NEW.allergen, NEW.label_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS label_free_from_claims_guard ON public.label_free_from_claims;
CREATE TRIGGER label_free_from_claims_guard
  BEFORE INSERT OR UPDATE ON public.label_free_from_claims
  FOR EACH ROW EXECUTE FUNCTION public.reject_contradictory_free_from_claim();

-- A published version is frozen. Editing one in place is exactly the failure
-- this table exists to prevent, so it is refused at the database.
CREATE OR REPLACE FUNCTION public.reject_published_version_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Recipe version % of recipe % is published and immutable; amend to a new version',
      OLD.version, OLD.recipe_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_versions_immutable ON public.recipe_versions;
CREATE TRIGGER recipe_versions_immutable
  BEFORE UPDATE ON public.recipe_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_published_version_edit();

ALTER TABLE public.food_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_declared_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_precautionary_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_free_from_claims ENABLE ROW LEVEL SECURITY;

-- Anyone about to eat something may read what is in it. This is the whole point
-- of the register, so the read policies are open and the writes are not.
CREATE POLICY food_items_public_read ON public.food_items FOR SELECT USING (TRUE);
CREATE POLICY issued_labels_public_read ON public.issued_labels FOR SELECT USING (TRUE);
CREATE POLICY label_declared_public_read ON public.label_declared_allergens FOR SELECT USING (TRUE);
CREATE POLICY label_precautionary_public_read ON public.label_precautionary_allergens FOR SELECT USING (TRUE);
CREATE POLICY label_free_from_public_read ON public.label_free_from_claims FOR SELECT USING (TRUE);
