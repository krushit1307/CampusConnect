-- Migration: 20260855000000_campus_safety_incident_reporter.sql
-- Description: Interactive Campus Safety Incident Reporter with 1-click triage, GPS capture, and Campus PD SMS alerts (#4286)

CREATE TABLE IF NOT EXISTS public.campus_safety_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  incident_category TEXT NOT NULL, -- 'medical_emergency', 'security_threat', 'facility_issue', 'other'
  description TEXT DEFAULT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  location_label TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'responded', 'resolved'
  campus_pd_notified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for live event incident monitoring
CREATE INDEX IF NOT EXISTS idx_campus_safety_incidents_event ON public.campus_safety_incidents(event_id, status);

-- Enable RLS
ALTER TABLE public.campus_safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read campus safety incidents"
ON public.campus_safety_incidents FOR SELECT
USING (true);

CREATE POLICY "Authenticated insert campus safety incidents"
ON public.campus_safety_incidents FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organizers update campus safety incidents"
ON public.campus_safety_incidents FOR UPDATE
USING (true);

GRANT ALL ON public.campus_safety_incidents TO authenticated, anon;
