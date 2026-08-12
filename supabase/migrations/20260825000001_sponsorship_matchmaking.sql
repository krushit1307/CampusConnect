-- =============================================================================
-- Migration: Sponsorship Matchmaking Algorithm & Marketplace
-- Issue: #2961 - Implement 'Sponsorship Matchmaking' Algorithm
-- Description: Creates the schema for funding requests, sponsor campaigns, 
-- and pitches. Includes a Postgres RPC function that calculates a "Match Score" 
-- using array intersection on target demographics and budget alignment.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- For text similarity if needed later
-- 1. Funding Requests (Created by Clubs)
CREATE TABLE IF NOT EXISTS public.funding_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE
    SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        requested_amount INT NOT NULL CHECK (requested_amount > 0),
        -- In cents
        target_demographics TEXT [] NOT NULL DEFAULT '{}',
        -- e.g., {'cs_majors', 'underclassmen'}
        status TEXT NOT NULL DEFAULT 'open' CHECK (
            status IN ('open', 'funded', 'partial', 'closed')
        ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funding_requests_status ON public.funding_requests(status);
CREATE INDEX IF NOT EXISTS idx_funding_requests_demographics ON public.funding_requests USING GIN(target_demographics);
-- 2. Sponsorship Campaigns (Created by Verified Sponsors)
CREATE TABLE IF NOT EXISTS public.sponsorship_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    campaign_title TEXT NOT NULL,
    total_budget INT NOT NULL CHECK (total_budget > 0),
    -- In cents
    remaining_budget INT NOT NULL,
    target_demographics TEXT [] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_campaigns_active ON public.sponsorship_campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_sponsorship_campaigns_demographics ON public.sponsorship_campaigns USING GIN(target_demographics);
-- 3. Sponsor Pitches (The connection between a Request and a Campaign)
CREATE TABLE IF NOT EXISTS public.sponsor_pitches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.funding_requests(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.sponsorship_campaigns(id) ON DELETE CASCADE,
    pitch_message TEXT NOT NULL,
    requested_amount INT NOT NULL,
    approved_amount INT,
    -- Null until sponsor approves (supports partial funding)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'partial', 'rejected')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(request_id, campaign_id) -- A sponsor can only pitch to a request once
);
-- =============================================================================
-- Matchmaking Algorithm (RPC)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.match_sponsors(p_request_id UUID) RETURNS TABLE (
        campaign_id UUID,
        company_name TEXT,
        campaign_title TEXT,
        remaining_budget INT,
        match_score NUMERIC,
        shared_demographics TEXT []
    ) AS $$
DECLARE v_request_demographics TEXT [];
v_request_amount INT;
BEGIN -- Fetch the request details
SELECT target_demographics,
    requested_amount INTO v_request_demographics,
    v_request_amount
FROM public.funding_requests
WHERE id = p_request_id
    AND status IN ('open', 'partial');
IF NOT FOUND THEN RAISE EXCEPTION 'Funding request not found or no longer open.';
END IF;
-- Return campaigns sorted by a calculated match score
RETURN QUERY
SELECT sc.id AS campaign_id,
    sc.company_name,
    sc.campaign_title,
    sc.remaining_budget,
    -- Match Score Calculation:
    -- 1. Demographic overlap (0 to 100 points)
    -- 2. Budget feasibility (0 to 50 points)
    (
        (
            CASE
                WHEN array_length(v_request_demographics, 1) IS NULL THEN 0
                ELSE (
                    SELECT COUNT(*)::NUMERIC
                    FROM unnest(sc.target_demographics) AS s_dem
                    WHERE s_dem = ANY(v_request_demographics)
                ) / array_length(v_request_demographics, 1)::NUMERIC * 100
            END
        ) + (
            CASE
                WHEN sc.remaining_budget >= v_request_amount THEN 50
                WHEN sc.remaining_budget > 0 THEN (
                    sc.remaining_budget::NUMERIC / v_request_amount::NUMERIC
                ) * 50
                ELSE 0
            END
        )
    ) AS match_score,
    -- Shared demographics for UI display
    ARRAY(
        SELECT unnest(sc.target_demographics)
        INTERSECT
        SELECT unnest(v_request_demographics)
    ) AS shared_demographics
FROM public.sponsorship_campaigns sc
WHERE sc.is_active = TRUE
    AND sc.remaining_budget > 0 -- Basic filter to ensure at least some budget or demographic overlap exists
    AND (
        sc.target_demographics && v_request_demographics
        OR sc.remaining_budget >= (v_request_amount * 0.1) -- Allow partial matches if budget is at least 10%
    )
ORDER BY match_score DESC
LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.funding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_pitches ENABLE ROW LEVEL SECURITY;
-- Club members can view and manage their own club's funding requests
CREATE POLICY "Club admins can manage funding requests" ON public.funding_requests FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = funding_requests.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = funding_requests.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
);
-- Sponsors can view open requests and manage their own campaigns
CREATE POLICY "Sponsors can view open requests" ON public.funding_requests FOR
SELECT USING (status IN ('open', 'partial'));
CREATE POLICY "Sponsors can manage own campaigns" ON public.sponsorship_campaigns FOR ALL USING (sponsor_id = auth.uid()) WITH CHECK (sponsor_id = auth.uid());
-- Pitches RLS
CREATE POLICY "Users can view relevant pitches" ON public.sponsor_pitches FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.funding_requests fr
            WHERE fr.id = sponsor_pitches.request_id
                AND fr.club_id IN (
                    SELECT club_id
                    FROM public.club_members
                    WHERE user_id = auth.uid()
                        AND role = 'admin'
                )
        )
        OR EXISTS (
            SELECT 1
            FROM public.sponsorship_campaigns sc
            WHERE sc.id = sponsor_pitches.campaign_id
                AND sc.sponsor_id = auth.uid()
        )
    );
CREATE POLICY "Sponsors can insert pitches" ON public.sponsor_pitches FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.sponsorship_campaigns sc
            WHERE sc.id = sponsor_pitches.campaign_id
                AND sc.sponsor_id = auth.uid()
        )
    );