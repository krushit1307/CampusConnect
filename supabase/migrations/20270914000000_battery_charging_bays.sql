-- Issue #4926: Battery Charging Bay Register
--
-- A bay has an energy capacity, not a socket count. Six sockets is not the
-- constraint; the total watt-hours on the bench is, and there is deliberately
-- nowhere here to record how many sockets a bay has.
--
-- Sessions store their projected finish, because that is what the supervision
-- rule is evaluated against. A charge that is fine to start after lunch is a
-- different proposition when it is still running at four in the morning.
--
-- Condition is a state on the pack rather than a note against a booking. A
-- quarantined pack is removed from chargeable inventory, not flagged inside it.

CREATE TABLE IF NOT EXISTS public.battery_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  owner_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  chemistry TEXT NOT NULL CHECK (chemistry IN ('LIPO', 'LI_ION', 'LIFEPO4')),
  -- Nominal capacity. The hazard is what is stored in it at the time, which is
  -- computed per session rather than stored here.
  capacity_wh NUMERIC(10, 2) NOT NULL CHECK (capacity_wh > 0),
  cell_count INTEGER NOT NULL CHECK (cell_count > 0),
  condition TEXT NOT NULL DEFAULT 'SERVICEABLE' CHECK (condition IN ('SERVICEABLE', 'QUARANTINED')),
  quarantine_reason TEXT CHECK (
    quarantine_reason IS NULL
    OR quarantine_reason IN ('SWELLING', 'IMPACT_DAMAGE', 'OVER_DISCHARGE', 'FAILED_POST_CHECK')
  ),
  quarantined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (condition = 'QUARANTINED' AND quarantine_reason IS NOT NULL AND quarantined_at IS NOT NULL)
    OR (condition = 'SERVICEABLE' AND quarantine_reason IS NULL AND quarantined_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.charging_bays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  location_note TEXT,
  -- Effective watt-hours the bench may hold at once.
  energy_capacity_wh NUMERIC(10, 2) NOT NULL CHECK (energy_capacity_wh > 0),
  -- Higher is better ventilated. Each chemistry demands a minimum.
  ventilation_class INTEGER NOT NULL CHECK (ventilation_class >= 0),
  -- Minutes past midnight UTC. Outside this the bench is empty of people.
  supervised_from_minute INTEGER NOT NULL CHECK (supervised_from_minute >= 0),
  supervised_to_minute INTEGER NOT NULL CHECK (supervised_to_minute <= 1440),
  -- Whether a charge may still be running when nobody is there.
  overnight_capable BOOLEAN NOT NULL DEFAULT FALSE,
  -- Whether this is the segregated store a quarantined pack goes to.
  segregated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (supervised_to_minute > supervised_from_minute)
);

-- Declared hazards sharing a bay's space: a solvent store, a fire exit route.
-- Each is fine on its own, which is why the register is the only place that can
-- see them together.
CREATE TABLE IF NOT EXISTS public.charging_bay_hazards (
  bay_id UUID NOT NULL REFERENCES public.charging_bays(id) ON DELETE CASCADE,
  hazard TEXT NOT NULL,
  PRIMARY KEY (bay_id, hazard)
);

CREATE TABLE IF NOT EXISTS public.prohibited_charging_hazards (
  hazard TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.charging_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.battery_packs(id) ON DELETE CASCADE,
  bay_id UUID NOT NULL REFERENCES public.charging_bays(id) ON DELETE RESTRICT,
  booked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  charger_watts NUMERIC(8, 2) NOT NULL CHECK (charger_watts > 0),
  start_state_of_charge NUMERIC(4, 3) NOT NULL CHECK (start_state_of_charge >= 0),
  target_state_of_charge NUMERIC(4, 3) NOT NULL CHECK (target_state_of_charge <= 1),
  start_at TIMESTAMPTZ NOT NULL,
  -- Computed from the pack, its state of charge and the charger. The
  -- supervision rule is evaluated against this, not against start_at.
  projected_finish_at TIMESTAMPTZ NOT NULL,
  -- Effective watt-hours held against the bay for the session window, after the
  -- chemistry's hazard factor.
  reserved_wh NUMERIC(10, 2) NOT NULL CHECK (reserved_wh > 0),
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'COMPLETED', 'VOIDED')),
  voided_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (target_state_of_charge > start_state_of_charge),
  CHECK (projected_finish_at > start_at),
  CHECK ((status = 'VOIDED') = (voided_reason IS NOT NULL))
);

-- One live session per pack. A pack on two chargers is a data error, not a
-- scheduling choice.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_session_per_pack
  ON public.charging_sessions(pack_id)
  WHERE status = 'BOOKED';

CREATE TABLE IF NOT EXISTS public.pack_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.battery_packs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('SWELLING', 'IMPACT_DAMAGE', 'OVER_DISCHARGE', 'FAILED_POST_CHECK')
  ),
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT NOT NULL DEFAULT ''
);

