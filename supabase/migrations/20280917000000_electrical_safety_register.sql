-- Issue #5259: Electrical safety inspection register for loaned and hired-in equipment
--
-- Separate from the usage-hour maintenance schedule in #4555. That answers a
-- reliability question — is a lamp near the end of its life. This answers a
-- safety one, on a different interval, with a different consequence: an item
-- that fails may not be issued at all whatever its usage meter says.
--
-- There is no is_safe or available column. Issuability is derived from the
-- inspections and the open faults, because a status column is the thing that
-- gets cleared by whoever wants the equipment on a busy Friday.
--
-- The interval lives in a lookup keyed on class and environment rather than in
-- a column on the item, because it is a property of the pair. The same 240V
-- lead is on three months going out to a field and two years under a desk, and
-- one interval column cannot say both.

CREATE TABLE IF NOT EXISTS public.electrical_inspection_intervals (
  equipment_class TEXT NOT NULL CHECK (equipment_class IN ('CLASS_I', 'CLASS_II', 'CLASS_III')),
  use_environment TEXT NOT NULL CHECK (
    use_environment IN (
      'OFFICE_STATIONARY', 'INDOOR_PORTABLE', 'OUTDOOR', 'CONSTRUCTION_OR_TEMPORARY'
    )
  ),
  visual_months SMALLINT NOT NULL CHECK (visual_months > 0),
  -- Null where the class needs no electrical test. Class II has no protective
  -- earth to prove and Class III runs below the voltage that makes it matter.
  combined_months SMALLINT CHECK (combined_months IS NULL OR combined_months > 0),
  PRIMARY KEY (equipment_class, use_environment),
  CHECK (combined_months IS NULL OR combined_months >= visual_months)
);

INSERT INTO public.electrical_inspection_intervals
  (equipment_class, use_environment, visual_months, combined_months)
VALUES
  ('CLASS_I',   'OFFICE_STATIONARY',         24, 48),
  ('CLASS_II',  'OFFICE_STATIONARY',         24, NULL),
  ('CLASS_III', 'OFFICE_STATIONARY',         48, NULL),
  ('CLASS_I',   'INDOOR_PORTABLE',           12, 24),
  ('CLASS_II',  'INDOOR_PORTABLE',           24, NULL),
  ('CLASS_III', 'INDOOR_PORTABLE',           24, NULL),
  ('CLASS_I',   'OUTDOOR',                    3, 12),
  ('CLASS_II',  'OUTDOOR',                    3, 12),
  ('CLASS_III', 'OUTDOOR',                   12, NULL),
  ('CLASS_I',   'CONSTRUCTION_OR_TEMPORARY',  1,  3),
  ('CLASS_II',  'CONSTRUCTION_OR_TEMPORARY',  1,  3),
  ('CLASS_III', 'CONSTRUCTION_OR_TEMPORARY', 12, NULL)
