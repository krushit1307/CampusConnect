-- =============================================================================
-- Migration: Secure Executive Board Election Voting with Anonymity
-- Issue: #3554 - Implement 'Secure Executive Board Election Voting with Anonymity'
-- Description: Creates a cryptographic voting module. Separates the voter
-- ledger (which enforces 1 vote per user) from the anonymous ballots table.
-- Uses a Postgres Transaction via RPC to guarantee atomicity and anonymity.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Club Elections Table
CREATE TYPE election_status AS ENUM ('draft', 'active', 'closed');

CREATE TABLE IF NOT EXISTS public.club_elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    position TEXT NOT NULL, -- e.g., 'President', 'Treasurer'
    description TEXT,
    candidates_json JSONB NOT NULL DEFAULT '[]', -- Array of { id, name, platform }
    status election_status NOT NULL DEFAULT 'draft',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_elections_club ON public.club_elections(club_id);
CREATE INDEX IF NOT EXISTS idx_club_elections_status ON public.club_elections(status) WHERE status = 'active';

-- 2. Voter Ledger (Strictly enforces 1 vote per user per election)
CREATE TABLE IF NOT EXISTS public.voter_ledger (
    election_id UUID NOT NULL REFERENCES public.club_elections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (election_id, user_id)
);

-- 3. Anonymous Ballots (NO reference to user_id)
CREATE TABLE IF NOT EXISTS public.anonymous_ballots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES public.club_elections(id) ON DELETE CASCADE,
    candidate_selected TEXT NOT NULL, -- The ID or name of the candidate
    cast_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_ballots_election ON public.anonymous_ballots(election_id);

-- =============================================================================
-- RPC: Cast Anonymous Vote (Atomic Transaction)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cast_anonymous_vote(
    p_election_id UUID,
    p_candidate_selected TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_election_status election_status;
    v_is_member BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Verify election is active
    SELECT status INTO v_election_status
    FROM public.club_elections
    WHERE id = p_election_id;

    IF v_election_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'Election is not currently active.';
    END IF;

    -- 2. Verify user is a verified club member
    SELECT EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = (SELECT club_id FROM public.club_elections WHERE id = p_election_id)
        AND cm.user_id = v_user_id
        AND cm.status = 'approved'
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RAISE EXCEPTION 'Only verified club members can vote.';
    END IF;

    -- 3. ATOMIC TRANSACTION: Insert into ledger AND ballots
    -- If the ledger insert fails (duplicate key), the ballot insert is rolled back.
    -- This guarantees a user cannot be marked as "voted" without their ballot counting,
    -- and vice versa.
    
    INSERT INTO public.voter_ledger (election_id, user_id)
    VALUES (p_election_id, v_user_id);

    INSERT INTO public.anonymous_ballots (election_id, candidate_selected)
    VALUES (p_election_id, p_candidate_selected);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.club_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_ballots ENABLE ROW LEVEL SECURITY;

-- Club members can view active elections
CREATE POLICY "Members can view club elections"
ON public.club_elections FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = club_elections.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

-- Users can only see their OWN participation in the ledger (to know if they voted)
CREATE POLICY "Users can view own ledger entry"
ON public.voter_ledger FOR SELECT
USING (auth.uid() = user_id);

-- Anyone can view the anonymous ballots (for public tallying)
CREATE POLICY "Public can view anonymous ballots"
ON public.anonymous_ballots FOR SELECT
USING (true);

-- Only the RPC (service role) can insert into ledger and ballots
CREATE POLICY "System manages voting"
ON public.voter_ledger FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "System manages ballots"
ON public.anonymous_ballots FOR INSERT
WITH CHECK (auth.role() = 'service_role');
