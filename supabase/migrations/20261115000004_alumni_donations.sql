-- =============================================================================
-- Migration: Dynamic "Alumni Donation" Tracker
-- Issue: #3709 - Develop a 'Dynamic "Alumni Donation" Tracker'
-- Description: Tracks alumni donations and links them to the event budget they
-- funded. When an event completes with a photo gallery, the linked donors are
-- notified with an impact report (photos + attendee metrics).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alum_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  allocated_to_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  message TEXT,
  impact_reported BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_alum ON public.donations(alum_user_id);
CREATE INDEX IF NOT EXISTS idx_donations_event ON public.donations(allocated_to_event_id);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Alumni see their own donations
CREATE POLICY "Alumni view own donations"
ON public.donations FOR SELECT USING (auth.uid() = alum_user_id);

-- Club treasurers/admins manage their club's donations
CREATE POLICY "Club admins manage club donations"
ON public.donations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = donations.club_id AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'president', 'treasurer')
  )
);

-- =============================================================================
-- RPC: Donations awaiting an impact report for a completed event
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_event_donations(p_event_id UUID)
RETURNS TABLE (
  donation_id UUID, alum_user_id UUID, alum_name TEXT, amount NUMERIC, impact_reported BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.alum_user_id, p.full_name, d.amount, d.impact_reported
  FROM public.donations d
  JOIN public.profiles p ON p.id = d.alum_user_id
  WHERE d.allocated_to_event_id = p_event_id;
END;
$$ LANGUAGE plpgsql STABLE;
