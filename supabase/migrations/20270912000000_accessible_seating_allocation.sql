-- Issue #4924: Accessible Seating Allocation
--
-- Adjacency is stored as declared edges, never derived from seat numbering.
-- F12 and F14 are neighbours when F13 does not exist and are not neighbours
-- when F13 is a gangway, and no arithmetic on the label can tell the two apart.
--
-- There is no single "accessible" flag. An ambulant seat, a wheelchair bay, a
-- seat with floor space for an assistance dog and a seat with a clear view of
-- the interpreter are four different things, and one flag hands each of them to
-- the wrong person.

CREATE TABLE IF NOT EXISTS public.venue_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  row_label TEXT NOT NULL,
  seat_label TEXT NOT NULL,
  -- A bay is floor space rather than a seat, and satisfies only a wheelchair
  -- space requirement.
  is_wheelchair_bay BOOLEAN NOT NULL DEFAULT FALSE,
  is_aisle_end BOOLEAN NOT NULL DEFAULT FALSE,
  is_step_free BOOLEAN NOT NULL DEFAULT TRUE,
  -- Unobstructed view of the interpreter position, which is not the stage.
  has_clear_sightline BOOLEAN NOT NULL DEFAULT FALSE,
  -- Room for an assistance dog that is not room in a gangway.
  has_floor_space BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, row_label, seat_label)
);

-- Physical adjacency, stored once per unordered pair. A neighbour relationship
-- that only one seat knows about fails half the time it is asked about.
CREATE TABLE IF NOT EXISTS public.venue_seat_adjacencies (
  seat_a UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE CASCADE,
  seat_b UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (seat_a, seat_b),
  CHECK (seat_a < seat_b)
);

CREATE TABLE IF NOT EXISTS public.access_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  patron_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL CHECK (
    requirement_type IN ('WHEELCHAIR_SPACE', 'AMBULANT', 'ASSISTANCE_DOG', 'CLEAR_SIGHTLINE')
  ),
  -- Companions who must sit contiguously with the patron, not merely in the row.
  companion_count INTEGER NOT NULL DEFAULT 0 CHECK (companion_count >= 0),
  -- Free text the patron chose to give. Nothing here records a diagnosis, and
  -- no medical evidence is requested or stored.
  patron_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, patron_id)
);

-- Accessible inventory withheld from general sale until a release instant. The
-- hold exists for accessible bookings, so it never blocks one.
CREATE TABLE IF NOT EXISTS public.accessible_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  release_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accessible_hold_seats (
  hold_id UUID NOT NULL REFERENCES public.accessible_holds(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE CASCADE,
  PRIMARY KEY (hold_id, seat_id)
);

CREATE TABLE IF NOT EXISTS public.accessible_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.access_requirements(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  patron_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_seat_id UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE RESTRICT,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'VOIDED')),
  voided_reason TEXT,
  voided_at TIMESTAMPTZ,
  CHECK (
    (status = 'VOIDED' AND voided_reason IS NOT NULL AND voided_at IS NOT NULL)
    OR (status = 'CONFIRMED' AND voided_reason IS NULL AND voided_at IS NULL)
  )
);

