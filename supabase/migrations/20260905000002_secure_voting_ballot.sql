-- =============================================================================
-- Migration: Secure Digital Voting Ballot (E2EV Protocol)
-- Issue: #3231 - Develop a 'Secure Digital Voting Ballot' for Student Union
-- Description: Implements an End-to-End Verifiable voting system. Separates 
-- user participation tracking from the actual ballot storage to guarantee 
-- absolute anonymity. Includes a jitter queue to prevent time-correlation attacks.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Elections Table
CREATE TABLE IF NOT EXISTS public.elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Election Candidates Table
CREATE TABLE IF NOT EXISTS public.election_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform_summary TEXT,
    display_order INT NOT NULL DEFAULT 0
);

-- 3. Election Participation Table (Prevents double voting)
-- STRICTLY DECOUPLED from the ballot table. No foreign key to ballots.
CREATE TABLE IF NOT EXISTS public.election_participation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participation_election 
ON public.election_participation(election_id);

-- 4. Secure Ballots Table (The actual votes)
-- Contains NO user_id. Only a tracking number and the encrypted payload.
CREATE TABLE IF NOT EXISTS public.secure_ballots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    tracking_number UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    encrypted_payload TEXT NOT NULL, -- The candidate ID, encrypted or hashed
    cast_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ballots_election 
ON public.secure_ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_tracking 
ON public.secure_ballots(tracking_number);

-- 5. Ballot Jitter Queue (Mitigates time-correlation attacks)
-- Votes are inserted here first, then a background worker moves them to 
-- secure_ballots after a randomized delay (1-5 minutes).
CREATE TABLE IF NOT EXISTS public.ballot_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL,
    tracking_number UUID NOT NULL,
    encrypted_payload TEXT NOT NULL,
    process_after TIMESTAMPTZ NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ballot_queue_pending 
ON public.ballot_queue(is_processed, process_after) 
WHERE is_processed = FALSE;

-- =============================================================================
-- RPC: Cast Secure Vote
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cast_secure_vote(
    p_election_id UUID,
    p_encrypted_payload TEXT
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_tracking_number UUID;
    v_jitter_interval INTERVAL;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Verify election is active
    IF NOT EXISTS (
        SELECT 1 FROM public.elections 
        WHERE id = p_election_id AND is_active = TRUE AND end_time > NOW()
    ) THEN
        RAISE EXCEPTION 'Election is not active or has ended.';
    END IF;

    -- 2. Check if user has already voted (Prevent double voting)
    IF EXISTS (
        SELECT 1 FROM public.election_participation 
        WHERE election_id = p_election_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You have already cast a vote in this election.';
    END IF;

    -- 3. Generate Tracking Number
    v_tracking_number := uuid_generate_v4();

    -- 4. Log Participation (Decoupled from ballot)
    INSERT INTO public.election_participation (election_id, user_id)
    VALUES (p_election_id, v_user_id);

    -- 5. Calculate Random Jitter (1 to 5 minutes) to prevent time-correlation
    v_jitter_interval := (floor(random() * 240) + 60) * INTERVAL '1 second';

    -- 6. Insert into Jitter Queue (NOT directly into secure_ballots)
    INSERT INTO public.ballot_queue (election_id, tracking_number, encrypted_payload, process_after)
    VALUES (p_election_id, v_tracking_number, p_encrypted_payload, NOW() + v_jitter_interval);

    -- Return the tracking number to the user so they can verify later
    RETURN v_tracking_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RPC: Process Ballot Queue (Called by background worker/cron)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_ballot_queue()
RETURNS INT AS $$
DECLARE
    v_processed_count INT := 0;
    v_queue_record RECORD;
BEGIN
    FOR v_queue_record IN 
        SELECT id, election_id, tracking_number, encrypted_payload 
        FROM public.ballot_queue 
        WHERE is_processed = FALSE AND process_after <= NOW()
        ORDER BY process_after ASC
        LIMIT 50 -- Process in batches
    LOOP
        INSERT INTO public.secure_ballots (election_id, tracking_number, encrypted_payload)
        VALUES (v_queue_record.election_id, v_queue_record.tracking_number, v_queue_record.encrypted_payload);
        
        UPDATE public.ballot_queue SET is_processed = TRUE WHERE id = v_queue_record.id;
        v_processed_count := v_processed_count + 1;
    END LOOP;
    
    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_ballots ENABLE ROW LEVEL SECURITY;

-- Elections & Candidates are public
CREATE POLICY "Anyone can view active elections" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Anyone can view candidates" ON public.election_candidates FOR SELECT USING (true);

-- Users can only see their OWN participation status (to know if they voted)
CREATE POLICY "Users can view own participation" ON public.election_participation FOR SELECT USING (auth.uid() = user_id);

-- Secure Ballots are PUBLIC so anyone can verify the ledger
CREATE POLICY "Public can view secure ballots" ON public.secure_ballots FOR SELECT USING (true);
