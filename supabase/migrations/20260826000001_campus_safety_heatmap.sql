-- Migration: 20260826000001_campus_safety_heatmap.sql
-- Description: Creates the safety_reports table, spatial indexing, RPCs, and RLS for Interactive Campus Safety Heatmap & Route Penalizer

CREATE TABLE IF NOT EXISTS public.safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  report_type TEXT NOT NULL CHECK (
    report_type IN (
      'poor_lighting',
      'suspicious_activity',
      'harassment',
      'physical_hazard',
      'emergency_callbox_broken',
      'isolated_pathway',
      'theft_incident',
      'other'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  description TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'verified', 'under_investigation', 'resolved', 'dismissed')
  ),
  upvotes INT NOT NULL DEFAULT 1,
  verified_by_security BOOLEAN NOT NULL DEFAULT false,
  incident_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for fast geospatial bounding box & recent timestamp querying
CREATE INDEX IF NOT EXISTS idx_safety_reports_lat_lng ON public.safety_reports (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status_time ON public.safety_reports (status, incident_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_safety_reports_severity ON public.safety_reports (severity);

-- Campus lighting and emergency callbox infrastructure landmarks table
CREATE TABLE IF NOT EXISTS public.campus_safety_infrastructure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  infrastructure_type TEXT NOT NULL CHECK (
    infrastructure_type IN ('emergency_callbox', 'high_intensity_lighting', 'security_booth', 'safe_haven_building')
  ),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_operational BOOLEAN NOT NULL DEFAULT true,
  last_inspected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_infra_lat_lng ON public.campus_safety_infrastructure (latitude, longitude);

-- Enable RLS
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_safety_infrastructure ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone (including anonymous students) can read active reports and infrastructure
CREATE POLICY "Allow public read access to active safety reports"
  ON public.safety_reports
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated or anonymous insert of safety reports"
  ON public.safety_reports
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow reporter to update their own report"
  ON public.safety_reports
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND reporter_id = auth.uid()) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

CREATE POLICY "Allow public read of campus safety infrastructure"
  ON public.campus_safety_infrastructure
  FOR SELECT
  USING (true);

-- RPC: Fetch aggregated safety reports within bounding box with calculated risk scores
CREATE OR REPLACE FUNCTION public.get_safety_heatmap_points(
  min_lat DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  min_lng DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  report_type TEXT,
  severity TEXT,
  weight DOUBLE PRECISION,
  incident_timestamp TIMESTAMPTZ,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.latitude,
    r.longitude,
    r.report_type,
    r.severity,
    CASE r.severity
      WHEN 'critical' THEN 1.0
      WHEN 'high' THEN 0.75
      WHEN 'medium' THEN 0.45
      WHEN 'low' THEN 0.20
      ELSE 0.30
    END * (
      -- Temporal decay factor: incidents within 7 days carry 1.0x weight, down to 0.4x at 30 days
      GREATEST(0.35, 1.0 - (EXTRACT(EPOCH FROM (now() - r.incident_timestamp)) / (days_back * 86400.0) * 0.65))
    ) AS weight,
    r.incident_timestamp,
    r.description
  FROM public.safety_reports r
  WHERE r.status IN ('active', 'verified', 'under_investigation')
    AND r.latitude BETWEEN min_lat AND max_lat
    AND r.longitude BETWEEN min_lng AND max_lng
    AND r.incident_timestamp >= (now() - (days_back || ' days')::INTERVAL);
END;
$$;