-- Where a quarantined pack physically is. Only a segregated bay is allowed,
-- however much spare capacity a shared bench has.
CREATE TABLE IF NOT EXISTS public.pack_quarantine_locations (
  pack_id UUID PRIMARY KEY REFERENCES public.battery_packs(id) ON DELETE CASCADE,
  bay_id UUID NOT NULL REFERENCES public.charging_bays(id) ON DELETE RESTRICT,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Returning a pack to service is a named decision by a named person, so it is
-- recorded rather than inferred from the condition column flipping back.
CREATE TABLE IF NOT EXISTS public.pack_quarantine_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.battery_packs(id) ON DELETE CASCADE,
  released_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.battery_competent_reviewers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charging_sessions_bay_window
  ON public.charging_sessions(bay_id, start_at, projected_finish_at)
  WHERE status = 'BOOKED';

CREATE INDEX IF NOT EXISTS idx_pack_incidents_pack
  ON public.pack_incidents(pack_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_battery_packs_condition
  ON public.battery_packs(condition, chemistry);

-- Sessions that will still be running when nobody is on the bench, in a bay
-- that is not rated for it. This is the report that catches the overnight
-- charge nobody projected the finish time for.
CREATE OR REPLACE VIEW public.charging_sessions_unattended AS
SELECT
  s.id AS session_id,
  s.pack_id,
  p.label AS pack_label,
  p.chemistry,
  b.id AS bay_id,
  b.label AS bay_label,
  s.start_at,
  s.projected_finish_at,
  s.reserved_wh
FROM public.charging_sessions s
JOIN public.battery_packs p ON p.id = s.pack_id
JOIN public.charging_bays b ON b.id = s.bay_id
WHERE s.status = 'BOOKED'
  AND b.overnight_capable = FALSE
  AND (
    (EXTRACT(HOUR FROM s.projected_finish_at AT TIME ZONE 'UTC') * 60
      + EXTRACT(MINUTE FROM s.projected_finish_at AT TIME ZONE 'UTC')) < b.supervised_from_minute
    OR (EXTRACT(HOUR FROM s.projected_finish_at AT TIME ZONE 'UTC') * 60
      + EXTRACT(MINUTE FROM s.projected_finish_at AT TIME ZONE 'UTC')) >= b.supervised_to_minute
  );

-- What each bay is currently holding against what it is rated for.
CREATE OR REPLACE VIEW public.charging_bay_load AS
SELECT
  b.id AS bay_id,
  b.label,
  b.energy_capacity_wh,
  COALESCE(SUM(s.reserved_wh) FILTER (WHERE s.status = 'BOOKED'), 0) AS reserved_wh,
  b.energy_capacity_wh
    - COALESCE(SUM(s.reserved_wh) FILTER (WHERE s.status = 'BOOKED'), 0) AS headroom_wh
FROM public.charging_bays b
LEFT JOIN public.charging_sessions s ON s.bay_id = b.id
GROUP BY b.id, b.label, b.energy_capacity_wh;

ALTER TABLE public.battery_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_bays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_bay_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prohibited_charging_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_quarantine_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_quarantine_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battery_competent_reviewers ENABLE ROW LEVEL SECURITY;

-- Bays, their ratings and their hazards are reference data. Anybody about to
-- plug something in needs to know what the bench is rated for.
DROP POLICY IF EXISTS "Bays are readable" ON public.charging_bays;
CREATE POLICY "Bays are readable"
  ON public.charging_bays FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Bay hazards are readable" ON public.charging_bay_hazards;
CREATE POLICY "Bay hazards are readable"
  ON public.charging_bay_hazards FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Prohibited hazards are readable" ON public.prohibited_charging_hazards;
CREATE POLICY "Prohibited hazards are readable"
  ON public.prohibited_charging_hazards FOR SELECT TO authenticated
  USING (TRUE);

-- A quarantined pack is everybody's problem, so its condition is visible to
-- everybody sharing the space even though the pack belongs to one society.
DROP POLICY IF EXISTS "Pack condition is readable" ON public.battery_packs;
CREATE POLICY "Pack condition is readable"
  ON public.battery_packs FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Sessions are readable" ON public.charging_sessions;
CREATE POLICY "Sessions are readable"
  ON public.charging_sessions FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Incidents are readable" ON public.pack_incidents;
CREATE POLICY "Incidents are readable"
  ON public.pack_incidents FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Quarantine locations are readable" ON public.pack_quarantine_locations;
CREATE POLICY "Quarantine locations are readable"
  ON public.pack_quarantine_locations FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Releases are readable" ON public.pack_quarantine_releases;
CREATE POLICY "Releases are readable"
  ON public.pack_quarantine_releases FOR SELECT TO authenticated
  USING (TRUE);

-- Anybody may report damage to a pack, including a pack that is not theirs.
-- Somebody who spots a swollen cell on a shared bench should not have to find
-- its owner first.
DROP POLICY IF EXISTS "Anybody may report an incident" ON public.pack_incidents;
CREATE POLICY "Anybody may report an incident"
  ON public.pack_incidents FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

-- Booking, quarantine and release all run server side: each depends on the
-- state of every other session in the bay and on the pack's condition.
REVOKE INSERT, UPDATE, DELETE ON public.battery_packs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.charging_bays FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.charging_bay_hazards FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.prohibited_charging_hazards FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.charging_sessions FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.pack_incidents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pack_quarantine_locations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pack_quarantine_releases FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.battery_competent_reviewers FROM anon, authenticated;
REVOKE ALL ON public.charging_sessions_unattended FROM anon;
REVOKE ALL ON public.charging_bay_load FROM anon;
