CREATE TABLE IF NOT EXISTS public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tour_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 20,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tour_id, sequence_order),
  CONSTRAINT tour_waypoints_radius_valid
    CHECK (radius_meters > 0 AND radius_meters <= 5000)
);

CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_waypoint_index INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_unlocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tour_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_waypoints_tour_order
  ON public.tour_waypoints(tour_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_user_tour_progress_user
  ON public.user_tour_progress(user_id);

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active tours" ON public.tours;
CREATE POLICY "Anyone can view active tours"
ON public.tours
FOR SELECT
USING (is_active = TRUE OR created_by = auth.uid());

DROP POLICY IF EXISTS "Club organizers can create tours" ON public.tours;
CREATE POLICY "Club organizers can create tours"
ON public.tours
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    club_id IS NULL
    OR public.is_club_admin(club_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.clubs
      WHERE clubs.id = tours.club_id
      AND clubs.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Club organizers can update tours" ON public.tours;
CREATE POLICY "Club organizers can update tours"
ON public.tours
FOR UPDATE
USING (
  auth.uid() = created_by
  OR (
    club_id IS NOT NULL
    AND public.is_club_admin(club_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Anyone can view tour waypoints" ON public.tour_waypoints;
CREATE POLICY "Anyone can view tour waypoints"
ON public.tour_waypoints
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tours
    WHERE tours.id = tour_waypoints.tour_id
    AND (tours.is_active = TRUE OR tours.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Tour organizers can manage waypoints" ON public.tour_waypoints;
CREATE POLICY "Tour organizers can manage waypoints"
ON public.tour_waypoints
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.tours
    WHERE tours.id = tour_waypoints.tour_id
    AND (
      tours.created_by = auth.uid()
      OR (
        tours.club_id IS NOT NULL
        AND public.is_club_admin(tours.club_id, auth.uid())
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tours
    WHERE tours.id = tour_waypoints.tour_id
    AND (
      tours.created_by = auth.uid()
      OR (
        tours.club_id IS NOT NULL
        AND public.is_club_admin(tours.club_id, auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can view their tour progress" ON public.user_tour_progress;
CREATE POLICY "Users can view their tour progress"
ON public.user_tour_progress
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their tour progress" ON public.user_tour_progress;
CREATE POLICY "Users can create their tour progress"
ON public.user_tour_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their tour progress" ON public.user_tour_progress;
CREATE POLICY "Users can update their tour progress"
ON public.user_tour_progress
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_tour_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tours_updated_at ON public.tours;

CREATE TRIGGER tours_updated_at
BEFORE UPDATE ON public.tours
FOR EACH ROW
EXECUTE FUNCTION public.update_tour_updated_at();

COMMENT ON TABLE public.tours IS
  'Interactive campus tours created by campus clubs and organizers.';

COMMENT ON TABLE public.tour_waypoints IS
  'Ordered GPS locations that make up an interactive campus tour.';

COMMENT ON TABLE public.user_tour_progress IS
  'Stores the last unlocked waypoint for each user so tours can be resumed.';