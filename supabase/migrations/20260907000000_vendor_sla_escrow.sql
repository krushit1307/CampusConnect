-- Migration for Interactive "Vendor Bidding" Escrow Slashing for Delays (Smart Contract SLA Oracles) (#5304)

CREATE TABLE IF NOT EXISTS public.vendor_sla_escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL, -- references external vendors
    contract_address TEXT NOT NULL, -- The Polygon contract holding the USDC
    escrow_hash bytes32, -- Represents the mapping key on chain
    locked_usdc_amount NUMERIC NOT NULL,
    sla_deadline TIMESTAMPTZ NOT NULL,
    delivery_id TEXT NOT NULL, -- Passed to oracle
    oracle_status TEXT DEFAULT 'AWAITING_DELIVERY' CHECK (oracle_status IN ('AWAITING_DELIVERY', 'ORACLE_TRIGGERED', 'RESOLVED_ON_TIME', 'RESOLVED_SLASHED')),
    vendor_payout NUMERIC DEFAULT 0,
    club_refund NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION set_sla_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendor_sla_escrows_updated_at
BEFORE UPDATE ON public.vendor_sla_escrows
FOR EACH ROW
EXECUTE FUNCTION set_sla_escrow_updated_at();

-- RLS
ALTER TABLE public.vendor_sla_escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clubs can view their escrows" 
ON public.vendor_sla_escrows 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.events 
        WHERE events.id = vendor_sla_escrows.event_id 
        AND events.organizer_id = auth.uid()
    )
);
