-- Migration: 20260845000000_vendor_rfp_system.sql
-- Description: Interactive Vendor Call for Proposals (RFP) system with automated bid comparison (#3559)

CREATE TABLE IF NOT EXISTS public.vendor_rfps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_max NUMERIC(10, 2) NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'awarded', 'closed'
  accepted_bid_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rfp_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.vendor_rfps(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  vendor_email TEXT NOT NULL,
  quoted_price NUMERIC(10, 2) NOT NULL,
  proposal_pdf_url TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key link back for accepted bid
ALTER TABLE public.vendor_rfps 
DROP CONSTRAINT IF EXISTS fk_rfp_accepted_bid;

ALTER TABLE public.vendor_rfps
ADD CONSTRAINT fk_rfp_accepted_bid
FOREIGN KEY (accepted_bid_id) REFERENCES public.rfp_bids(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_rfps_club ON public.vendor_rfps(club_id);
CREATE INDEX IF NOT EXISTS idx_vendor_rfps_status ON public.vendor_rfps(status);
CREATE INDEX IF NOT EXISTS idx_rfp_bids_rfp ON public.rfp_bids(rfp_id);

-- RLS
ALTER TABLE public.vendor_rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read open RFPs"
ON public.vendor_rfps FOR SELECT
USING (true);

CREATE POLICY "Club leaders manage own RFPs"
ON public.vendor_rfps FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public read and insert bids"
ON public.rfp_bids FOR ALL
USING (true);

GRANT ALL ON public.vendor_rfps TO authenticated, anon;
GRANT ALL ON public.rfp_bids TO authenticated, anon;
