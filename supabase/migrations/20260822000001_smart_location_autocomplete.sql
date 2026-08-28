-- Issue #3872: Smart Auto-Complete for Event Locations
-- Search responses are cached server-side so the provider is not called for
-- repeated organizer queries. Selected coordinates remain on events.

CREATE TABLE IF NOT EXISTS public.location_search_cache (
  normalized_query TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  provider TEXT NOT NULL DEFAULT 'photon',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_search_cache_expiry
  ON public.location_search_cache (expires_at);

ALTER TABLE public.location_search_cache ENABLE ROW LEVEL SECURITY;

-- The Edge Function uses the service role for cache reads/writes. No direct
-- client access is granted because provider responses are an implementation detail.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_events_coordinates
  ON public.events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON TABLE public.location_search_cache IS
  'Short-lived server-side cache for provider-backed event-location suggestions.';
COMMENT ON COLUMN public.events.latitude IS
  'Latitude captured from the organizer-selected standardized location, when available.';
COMMENT ON COLUMN public.events.longitude IS
  'Longitude captured from the organizer-selected standardized location, when available.';
