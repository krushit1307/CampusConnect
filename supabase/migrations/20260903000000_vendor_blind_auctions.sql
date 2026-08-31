-- Migration: 20260903000000_vendor_blind_auctions.sql
-- Description: Schema and RPC functions for Sealed-Bid Blind Auction Mode for Vendor Contracts

CREATE TABLE IF NOT EXISTS public.vendor_blind_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('DJ', 'CATERING', 'PHOTOGRAPHY', 'SECURITY', 'AV_LIGHTING', 'DECOR', 'OTHER')),
    max_budget NUMERIC(10, 2) NOT NULL CHECK (max_budget > 0),
    is_blind_auction BOOLEAN NOT NULL DEFAULT true,
    bidding_deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN_SEALED' CHECK (status IN ('OPEN_SEALED', 'SEALS_BROKEN', 'AWARDED', 'CANCELLED')),
    seals_broken_at TIMESTAMPTZ,
    awarded_bid_id UUID,
    awarded_vendor_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.vendor_sealed_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.vendor_blind_auctions(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    vendor_email TEXT NOT NULL,
    commitment_hash TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    is_sealed BOOLEAN NOT NULL DEFAULT true,
    revealed_amount NUMERIC(10, 2),
    proposal_details TEXT,
    deliverables_summary JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    unsealed_at TIMESTAMPTZ,
    CONSTRAINT unique_vendor_auction_bid UNIQUE(auction_id, vendor_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blind_auctions_event ON public.vendor_blind_auctions(event_id);
CREATE INDEX IF NOT EXISTS idx_sealed_bids_auction ON public.vendor_sealed_bids(auction_id);

-- Enable RLS
ALTER TABLE public.vendor_blind_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sealed_bids ENABLE ROW LEVEL SECURITY;

-- RLS: Vendors can only view their own bid amount while auction is OPEN_SEALED.
-- Once SEALS_BROKEN, the organizer and vendors can see all revealed details.
CREATE POLICY "Public read for blind auction gigs"
    ON public.vendor_blind_auctions FOR SELECT
    USING (true);

CREATE POLICY "Vendors can insert their sealed bid"
    ON public.vendor_sealed_bids FOR INSERT
    WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can view their own sealed bid or revealed bids after unsealing"
    ON public.vendor_sealed_bids FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1 FROM public.vendor_blind_auctions a
            WHERE a.id = vendor_sealed_bids.auction_id
            AND (a.status IN ('SEALS_BROKEN', 'AWARDED') OR a.organizer_id = auth.uid())
        )
    );

-- Atomic RPC function to break seals and simultaneously reveal all bids
CREATE OR REPLACE FUNCTION unseal_blind_auction_bids(
    p_auction_id UUID,
    p_organizer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auction RECORD;
    v_bids JSONB;
BEGIN
    SELECT * INTO v_auction
    FROM public.vendor_blind_auctions
    WHERE id = p_auction_id;

    IF v_auction IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction not found.');
    END IF;

    IF v_auction.organizer_id != p_organizer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the event organizer can break seals.');
    END IF;

    -- Update auction status to SEALS_BROKEN
    UPDATE public.vendor_blind_auctions
    SET status = 'SEALS_BROKEN',
        seals_broken_at = now(),
        updated_at = now()
    WHERE id = p_auction_id;

    -- Mark all bids as unsealed
    UPDATE public.vendor_sealed_bids
    SET is_sealed = false,
        unsealed_at = now()
    WHERE auction_id = p_auction_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'bid_id', id,
            'vendor_id', vendor_id,
            'vendor_name', vendor_name,
            'revealed_amount', revealed_amount,
            'proposal_details', proposal_details,
            'unsealed_at', now()
        )
    ) INTO v_bids
    FROM public.vendor_sealed_bids
    WHERE auction_id = p_auction_id;

    RETURN jsonb_build_object(
        'success', true,
        'auction_id', p_auction_id,
        'status', 'SEALS_BROKEN',
        'seals_broken_at', now(),
        'bids', COALESCE(v_bids, '[]'::jsonb)
    );
END;
$$;