ON CONFLICT (equipment_class, use_environment) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.electrical_equipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT UNIQUE,
  description TEXT NOT NULL,
  equipment_class TEXT NOT NULL CHECK (equipment_class IN ('CLASS_I', 'CLASS_II', 'CLASS_III')),
  use_environment TEXT NOT NULL CHECK (
    use_environment IN (
      'OFFICE_STATIONARY', 'INDOOR_PORTABLE', 'OUTDOOR', 'CONSTRUCTION_OR_TEMPORARY'
    )
  ),
  ownership TEXT NOT NULL CHECK (ownership IN ('OWNED', 'HIRED_IN', 'MEMBER_OWNED')),
  -- The supplier or the member. Anything not owned by the pool has to say whose
  -- it is, because the register's job for those items is knowing they exist.
  owner_reference TEXT,
  retired_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (equipment_class, use_environment)
    REFERENCES public.electrical_inspection_intervals (equipment_class, use_environment),
  CHECK (ownership = 'OWNED' OR owner_reference IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS electrical_equipment_items_live_idx
  ON public.electrical_equipment_items (use_environment, equipment_class)
  WHERE retired_on IS NULL;

CREATE INDEX IF NOT EXISTS electrical_equipment_items_transient_idx
  ON public.electrical_equipment_items (ownership)
  WHERE ownership <> 'OWNED' AND retired_on IS NULL;

CREATE TABLE IF NOT EXISTS public.electrical_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.electrical_equipment_items(id) ON DELETE CASCADE,
  -- A combined inspection and test includes the visual one and satisfies both
  -- clocks; treating them as independent demands a visual the week after a
  -- full test.
  type TEXT NOT NULL CHECK (type IN ('VISUAL', 'COMBINED_INSPECTION_AND_TEST')),
  performed_on DATE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('PASS', 'FAIL')),
  tested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  competency_reference TEXT NOT NULL,
  -- Recorded readings, kept because a pass with no readings is an assertion
  -- rather than a test.
  earth_continuity_ohms NUMERIC(6, 3),
  insulation_resistance_megaohms NUMERIC(8, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS electrical_inspections_latest_idx
  ON public.electrical_inspections (item_id, performed_on DESC);

CREATE TABLE IF NOT EXISTS public.electrical_faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.electrical_equipment_items(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reported_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A fault closes on an inspection, not on an edit, and the inspection carries
  -- who signed it.
  cleared_by_inspection_id UUID REFERENCES public.electrical_inspections(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS electrical_faults_open_idx
  ON public.electrical_faults (item_id)
  WHERE cleared_by_inspection_id IS NULL;

-- The person who reported a fault cannot be the one who signs it off. Enforced
-- here rather than in the service alone, because this is the rule most likely
-- to be worked around under time pressure.
CREATE OR REPLACE FUNCTION public.electrical_fault_signoff_is_independent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tester UUID;
  v_outcome TEXT;
BEGIN
  IF NEW.cleared_by_inspection_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tested_by, outcome
    INTO v_tester, v_outcome
    FROM public.electrical_inspections
   WHERE id = NEW.cleared_by_inspection_id;

  IF v_tester = NEW.reported_by THEN
    RAISE EXCEPTION
      'The person who reported fault % cannot be the one who signs it off', NEW.id;
  END IF;

  IF v_outcome <> 'PASS' THEN
    RAISE EXCEPTION
      'A failed inspection does not close fault %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS electrical_fault_signoff_trigger ON public.electrical_faults;
CREATE TRIGGER electrical_fault_signoff_trigger
  BEFORE INSERT OR UPDATE OF cleared_by_inspection_id ON public.electrical_faults
  FOR EACH ROW
  EXECUTE FUNCTION public.electrical_fault_signoff_is_independent();

-- Protection is a property of the supply, not of the item. An otherwise sound
-- item is unsafe on an unprotected supply outdoors and fine on the next one.
CREATE TABLE IF NOT EXISTS public.electrical_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  rcd_protected BOOLEAN NOT NULL DEFAULT FALSE,
  -- Protection that has never been proved is protection nobody should rely on,
  -- so this is nullable and its absence is a blocker rather than a default.
  last_protection_test_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (last_protection_test_on IS NULL OR rcd_protected)
);

CREATE TABLE IF NOT EXISTS public.electrical_equipment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL,
  supply_id UUID NOT NULL REFERENCES public.electrical_supplies(id) ON DELETE RESTRICT,
  -- The environment of this booking, which may differ from an item's usual one.
  environment TEXT NOT NULL CHECK (
    environment IN (
      'OFFICE_STATIONARY', 'INDOOR_PORTABLE', 'OUTDOOR', 'CONSTRUCTION_OR_TEMPORARY'
    )
  ),
  starts_on TIMESTAMPTZ NOT NULL,
  ends_on TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE TABLE IF NOT EXISTS public.electrical_booking_items (
  booking_id UUID NOT NULL
    REFERENCES public.electrical_equipment_bookings(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.electrical_equipment_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (booking_id, item_id)
);

-- Issuability, derived. Deliberately a view rather than a column: a column is
-- what gets set to 'available' by whoever needs the projector this evening.
CREATE OR REPLACE VIEW public.electrical_item_issuability AS
SELECT
  i.id AS item_id,
  i.description,
  i.equipment_class,
  i.use_environment,
  i.ownership,
  latest.performed_on AS last_inspected_on,
  latest.outcome AS last_outcome,
  (latest.performed_on + MAKE_INTERVAL(months => iv.visual_months)) AS visual_due_on,
  CASE
    WHEN iv.combined_months IS NULL THEN NULL
    ELSE combined.performed_on + MAKE_INTERVAL(months => iv.combined_months)
  END AS combined_due_on,
  CASE
    WHEN i.retired_on IS NOT NULL AND i.retired_on <= CURRENT_DATE THEN 'RETIRED'
    WHEN EXISTS (
      SELECT 1 FROM public.electrical_faults f
       WHERE f.item_id = i.id AND f.cleared_by_inspection_id IS NULL
    ) THEN 'QUARANTINED'
    WHEN latest.outcome = 'FAIL' THEN 'QUARANTINED'
    WHEN latest.performed_on IS NULL THEN 'NEVER_INSPECTED'
    WHEN iv.combined_months IS NOT NULL AND combined.performed_on IS NULL THEN 'NEVER_INSPECTED'
    WHEN latest.performed_on + MAKE_INTERVAL(months => iv.visual_months) <= CURRENT_DATE
      THEN 'INSPECTION_LAPSED'
    WHEN iv.combined_months IS NOT NULL
      AND combined.performed_on + MAKE_INTERVAL(months => iv.combined_months) <= CURRENT_DATE
      THEN 'INSPECTION_LAPSED'
    ELSE 'ISSUABLE'
  END AS issuability
FROM public.electrical_equipment_items i
JOIN public.electrical_inspection_intervals iv
  ON iv.equipment_class = i.equipment_class
 AND iv.use_environment = i.use_environment
LEFT JOIN LATERAL (
  SELECT performed_on, outcome
    FROM public.electrical_inspections e
   WHERE e.item_id = i.id
   ORDER BY e.performed_on DESC
   LIMIT 1
) latest ON TRUE
LEFT JOIN LATERAL (
  SELECT performed_on
    FROM public.electrical_inspections e
   WHERE e.item_id = i.id
     AND e.type = 'COMBINED_INSPECTION_AND_TEST'
   ORDER BY e.performed_on DESC
   LIMIT 1
) combined ON TRUE;

COMMENT ON TABLE public.electrical_inspection_intervals IS
  'Interval keyed on class and environment. The same lead is on three months outdoors and two years under a desk.';
COMMENT ON VIEW public.electrical_item_issuability IS
  'Derived, not stored. A settable availability column is the one that gets cleared by whoever wants the equipment.';
COMMENT ON COLUMN public.electrical_supplies.last_protection_test_on IS
  'Null means never proved, which blocks rather than defaults to protected.';
