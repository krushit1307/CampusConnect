-- Create an index to support fast time-range filtering on RSVPs
CREATE TYPE queue_status_color AS ENUM ('green', 'amber', 'red');

-- Extend Vendor/Sponsor Booth Map Nodes with Queue Telemetry Tracking
CREATE TABLE queue_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booth_id UUID NOT NULL, -- References your booth / food truck maps table (Issue #3289)
    node_name VARCHAR(255) NOT NULL,
    current_wait_minutes INT DEFAULT 0 NOT NULL,
    status_color queue_status_color DEFAULT 'green' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Ledger Table to Track Crowdsourced Votes
CREATE TABLE queue_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES queue_nodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    wait_estimate_minutes INT NOT NULL, -- Values parsed: 5, 15, 30
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for real-time aggregation queries
CREATE INDEX idx_queue_votes_aggregation ON queue_votes(node_id, created_at DESC);

-- Enable Supabase Realtime Broadcast Streams on Queue Nodes
ALTER REPLICA IDENTITY FULL ON queue_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_nodes;

-- RPC Engine Function: Time-Decayed Moving Average Weight Calculation
CREATE OR REPLACE FUNCTION submit_queue_vote(
    target_node_id UUID,
    submitted_wait_minutes INT,
    voter_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    calculated_avg INT;
    new_color queue_status_color;
BEGIN
    -- 1. Insert the fresh crowdsourced metric into the historical ledger
    INSERT INTO queue_votes (node_id, user_id, wait_estimate_minutes)
    VALUES (target_node_id, voter_user_id, submitted_wait_minutes);

    -- 2. Compute a time-decayed moving average (weighting votes from the last 30 mins heavier than older ones)
    SELECT COALESCE(
        ROUND(
            SUM(wait_estimate_minutes * (1 - EXTRACT(EPOCH FROM (NOW() - created_at)) / 1800)) / 
            SUM(1 - EXTRACT(EPOCH FROM (NOW() - created_at)) / 1800)
        ), 
        submitted_wait_minutes
    )::INT INTO calculated_avg
    FROM queue_votes
    WHERE node_id = target_node_id 
      AND created_at >= NOW() - INTERVAL '30 minutes';

    -- Avoid null bounds or negative calculations due to mathematical decay weights near expiration
    IF calculated_avg IS NULL OR calculated_avg < 0 THEN
        calculated_avg := submitted_wait_minutes;
    END IF;

    -- 3. Resolve color-coding thresholds
    IF calculated_avg <= 10 THEN
        new_color := 'green';
    ELSIF calculated_avg <= 25 THEN
        new_color := 'amber';
    ELSE
        new_color := 'red';
    END IF;

    -- 4. Update the core tracking metrics and broadcast live status mutations
    UPDATE queue_nodes
    SET 
        current_wait_minutes = calculated_avg,
        status_color = new_color,
        updated_at = NOW()
    WHERE id = target_node_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