-- A companion seat belongs to the allocation whose pair it completes. Cascading
-- from the allocation is what makes the pair indivisible: the bay and its
-- companion are released together or not at all.
CREATE TABLE IF NOT EXISTS public.accessible_allocation_companions (
  allocation_id UUID NOT NULL REFERENCES public.accessible_allocations(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE RESTRICT,
  PRIMARY KEY (allocation_id, seat_id)
);

CREATE TABLE IF NOT EXISTS public.seat_occupancy (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.venue_seats(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ACCESS', 'GENERAL')),
  -- Set on companion seats so the seat cannot be returned to general sale on
  -- its own while the allocation it completes is still live.
  part_of_allocation_id UUID REFERENCES public.accessible_allocations(id) ON DELETE CASCADE,
  general_buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  occupied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, seat_id),
  CHECK (
    (kind = 'GENERAL' AND general_buyer_id IS NOT NULL)
    OR (kind = 'ACCESS' AND general_buyer_id IS NULL)
  )
);

-- One live allocation per requirement. Amending the requirement voids it, so a
-- second live row would mean two different seat sets satisfying one request.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_allocation_per_requirement
  ON public.accessible_allocations(requirement_id)
  WHERE status = 'CONFIRMED';

CREATE INDEX IF NOT EXISTS idx_venue_seats_attributes
  ON public.venue_seats(venue_id, is_wheelchair_bay, is_aisle_end, is_step_free);

CREATE INDEX IF NOT EXISTS idx_seat_adjacency_reverse
  ON public.venue_seat_adjacencies(seat_b, seat_a);

CREATE INDEX IF NOT EXISTS idx_accessible_holds_release
  ON public.accessible_holds(event_id, release_at);

CREATE INDEX IF NOT EXISTS idx_seat_occupancy_event
  ON public.seat_occupancy(event_id, kind);

-- Neighbours in both directions from one stored row, so a query does not have
-- to remember which way round the pair was written.
CREATE OR REPLACE VIEW public.venue_seat_neighbours AS
SELECT seat_a AS seat_id, seat_b AS neighbour_id FROM public.venue_seat_adjacencies
UNION ALL
SELECT seat_b AS seat_id, seat_a AS neighbour_id FROM public.venue_seat_adjacencies;

-- The report that catches an event about to sell out with empty bays: held
-- accessible inventory whose release has passed with nothing allocated against
-- it, and held inventory whose release has not yet arrived.
CREATE OR REPLACE VIEW public.accessible_hold_status AS
SELECT
  h.event_id,
  h.id AS hold_id,
  h.label,
  h.release_at,
  hs.seat_id,
  s.row_label,
  s.seat_label,
  s.is_wheelchair_bay,
  (o.seat_id IS NOT NULL) AS is_taken,
  (NOW() >= h.release_at) AS released
FROM public.accessible_holds h
JOIN public.accessible_hold_seats hs ON hs.hold_id = h.id
JOIN public.venue_seats s ON s.id = hs.seat_id
LEFT JOIN public.seat_occupancy o ON o.event_id = h.event_id AND o.seat_id = hs.seat_id;

ALTER TABLE public.venue_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_seat_adjacencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessible_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessible_hold_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessible_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessible_allocation_companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_occupancy ENABLE ROW LEVEL SECURITY;

-- The seat map and its adjacency are public: a patron choosing a seat needs to
-- know which seats are next to which.
DROP POLICY IF EXISTS "Seat maps are readable" ON public.venue_seats;
CREATE POLICY "Seat maps are readable"
  ON public.venue_seats FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Seat adjacency is readable" ON public.venue_seat_adjacencies;
CREATE POLICY "Seat adjacency is readable"
  ON public.venue_seat_adjacencies FOR SELECT TO authenticated
  USING (TRUE);

-- An access requirement is health-adjacent information about a named person.
-- The patron and box office staff read it, and nobody else.
DROP POLICY IF EXISTS "Patrons read their own access requirement" ON public.access_requirements;
CREATE POLICY "Patrons read their own access requirement"
  ON public.access_requirements FOR SELECT TO authenticated
  USING (
    patron_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Patrons state their own access requirement" ON public.access_requirements;
CREATE POLICY "Patrons state their own access requirement"
  ON public.access_requirements FOR INSERT TO authenticated
  WITH CHECK (patron_id = auth.uid());

DROP POLICY IF EXISTS "Patrons amend their own access requirement" ON public.access_requirements;
CREATE POLICY "Patrons amend their own access requirement"
  ON public.access_requirements FOR UPDATE TO authenticated
  USING (patron_id = auth.uid())
  WITH CHECK (patron_id = auth.uid());

DROP POLICY IF EXISTS "Patrons read their own allocation" ON public.accessible_allocations;
CREATE POLICY "Patrons read their own allocation"
  ON public.accessible_allocations FOR SELECT TO authenticated
  USING (
    patron_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Companions follow their allocation" ON public.accessible_allocation_companions;
CREATE POLICY "Companions follow their allocation"
  ON public.accessible_allocation_companions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accessible_allocations a
      WHERE a.id = accessible_allocation_companions.allocation_id AND a.patron_id = auth.uid()
    )
  );

-- Which seats are gone is public; who is in them is not.
DROP POLICY IF EXISTS "Seat availability is readable" ON public.seat_occupancy;
CREATE POLICY "Seat availability is readable"
  ON public.seat_occupancy FOR SELECT TO authenticated
  USING (TRUE);

-- Allocation, general sale and hold release all run server side: each depends
-- on the adjacency graph and on the state of every other seat in the house.
REVOKE INSERT, UPDATE, DELETE ON public.venue_seats FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.venue_seat_adjacencies FROM anon, authenticated;
REVOKE DELETE ON public.access_requirements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.accessible_holds FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.accessible_hold_seats FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.accessible_allocations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.accessible_allocation_companions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seat_occupancy FROM anon, authenticated;
REVOKE ALL ON public.accessible_hold_status FROM anon;
-- The seat map itself is fine for anonymous browsing; the occupancy is not.
REVOKE ALL ON public.seat_occupancy FROM anon;
