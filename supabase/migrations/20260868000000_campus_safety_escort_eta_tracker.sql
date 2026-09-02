-- Migration: 20260868000000_campus_safety_escort_eta_tracker.sql
-- Description: Real-Time Campus Safety Escort ETA Tracker with WebSocket GPS streaming & Distance Matrix ETA (#4686)

CREATE TABLE IF NOT EXISTS public.campus_safety_escort_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  officer_name TEXT NOT NULL DEFAULT 'Officer Smith',
  officer_badge_number TEXT NOT NULL DEFAULT 'PD-402',
  student_lat NUMERIC(10, 6) NOT NULL,
  student_lng NUMERIC(10, 6) NOT NULL,
  officer_current_lat NUMERIC(10, 6) NOT NULL,
  officer_current_lng NUMERIC(10, 6) NOT NULL,
  eta_minutes INT NOT NULL DEFAULT 3,
  distance_miles NUMERIC(10, 2) NOT NULL DEFAULT 0.40,
  status TEXT NOT NULL DEFAULT 'en_route', -- 'dispatched', 'en_route', 'arrived', 'completed'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for escort request lookups
CREATE INDEX IF NOT EXISTS idx_safety_escort_student ON public.campus_safety_escort_requests(student_id, status);

-- Enable RLS
ALTER TABLE public.campus_safety_escort_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read safety escort requests"
ON public.campus_safety_escort_requests FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage safety escort requests"
ON public.campus_safety_escort_requests FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.campus_safety_escort_requests TO authenticated, anon;
