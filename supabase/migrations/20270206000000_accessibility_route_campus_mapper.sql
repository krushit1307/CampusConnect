-- Issue #3700: Dynamic Accessibility Route Campus Mapper
-- Creates accessible_pathways table with GeoJSON polyline arrays,
-- transit stops, venue entrances, routes, facilities, obstacles,
-- turn-by-turn directions, community reports, and RPC functions.

-- ─── Enum Types ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE pathway_surface AS ENUM (
    'paved', 'concrete', 'tile', 'gravel', 'grass', 'carpet'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE obstacle_type AS ENUM (
    'stairs', 'curb', 'narrow', 'steep-grade',
    'construction', 'door-threshold', 'none'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE facility_type AS ENUM (
    'ramp', 'elevator', 'automatic-door',
    'tactile-paving', 'rest-area', 'accessible-restroom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE route_difficulty AS ENUM ('easy', 'moderate', 'challenging');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'pending', 'verified', 'disputed', 'resolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transit_stop_type AS ENUM (
    'bus-stop', 'shuttle-stop', 'parking', 'building-entrance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE obstacle_severity AS ENUM (
    'minor', 'moderate', 'severe', 'blocking'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM (
    'obstacle', 'facility-issue', 'route-blocked',
    'new-route', 'rating', 'update'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Transit Stops ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transit_stops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        transit_stop_type NOT NULL DEFAULT 'bus-stop',
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accessible  BOOLEAN NOT NULL DEFAULT true,
  has_shelter BOOLEAN NOT NULL DEFAULT false,
  nearest_parking_accessible BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transit_stops_position
  ON public.transit_stops (latitude, longitude);

ALTER TABLE public.transit_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transit stops are publicly readable"
  ON public.transit_stops FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert transit stops"
  ON public.transit_stops FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update transit stops"
  ON public.transit_stops FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Venue Entrances ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_entrances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              UUID NOT NULL,
  venue_name            TEXT NOT NULL,
  entrance_name         TEXT NOT NULL,
  latitude              DOUBLE PRECISION NOT NULL,
  longitude             DOUBLE PRECISION NOT NULL,
  has_automatic_door    BOOLEAN NOT NULL DEFAULT false,
  has_ramp              BOOLEAN NOT NULL DEFAULT false,
  door_width_cm         DOUBLE PRECISION,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_entrances_venue
  ON public.venue_entrances (venue_id);

CREATE INDEX idx_venue_entrances_position
  ON public.venue_entrances (latitude, longitude);

ALTER TABLE public.venue_entrances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue entrances are publicly readable"
  ON public.venue_entrances FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage venue entrances"
  ON public.venue_entrances FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── Accessible Pathways ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accessible_pathways (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  -- GeoJSON LineString stored as JSONB for broad Postgres compatibility
  geometry          JSONB NOT NULL,
  -- geometry format: { "type": "LineString", "coordinates": [[lng, lat], ...] }
  surface           pathway_surface NOT NULL DEFAULT 'paved',
  width_meters      DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  has_ramp          BOOLEAN NOT NULL DEFAULT false,
  has_tactile_paving BOOLEAN NOT NULL DEFAULT false,
  has_handrails     BOOLEAN NOT NULL DEFAULT false,
  grade_percentage  DOUBLE PRECISION NOT NULL DEFAULT 0,
  verified_by       UUID,
  verified_at       TIMESTAMPTZ,
  last_inspected    TIMESTAMPTZ,
  crowdsource_updated BOOLEAN NOT NULL DEFAULT false,
  average_rating    DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_ratings     INTEGER NOT NULL DEFAULT 0,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure geometry has correct structure
  CONSTRAINT chk_pathway_geometry_structure
    CHECK (geometry ? 'type' AND geometry ? 'coordinates')
);

CREATE INDEX idx_accessible_pathways_geometry
  ON public.accessible_pathways USING gin (geometry);

ALTER TABLE public.accessible_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pathways are publicly readable"
  ON public.accessible_pathways FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert pathways"
  ON public.accessible_pathways FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pathways"
  ON public.accessible_pathways FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Pathway Facilities ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pathway_facilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id    UUID NOT NULL REFERENCES public.accessible_pathways(id) ON DELETE CASCADE,
  type          facility_type NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  operational   BOOLEAN NOT NULL DEFAULT true,
  last_checked  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pathway_facilities_pathway
  ON public.pathway_facilities (pathway_id);

ALTER TABLE public.pathway_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pathway facilities are publicly readable"
  ON public.pathway_facilities FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage pathway facilities"
  ON public.pathway_facilities FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── Pathway Obstacles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pathway_obstacles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id    UUID NOT NULL REFERENCES public.accessible_pathways(id) ON DELETE CASCADE,
  type          obstacle_type NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  description   TEXT NOT NULL,
  workaround    TEXT,
  severity      obstacle_severity NOT NULL DEFAULT 'moderate',
  reported_by   UUID,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pathway_obstacles_pathway
  ON public.pathway_obstacles (pathway_id);

ALTER TABLE public.pathway_obstacles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pathway obstacles are publicly readable"
  ON public.pathway_obstacles FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert pathway obstacles"
  ON public.pathway_obstacles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pathway obstacles"
  ON public.pathway_obstacles FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Accessible Routes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accessible_routes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  description             TEXT,
  transit_stop_id         UUID NOT NULL REFERENCES public.transit_stops(id),
  venue_entrance_id       UUID NOT NULL REFERENCES public.venue_entrances(id),
  total_distance_meters   DOUBLE PRECISION NOT NULL DEFAULT 0,
  estimated_time_minutes  DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty              route_difficulty NOT NULL DEFAULT 'moderate',
  wheelchair_friendly     BOOLEAN NOT NULL DEFAULT true,
  visually_friendly       BOOLEAN NOT NULL DEFAULT false,
  mobility_aid_compatible BOOLEAN NOT NULL DEFAULT true,
  overall_rating          DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_ratings           INTEGER NOT NULL DEFAULT 0,
  verified                BOOLEAN NOT NULL DEFAULT false,
  last_updated            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_issues         INTEGER NOT NULL DEFAULT 0,
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accessible_routes_transit
  ON public.accessible_routes (transit_stop_id);

CREATE INDEX idx_accessible_routes_entrance
  ON public.accessible_routes (venue_entrance_id);

ALTER TABLE public.accessible_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accessible routes are publicly readable"
  ON public.accessible_routes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert routes"
  ON public.accessible_routes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update routes"
  ON public.accessible_routes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Route ↔ Pathway Junction ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.route_pathways (
  route_id    UUID NOT NULL REFERENCES public.accessible_routes(id) ON DELETE CASCADE,
  pathway_id  UUID NOT NULL REFERENCES public.accessible_pathways(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, pathway_id)
);

ALTER TABLE public.route_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route pathways are publicly readable"
  ON public.route_pathways FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage route-pathway links"
  ON public.route_pathways FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── Route Turns ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accessible_route_turns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id          UUID NOT NULL REFERENCES public.accessible_routes(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  instruction       TEXT NOT NULL,
  distance_meters   DOUBLE PRECISION NOT NULL DEFAULT 0,
  pathway_id        UUID REFERENCES public.accessible_pathways(id),
  latitude          DOUBLE PRECISION NOT NULL,
  longitude         DOUBLE PRECISION NOT NULL,
  landmark          TEXT,
  caution           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_route_turns_route
  ON public.accessible_route_turns (route_id, sort_order);

ALTER TABLE public.accessible_route_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route turns are publicly readable"
  ON public.accessible_route_turns FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage route turns"
  ON public.accessible_route_turns FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── Accessibility Route Reports (crowdsource) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.accessibility_route_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID,
  reporter_name   TEXT NOT NULL,
  reporter_role   TEXT,
  pathway_id      UUID REFERENCES public.accessible_pathways(id) ON DELETE SET NULL,
  route_id        UUID REFERENCES public.accessible_routes(id) ON DELETE SET NULL,
  type            report_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  images          TEXT[] DEFAULT '{}',
  severity        obstacle_severity NOT NULL DEFAULT 'moderate',
  status          report_status NOT NULL DEFAULT 'pending',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  helpful_votes   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_route_reports_status
  ON public.accessibility_route_reports (status);

CREATE INDEX idx_route_reports_pathway
  ON public.accessibility_route_reports (pathway_id);

CREATE INDEX idx_route_reports_route
  ON public.accessibility_route_reports (route_id);

ALTER TABLE public.accessibility_route_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports are publicly readable"
  ON public.accessibility_route_reports FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reports"
  ON public.accessibility_route_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reports"
  ON public.accessibility_route_reports FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Route Ratings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accessibility_route_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    UUID NOT NULL REFERENCES public.accessible_routes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, user_id)
);

ALTER TABLE public.accessibility_route_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are publicly readable"
  ON public.accessibility_route_ratings FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert ratings"
  ON public.accessibility_route_ratings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Users can update own ratings"
  ON public.accessibility_route_ratings FOR UPDATE
  USING (user_id = auth.uid());

-- ─── RPC: Find nearest transit stop to a venue entrance ─────────────────

CREATE OR REPLACE FUNCTION public.find_nearest_transit_stops(
  p_latitude  DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_limit     INTEGER DEFAULT 5
)
RETURNS TABLE (
  stop_id       UUID,
  stop_name     TEXT,
  stop_type     transit_stop_type,
  stop_lat      DOUBLE PRECISION,
  stop_lng      DOUBLE PRECISION,
  accessible    BOOLEAN,
  has_shelter   BOOLEAN,
  distance_m    DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ts.id,
    ts.name,
    ts.type,
    ts.latitude,
    ts.longitude,
    ts.accessible,
    ts.has_shelter,
    -- Haversine distance in metres
    6371000 * 2 * asin(sqrt(
      power(sin(radians(ts.latitude - p_latitude) / 2), 2)
      + cos(radians(p_latitude))
        * cos(radians(ts.latitude))
        * power(sin(radians(ts.longitude - p_longitude) / 2), 2)
    )) AS distance_m
  FROM public.transit_stops ts
  ORDER BY distance_m
  LIMIT p_limit;
$$;

-- ─── RPC: Get routes for a venue entrance ───────────────────────────────

CREATE OR REPLACE FUNCTION public.get_accessible_routes_for_entrance(
  p_venue_entrance_id UUID
)
RETURNS TABLE (
  route_id            UUID,
  route_name          TEXT,
  route_description   TEXT,
  transit_stop_name   TEXT,
  transit_stop_lat    DOUBLE PRECISION,
  transit_stop_lng    DOUBLE PRECISION,
  venue_entrance_lat  DOUBLE PRECISION,
  venue_entrance_lng  DOUBLE PRECISION,
  total_distance_m    DOUBLE PRECISION,
  estimated_time_min  DOUBLE PRECISION,
  difficulty          route_difficulty,
  wheelchair_friendly BOOLEAN,
  visually_friendly   BOOLEAN,
  overall_rating      DOUBLE PRECISION,
  total_ratings       INTEGER,
  verified            BOOLEAN,
  reported_issues     INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ar.id,
    ar.name,
    ar.description,
    ts.name,
    ts.latitude,
    ts.longitude,
    ve.latitude,
    ve.longitude,
    ar.total_distance_meters,
    ar.estimated_time_minutes,
    ar.difficulty,
    ar.wheelchair_friendly,
    ar.visually_friendly,
    ar.overall_rating,
    ar.total_ratings,
    ar.verified,
    ar.reported_issues
  FROM public.accessible_routes ar
  JOIN public.transit_stops ts ON ts.id = ar.transit_stop_id
  JOIN public.venue_entrances ve ON ve.id = ar.venue_entrance_id
  WHERE ar.venue_entrance_id = p_venue_entrance_id
  ORDER BY ar.overall_rating DESC, ar.total_distance_meters ASC;
$$;

-- ─── RPC: Get pathway geometry for a route ──────────────────────────────

CREATE OR REPLACE FUNCTION public.get_route_pathways(p_route_id UUID)
RETURNS TABLE (
  pathway_id    UUID,
  pathway_name  TEXT,
  geometry      JSONB,
  surface       pathway_surface,
  width_meters  DOUBLE PRECISION,
  has_ramp      BOOLEAN,
  has_tactile_paving BOOLEAN,
  has_handrails BOOLEAN,
  grade_pct     DOUBLE PRECISION,
  avg_rating    DOUBLE PRECISION,
  total_ratings INTEGER,
  sort_order    INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ap.id,
    ap.name,
    ap.geometry,
    ap.surface,
    ap.width_meters,
    ap.has_ramp,
    ap.has_tactile_paving,
    ap.has_handrails,
    ap.grade_percentage,
    ap.average_rating,
    ap.total_ratings,
    rp.sort_order
  FROM public.route_pathways rp
  JOIN public.accessible_pathways ap ON ap.id = rp.pathway_id
  WHERE rp.route_id = p_route_id
  ORDER BY rp.sort_order;
$$;

-- ─── RPC: Get facilities and obstacles for a pathway ────────────────────

CREATE OR REPLACE FUNCTION public.get_pathway_details(p_pathway_id UUID)
RETURNS TABLE (
  facility_id     UUID,
  facility_type   facility_type,
  facility_lat    DOUBLE PRECISION,
  facility_lng    DOUBLE PRECISION,
  facility_name   TEXT,
  facility_desc   TEXT,
  operational     BOOLEAN,
  obstacle_id     UUID,
  obstacle_type   obstacle_type,
  obstacle_lat    DOUBLE PRECISION,
  obstacle_lng    DOUBLE PRECISION,
  obstacle_desc   TEXT,
  workaround      TEXT,
  severity        obstacle_severity
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pf.id, pf.type, pf.latitude, pf.longitude, pf.name, pf.description, pf.operational,
    po.id, po.type, po.latitude, po.longitude, po.description, po.workaround, po.severity
  FROM public.pathway_facilities pf
  LEFT JOIN public.pathway_obstacles po ON false
  WHERE pf.pathway_id = p_pathway_id
  UNION ALL
  SELECT
    NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    po.id, po.type, po.latitude, po.longitude, po.description, po.workaround, po.severity
  FROM public.pathway_obstacles po
  WHERE po.pathway_id = p_pathway_id;
$$;

-- ─── RPC: Get route turn-by-turn directions ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_route_turns(p_route_id UUID)
RETURNS TABLE (
  turn_id         UUID,
  sort_order      INTEGER,
  instruction     TEXT,
  distance_meters DOUBLE PRECISION,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  landmark        TEXT,
  caution         TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    art.id, art.sort_order, art.instruction, art.distance_meters,
    art.latitude, art.longitude, art.landmark, art.caution
  FROM public.accessible_route_turns art
  WHERE art.route_id = p_route_id
  ORDER BY art.sort_order;
$$;

-- ─── RPC: Submit a crowdsource report ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_accessibility_report(
  p_reporter_name TEXT,
  p_reporter_role TEXT,
  p_pathway_id    UUID,
  p_route_id      UUID,
  p_type          report_type,
  p_title         TEXT,
  p_description   TEXT,
  p_latitude      DOUBLE PRECISION,
  p_longitude     DOUBLE PRECISION,
  p_images        TEXT[],
  p_severity      obstacle_severity
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id UUID;
BEGIN
  INSERT INTO public.accessibility_route_reports (
    reporter_id, reporter_name, reporter_role,
    pathway_id, route_id, type, title, description,
    latitude, longitude, images, severity
  ) VALUES (
    auth.uid(), p_reporter_name, p_reporter_role,
    p_pathway_id, p_route_id, p_type, p_title, p_description,
    p_latitude, p_longitude, COALESCE(p_images, '{}'), p_severity
  )
  RETURNING id INTO v_report_id;

  -- Increment reported_issues on the route if linked
  IF p_route_id IS NOT NULL THEN
    UPDATE public.accessible_routes
    SET reported_issues = reported_issues + 1
    WHERE id = p_route_id;
  END IF;

  RETURN v_report_id;
END;
$$;

-- ─── RPC: Rate an accessible route ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rate_accessible_route(
  p_route_id UUID,
  p_rating   SMALLINT,
  p_comment  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.accessibility_route_ratings (route_id, user_id, rating, comment)
  VALUES (p_route_id, auth.uid(), p_rating, p_comment)
  ON CONFLICT (route_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment;

  -- Recalculate aggregate
  UPDATE public.accessible_routes ar
  SET
    overall_rating = sub.avg_rating,
    total_ratings  = sub.cnt
  FROM (
    SELECT route_id, AVG(rating) AS avg_rating, COUNT(*)::int AS cnt
    FROM public.accessibility_route_ratings
    WHERE route_id = p_route_id
    GROUP BY route_id
  ) sub
  WHERE ar.id = sub.route_id;
END;
$$;

-- ─── RPC: Submit a new pathway (crowdsource) ────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_accessible_pathway(
  p_name             TEXT,
  p_geometry         JSONB,
  p_surface          pathway_surface,
  p_width_meters     DOUBLE PRECISION,
  p_has_ramp         BOOLEAN,
  p_has_tactile_paving BOOLEAN,
  p_has_handrails    BOOLEAN,
  p_grade_percentage DOUBLE PRECISION
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pathway_id UUID;
BEGIN
  INSERT INTO public.accessible_pathways (
    name, geometry, surface, width_meters,
    has_ramp, has_tactile_paving, has_handrails,
    grade_percentage, crowdsource_updated, created_by
  ) VALUES (
    p_name, p_geometry, p_surface, p_width_meters,
    p_has_ramp, p_has_tactile_paving, p_has_handrails,
    p_grade_percentage, true, auth.uid()
  )
  RETURNING id INTO v_pathway_id;

  RETURN v_pathway_id;
END;
$$;

-- ─── RPC: Accessibility stats summary ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_accessibility_stats()
RETURNS TABLE (
  total_pathways              BIGINT,
  verified_pathways           BIGINT,
  total_routes                BIGINT,
  total_reports               BIGINT,
  pending_reports             BIGINT,
  avg_route_rating            DOUBLE PRECISION,
  wheelchair_coverage_pct     DOUBLE PRECISION,
  last_community_update       TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.accessible_pathways),
    (SELECT COUNT(*) FROM public.accessible_pathways WHERE verified_by IS NOT NULL),
    (SELECT COUNT(*) FROM public.accessible_routes),
    (SELECT COUNT(*) FROM public.accessibility_route_reports),
    (SELECT COUNT(*) FROM public.accessibility_route_reports WHERE status = 'pending'),
    (SELECT COALESCE(AVG(overall_rating), 0) FROM public.accessible_routes),
    CASE
      WHEN (SELECT COUNT(*) FROM public.venue_entrances) = 0 THEN 0
      ELSE (
        SELECT COUNT(DISTINCT ve.venue_id)::double precision
          / (SELECT COUNT(*) FROM public.venue_entrances)::double precision * 100
        FROM public.accessible_routes ar
        JOIN public.venue_entrances ve ON ve.id = ar.venue_entrance_id
        WHERE ar.wheelchair_friendly
      )
    END,
    GREATEST(
      (SELECT MAX(updated_at) FROM public.accessible_pathways WHERE crowdsource_updated),
      (SELECT MAX(submitted_at) FROM public.accessibility_route_reports)
    );
$$;

-- ─── Seed data: sample transit stops ────────────────────────────────────

INSERT INTO public.transit_stops (name, type, latitude, longitude, accessible, has_shelter, description)
VALUES
  ('Main Gate Bus Stop', 'bus-stop', 40.8005, -73.9420, true, true, 'Primary campus bus stop near main entrance'),
  ('Science Hall Shuttle', 'shuttle-stop', 40.8020, -73.9385, true, false, 'Shuttle drop-off near Science Hall'),
  ('Library Parking Lot', 'parking', 40.8045, -73.9350, true, false, 'Accessible parking near library'),
  ('Engineering Gate', 'building-entrance', 40.8010, -73.9400, true, true, 'Engineering building entrance with ramp')
ON CONFLICT DO NOTHING;

-- ─── Seed data: sample venue entrances ──────────────────────────────────

INSERT INTO public.venue_entrances (venue_id, venue_name, entrance_name, latitude, longitude, has_automatic_door, has_ramp, door_width_cm, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Student Union', 'Main Entrance', 40.8050, -73.9370, true, true, 120, 'Main entrance with automatic sliding doors and wheelchair ramp'),
  ('00000000-0000-0000-0000-000000000001', 'Student Union', 'Side Entrance', 40.8055, -73.9365, false, true, 90, 'Side entrance with ramp access'),
  ('00000000-0000-0000-0000-000000000002', 'Science Hall', 'Ground Floor', 40.8025, -73.9380, true, true, 100, 'Ground floor entrance with elevator access to upper floors'),
  ('00000000-0000-0000-0000-000000000003', 'Library', 'South Wing', 40.8048, -73.9355, true, true, 110, 'South wing entrance with tactile paving pathway')
ON CONFLICT DO NOTHING;

-- ─── Seed data: sample accessible pathways ──────────────────────────────

INSERT INTO public.accessible_pathways (name, geometry, surface, width_meters, has_ramp, has_tactile_paving, has_handrails, grade_percentage, average_rating, total_ratings, verified_by)
VALUES
  (
    'Main Gate to Student Union',
    '{"type": "LineString", "coordinates": [[-73.9420, 40.8005], [-73.9410, 40.8015], [-73.9400, 40.8025], [-73.9390, 40.8035], [-73.9380, 40.8045], [-73.9370, 40.8050]]}',
    'paved', 2.0, true, true, true, 2.5, 4.5, 12, '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Science Hall Shuttle to Library',
    '{"type": "LineString", "coordinates": [[-73.9385, 40.8020], [-73.9375, 40.8025], [-73.9365, 40.8030], [-73.9355, 40.8040], [-73.9350, 40.8045]]}',
    'concrete', 1.8, true, false, true, 1.0, 4.0, 8, '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Engineering Gate to Student Union',
    '{"type": "LineString", "coordinates": [[-73.9400, 40.8010], [-73.9395, 40.8020], [-73.9390, 40.8030], [-73.9380, 40.8040], [-73.9370, 40.8050]]}',
    'paved', 1.5, true, true, true, 3.0, 3.8, 6, '00000000-0000-0000-0000-000000000000'
  ),
  (
    'Library Parking to Library South',
    '{"type": "LineString", "coordinates": [[-73.9350, 40.8045], [-73.9352, 40.8046], [-73.9354, 40.8048], [-73.9355, 40.8048]]}',
    'tile', 1.5, false, true, false, 0.5, 4.2, 5, '00000000-0000-0000-0000-000000000000'
  )
ON CONFLICT DO NOTHING;

-- ─── Seed data: sample routes ───────────────────────────────────────────

INSERT INTO public.accessible_routes (name, description, transit_stop_id, venue_entrance_id, total_distance_meters, estimated_time_minutes, difficulty, wheelchair_friendly, visually_friendly, overall_rating, total_ratings, verified, reported_issues)
SELECT
  'Main Gate → Student Union (Primary)',
  'Fully accessible route from main bus stop with ramps, tactile paving, and handrails throughout',
  ts.id,
  ve.id,
  450, 6, 'easy', true, true, 4.5, 12, true, 0
FROM public.transit_stops ts, public.venue_entrances ve
WHERE ts.name = 'Main Gate Bus Stop' AND ve.entrance_name = 'Main Entrance'
LIMIT 1;

INSERT INTO public.accessible_routes (name, description, transit_stop_id, venue_entrance_id, total_distance_meters, estimated_time_minutes, difficulty, wheelchair_friendly, visually_friendly, overall_rating, total_ratings, verified, reported_issues)
SELECT
  'Science Shuttle → Library',
  'Short concrete path from shuttle stop to library south wing',
  ts.id,
  ve.id,
  280, 4, 'easy', true, false, 4.0, 8, true, 0
FROM public.transit_stops ts, public.venue_entrances ve
WHERE ts.name = 'Science Hall Shuttle' AND ve.entrance_name = 'South Wing'
LIMIT 1;

INSERT INTO public.accessible_routes (name, description, transit_stop_id, venue_entrance_id, total_distance_meters, estimated_time_minutes, difficulty, wheelchair_friendly, visually_friendly, overall_rating, total_ratings, verified, reported_issues)
SELECT
  'Engineering Gate → Student Union (Alternate)',
  'Alternate accessible route via engineering gate with moderate grade',
  ts.id,
  ve.id,
  520, 8, 'moderate', true, true, 3.8, 6, true, 1
FROM public.transit_stops ts, public.venue_entrances ve
WHERE ts.name = 'Engineering Gate' AND ve.entrance_name = 'Side Entrance'
LIMIT 1;
