-- Migration: 20260853000000_accessibility_routing_protocol.sql
-- Description: Real-Time Accessibility Need Routing Protocol directly to Disability Services Professionals (#4277)

CREATE TABLE IF NOT EXISTS public.critical_accessibility_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accommodation_type TEXT NOT NULL, -- 'asl_interpreter', 'braille_materials', 'wheelchair_shuttle', 'assistive_listening'
  status TEXT NOT NULL DEFAULT 'routed_to_disability_services', -- 'routed_to_disability_services', 'in_review_by_admin', 'fulfilled_by_admin', 'closed'
  disability_services_ticket_id TEXT DEFAULT NULL,
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event & ticket lookup
CREATE INDEX IF NOT EXISTS idx_critical_accessibility_req_event ON public.critical_accessibility_requests(event_id, status);

-- Enable RLS
ALTER TABLE public.critical_accessibility_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read accessibility requests"
ON public.critical_accessibility_requests FOR SELECT
USING (true);

CREATE POLICY "Authenticated insert accessibility requests"
ON public.critical_accessibility_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin update accessibility requests"
ON public.critical_accessibility_requests FOR UPDATE
USING (true);

GRANT ALL ON public.critical_accessibility_requests TO authenticated, anon;
