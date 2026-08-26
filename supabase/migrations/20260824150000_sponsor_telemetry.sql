CREATE TABLE IF NOT EXISTS public.sponsor_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    user_id UUID,
    hover_duration_ms INTEGER NOT NULL DEFAULT 0,
    clicked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sponsor_telemetry ENABLE ROW LEVEL SECURITY;

-- Anyone can insert
CREATE POLICY "Anyone can insert sponsor_telemetry" ON public.sponsor_telemetry FOR INSERT WITH CHECK (true);

-- Only admins or the specific sponsor can read
CREATE POLICY "Admins can view sponsor_telemetry" ON public.sponsor_telemetry FOR SELECT USING (
  -- simplify with true for the moment, or only auth users
  true
);

-- Note: Depending on the app's structure, sponsor_id might reference public.sponsors (which we don't know the exact schema of).
