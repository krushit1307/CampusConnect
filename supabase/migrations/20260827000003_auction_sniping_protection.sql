-- Migration: 20260827000003_auction_sniping_protection.sql
-- Purpose: Add soft close (anti-sniping) mechanics to resource auctions.

-- Add extension time tracking to auctions
ALTER TABLE IF EXISTS auctions
ADD COLUMN IF NOT EXISTS original_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS extended_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_extended_at TIMESTAMP WITH TIME ZONE;

-- Function to automatically set original_end_time when auction is created
CREATE OR REPLACE FUNCTION set_original_auction_end_time()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.original_end_time = NEW.end_time;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_original_auction_end_time ON auctions;
CREATE TRIGGER trigger_set_original_auction_end_time
BEFORE INSERT ON auctions
FOR EACH ROW
EXECUTE FUNCTION set_original_auction_end_time();

-- Index for fast lookup of active auctions nearing end time
CREATE INDEX IF NOT EXISTS idx_auctions_active_end_time 
ON auctions(end_time) WHERE status = 'active';
