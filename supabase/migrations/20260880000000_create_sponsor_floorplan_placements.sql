-- 1. Extend event_floorplans table to support Sponsor_Logo_Container JSON mapping
ALTER TABLE event_floorplans
ADD COLUMN IF NOT EXISTS sponsor_nodes_config JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Create sponsor_table_bids table linking sponsors to physical venue nodes
CREATE TABLE IF NOT EXISTS sponsor_table_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sponsorship_id UUID NOT NULL REFERENCES corporate_sponsorships(id) ON DELETE CASCADE,
    table_node_id TEXT NOT NULL, -- e.g. 'Table_1'
    winning_bid_amount NUMERIC(10, 2) NOT NULL,
    logo_url TEXT NOT NULL,
    target_link_url TEXT NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'outbid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, table_node_id, status)
);

-- Index for public floorplan rendering lookups
CREATE INDEX IF NOT EXISTS idx_sponsor_bids_event ON sponsor_table_bids(event_id, status);

-- Enable RLS
ALTER TABLE sponsor_table_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for venue floorplan rendering
CREATE POLICY "Public read access for sponsor floorplan placements"
    ON sponsor_table_bids FOR SELECT
    USING (TRUE);