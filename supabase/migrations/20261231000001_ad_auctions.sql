-- Create Enum for Placement Types
CREATE TYPE placement_type AS ENUM ('headline_sponsor', 'homepage_banner', 'push_notification', 'booth_premium');

-- Create Ad Auctions Table
CREATE TABLE ad_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL, -- References your events table
    placement placement_type NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Bids Ledger Table
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES ad_auctions(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL, -- References your users/sponsors profiles table
    sponsor_name VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexing for Fast Lookups
CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount DESC);
CREATE INDEX idx_auctions_end_time ON ad_auctions(end_time) WHERE is_closed = FALSE;

-- Enable Supabase Realtime for the Bids Table
ALTER REPLICA IDENTITY FULL ON bids;
ALTER REPLICA IDENTITY FULL ON ad_auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE ad_auctions;

-- Security Policies (Row Level Security)
ALTER TABLE ad_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active auctions" ON ad_auctions 
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated sponsors to view bids" ON bids 
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated sponsors to insert bids" ON bids 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND amount > 0);

CREATE OR REPLACE FUNCTION place_live_bid(
    target_auction_id UUID,
    sponsor_bid_amount NUMERIC,
    sponsor_company_name VARCHAR
)
RETURNS VOID AS $$
DECLARE
    current_max_bid NUMERIC;
    auction_has_ended BOOLEAN;
BEGIN
    -- Check if auction is already closed or expired
    SELECT is_closed OR (end_time < NOW()) INTO auction_has_ended 
    FROM ad_auctions 
    WHERE id = target_auction_id;
    
    IF auction_has_ended THEN
        RAISE EXCEPTION 'This ad auction has already closed.';
    END IF;

    -- Fetch current maximum bid amount
    SELECT COALESCE(MAX(amount), 0) INTO current_max_bid 
    FROM bids 
    WHERE auction_id = target_auction_id;

    -- Validate that the new bid is higher than the current winner
    IF sponsor_bid_amount <= current_max_bid THEN
        RAISE EXCEPTION 'Your bid must be higher than the current highest bid of %', current_max_bid;
    END IF;

    -- Insert valid bid into ledger
    INSERT INTO bids (auction_id, sponsor_id, sponsor_name, amount)
    VALUES (target_auction_id, auth.uid(), sponsor_company_name, sponsor_bid_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
