-- Issue #5163: Minibus Fleet Roadworthiness
--
-- What is stored here is the inspection history, the defects and the permits —
-- the facts availability is derived from — rather than an "is_roadworthy"
-- column. A stored flag is the thing that gets cleared by whoever wants the
-- vehicle, and it cannot express the case that matters most: a minibus grounded
-- for carrying passengers and not for the movement to the garage.
--
-- Inspection intervals are two columns because they are two intervals, and the
-- due point is whichever arrives first. Counting weeks misses the minibus that
-- did four away fixtures in a fortnight; counting kilometres misses the one
-- that sat in the car park all term.

CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  make_model TEXT NOT NULL,
  max_authorised_mass_kg INTEGER NOT NULL CHECK (max_authorised_mass_kg > 0),
  passenger_seats SMALLINT NOT NULL CHECK (passenger_seats >= 0),
  odometer_km INTEGER NOT NULL DEFAULT 0 CHECK (odometer_km >= 0),
  inspection_interval_weeks SMALLINT NOT NULL CHECK (inspection_interval_weeks > 0),
  inspection_interval_km INTEGER NOT NULL CHECK (inspection_interval_km > 0),
  disposed_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  performed_on TIMESTAMPTZ NOT NULL,
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  inspector TEXT NOT NULL,
  certificate_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicle_inspections_latest_idx
  ON public.vehicle_inspections (vehicle_id, performed_on DESC);

-- Severity is graded because grounding is graded. A cracked mirror housing, a
-- failed passenger door lock and a brake imbalance are three different answers
-- and only the middle one leaves the vehicle drivable to the garage.
CREATE TABLE IF NOT EXISTS public.vehicle_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (
    severity IN ('RECTIFY_AT_SERVICE', 'GROUND_FOR_PASSENGERS', 'GROUND_IMMEDIATELY')
  ),
  description TEXT NOT NULL,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reported_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rectified_by TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  -- A driver marking their own reported defect as fixed is a defect that is
  -- still there.
  CHECK (verified_by IS NULL OR verified_by <> reported_by),
  CHECK ((verified_by IS NULL) = (verified_at IS NULL)),
  CHECK (verified_at IS NULL OR rectified_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS vehicle_defects_open_idx
  ON public.vehicle_defects (vehicle_id, severity)
  WHERE verified_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('MOT', 'VEHICLE_TAX', 'INSURANCE', 'PERMIT', 'TACHOGRAPH_CALIBRATION')
  ),
  reference TEXT,
  expires_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, type, expires_on)
);

CREATE INDEX IF NOT EXISTS vehicle_documents_expiry_idx
  ON public.vehicle_documents (vehicle_id, expires_on);

-- The permit binds the journey rather than the vehicle: the same minibus is
-- lawful for the hockey team and unlawful for the group that hired it, so what
-- the permit permits is stored as conditions rather than as a class name alone.
CREATE TABLE IF NOT EXISTS public.transport_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  permit_class TEXT NOT NULL CHECK (permit_class IN ('SECTION_19', 'SECTION_22', 'PSV')),
  members_only BOOLEAN NOT NULL DEFAULT TRUE,
  separate_charge_permitted BOOLEAN NOT NULL DEFAULT FALSE,
  issued_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  CHECK (expires_on > issued_on),
  -- A public service vehicle licence is not restricted to members, and storing
  -- it as though it were would refuse journeys it plainly covers.
  CHECK (permit_class <> 'PSV' OR (NOT members_only AND separate_charge_permitted))
);

CREATE INDEX IF NOT EXISTS transport_permits_vehicle_idx
  ON public.transport_permits (vehicle_id, expires_on DESC);

CREATE TABLE IF NOT EXISTS public.fleet_drivers (
  driver_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  licence_acquired_on DATE NOT NULL,
  licence_number TEXT,
  holds_d1 BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked_on DATE,
  CHECK (licence_acquired_on > date_of_birth)
);

