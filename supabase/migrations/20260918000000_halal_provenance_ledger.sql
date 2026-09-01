-- Migration for Interactive "Dietary Restriction" Blockchain Provenance for Halal Certification (#5284)
--
-- Mirrors the on-chain HalalProvenanceLedger so the attendee-facing QR scan can be
-- served without an RPC round trip, while the anchored digests remain the source of
-- truth. Rows are append-only by policy: an edited row no longer reproduces its
-- entry_hash, which is what makes the trail tamper-evident.

-- Accredited certification boards whose signatures the ledger accepts.
CREATE TABLE IF NOT EXISTS public.halal_certification_boards (
    id TEXT PRIMARY KEY, -- slug used as the on-chain board id, e.g. 'ifanca'
    name TEXT NOT NULL,
    standard TEXT NOT NULL CHECK (standard IN ('HALAL', 'KOSHER')),
    public_key TEXT NOT NULL, -- hex encoded signing key published by the board
    accreditation_country TEXT NOT NULL,
    accredited BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slaughterhouses / processing facilities certified by a board.
CREATE TABLE IF NOT EXISTS public.halal_processing_facilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    establishment_number TEXT NOT NULL, -- e.g. USDA 'P-31427'
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    certified_by TEXT NOT NULL REFERENCES public.halal_certification_boards(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per lot of meat served at an event.
CREATE TABLE IF NOT EXISTS public.halal_provenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    caterer_id UUID NOT NULL, -- references external vendors
    standard TEXT NOT NULL CHECK (standard IN ('HALAL', 'KOSHER')),
    lot_number TEXT NOT NULL, -- carton lot number, LOT-<year>-<mmdd>-<batch>
    facility_id TEXT NOT NULL REFERENCES public.halal_processing_facilities(id),
    board_id TEXT NOT NULL REFERENCES public.halal_certification_boards(id),
    certificate_hash TEXT NOT NULL, -- digest of the board's certificate document
    board_signature TEXT NOT NULL, -- board signature over the canonical claim
    slaughter_date DATE NOT NULL,
    previous_hash TEXT NOT NULL, -- entry_hash of the event's previous lot
    entry_hash TEXT NOT NULL UNIQUE, -- digest anchored on Polygon
    anchor_status TEXT NOT NULL DEFAULT 'PENDING_ANCHOR'
        CHECK (anchor_status IN ('DRAFT', 'PENDING_ANCHOR', 'ANCHORED', 'REJECTED')),
    polygon_tx_hash TEXT,
    block_number BIGINT,
    anchored_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- A record is only ANCHORED once it carries the transaction that proves it.
    CONSTRAINT halal_anchored_requires_tx CHECK (
        anchor_status <> 'ANCHORED' OR (polygon_tx_hash IS NOT NULL AND block_number IS NOT NULL)
    ),
    -- The same lot cannot be claimed twice for one event.
    CONSTRAINT halal_unique_lot_per_event UNIQUE (event_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_halal_records_event_created
    ON public.halal_provenance_records (event_id, created_at);

-- RLS -------------------------------------------------------------------------

ALTER TABLE public.halal_certification_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halal_processing_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halal_provenance_records ENABLE ROW LEVEL SECURITY;

-- The registry is public knowledge; attendees need it to read a trail.
CREATE POLICY "Boards are publicly readable"
ON public.halal_certification_boards
FOR SELECT USING (TRUE);

CREATE POLICY "Facilities are publicly readable"
ON public.halal_processing_facilities
FOR SELECT USING (TRUE);

-- Anchored records are readable by anyone who scans the QR code at the table,
-- including guests without an account. Unanchored drafts stay with the organizer.
CREATE POLICY "Anchored provenance is publicly readable"
ON public.halal_provenance_records
FOR SELECT USING (anchor_status = 'ANCHORED');

CREATE POLICY "Organizers can read their own event provenance"
ON public.halal_provenance_records
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = halal_provenance_records.event_id
        AND events.organizer_id = auth.uid()
    )
);

CREATE POLICY "Organizers can submit provenance for their events"
ON public.halal_provenance_records
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = halal_provenance_records.event_id
        AND events.organizer_id = auth.uid()
    )
);

-- No UPDATE or DELETE policy is granted to any client role. The ledger is
-- append-only; the anchoring Edge Function uses the service role to attach the
-- transaction hash, and nothing else may rewrite a record after submission.