CREATE TABLE IF NOT EXISTS public.vehicle_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES public.fleet_drivers(driver_id) ON DELETE SET NULL,
  club_id UUID,
  purpose TEXT NOT NULL CHECK (purpose IN ('MEMBERS_NON_PROFIT', 'EXTERNAL_HIRE', 'REPAIR_MOVEMENT')),
  charge_basis TEXT NOT NULL CHECK (charge_basis IN ('NONE', 'COST_RECOVERY', 'PROFIT')),
  departs_at TIMESTAMPTZ NOT NULL,
  returns_at TIMESTAMPTZ NOT NULL,
  estimated_km INTEGER NOT NULL CHECK (estimated_km >= 0),
  carries_passengers BOOLEAN NOT NULL DEFAULT TRUE,
  abroad BOOLEAN NOT NULL DEFAULT FALSE,
  with_trailer BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (returns_at > departs_at),
  -- A movement to the garage that is carrying passengers is not a movement to
  -- the garage.
  CHECK (purpose <> 'REPAIR_MOVEMENT' OR NOT carries_passengers)
);

CREATE INDEX IF NOT EXISTS vehicle_bookings_upcoming_idx
  ON public.vehicle_bookings (vehicle_id, departs_at)
  WHERE cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vehicle_booking_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.vehicle_bookings(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL CHECK (
    kind IN (
      'INSPECTION_OVERDUE',
      'INSPECTION_DUE_MID_JOURNEY',
      'VEHICLE_GROUNDED',
      'PASSENGER_USE_PROHIBITED',
      'DOCUMENT_EXPIRED',
      'PERMIT_CLASS_INVALID',
      'DRIVER_NOT_ENTITLED'
    )
  ),
  detail TEXT NOT NULL,
  remedy TEXT NOT NULL,
  -- Set where a grounding cascade found somewhere else for the journey to go.
  reallocated_to_vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS vehicle_booking_blockers_booking_idx
  ON public.vehicle_booking_blockers (booking_id, assessed_at DESC);

-- Availability derived from the open defects, so nothing has to be kept in step
-- with anything. A grounded vehicle with a cleared flag is the failure this
-- view exists to make impossible.
CREATE OR REPLACE VIEW public.fleet_vehicle_availability AS
SELECT
  v.id AS vehicle_id,
  v.registration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.vehicle_defects d
      WHERE d.vehicle_id = v.id AND d.verified_at IS NULL AND d.severity = 'GROUND_IMMEDIATELY'
    ) THEN 'GROUNDED'
    WHEN EXISTS (
      SELECT 1 FROM public.vehicle_defects d
      WHERE d.vehicle_id = v.id AND d.verified_at IS NULL AND d.severity = 'GROUND_FOR_PASSENGERS'
    ) THEN 'PASSENGERS_PROHIBITED'
    ELSE 'AVAILABLE'
  END AS availability
FROM public.fleet_vehicles v
WHERE v.disposed_on IS NULL;

-- The next due point, in both units, from the last inspection recorded.
CREATE OR REPLACE FUNCTION public.vehicle_next_inspection(p_vehicle_id UUID)
RETURNS TABLE (due_on TIMESTAMPTZ, due_at_odometer_km INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    i.performed_on + make_interval(weeks => v.inspection_interval_weeks),
    i.odometer_km + v.inspection_interval_km
  FROM public.fleet_vehicles v
  JOIN public.vehicle_inspections i ON i.vehicle_id = v.id
  WHERE v.id = p_vehicle_id
  ORDER BY i.performed_on DESC
  LIMIT 1;
$$;

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_booking_blockers ENABLE ROW LEVEL SECURITY;

-- Anybody booking a vehicle needs to see which vehicles there are and whether
-- they are off the road; a defect is worth reporting by whoever spots it. A
-- driver's licence details are theirs.
CREATE POLICY fleet_vehicles_public_read ON public.fleet_vehicles FOR SELECT USING (TRUE);
CREATE POLICY vehicle_defects_public_read ON public.vehicle_defects FOR SELECT USING (TRUE);
CREATE POLICY vehicle_defects_report
  ON public.vehicle_defects FOR INSERT
  WITH CHECK (reported_by = auth.uid());
CREATE POLICY fleet_drivers_own_read
  ON public.fleet_drivers FOR SELECT
  USING (driver_id = auth.uid());
