-- =============================================================================
-- Migration: Anonymous Incident Reporting Workflow
-- Issue: #2969 - Build an 'Anonymous Incident Reporting' Workflow
-- Description: Creates the schema for anonymous incident reports tied to events.
-- Includes a claim ticket system for status tracking without user authentication,
-- and a trigger for keyword-based mandatory escalation (e.g., Title IX).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For generating secure claim tickets

-- 1. Incident Reports Table
CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK (char_length(description) >= 20),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_investigation', 'resolved', 'dismissed')),
    is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_reason TEXT,
    internal_notes TEXT, -- Only visible to the Disciplinary Board
    claim_ticket TEXT NOT NULL UNIQUE, -- 12-character alphanumeric hash for the user to check status
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- IP address for rate limiting and abuse prevention (stored securely/hashed in production)
    submitter_ip INET
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_event ON public.incident_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_ticket ON public.incident_reports(claim_ticket);

-- 2. Function to generate a secure, URL-safe claim ticket
CREATE OR REPLACE FUNCTION public.generate_claim_ticket()
RETURNS TEXT AS $$
DECLARE
    ticket TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 12-character base64 string, replace unsafe chars
        ticket := substr(replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '/', ''), '+', ''), '=', ''), 1, 12);
        
        -- Ensure uniqueness
        SELECT EXISTS(SELECT 1 FROM public.incident_reports WHERE claim_ticket = ticket) INTO exists;
        IF NOT exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN ticket;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger to auto-generate claim ticket and check for escalation keywords
CREATE OR REPLACE FUNCTION public.process_incident_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_escalation_keywords TEXT[] := ARRAY['assault', 'harassment', 'weapon', 'threat', 'title ix', 'stalking'];
    v_keyword TEXT;
    v_lower_desc TEXT;
BEGIN
    -- Generate the claim ticket
    NEW.claim_ticket := public.generate_claim_ticket();
    
    -- Keyword Escalation Check (Legal Compliance)
    v_lower_desc := LOWER(NEW.description);
    FOREACH v_keyword IN ARRAY v_escalation_keywords LOOP
        IF v_lower_desc LIKE '%' || v_keyword || '%' THEN
            NEW.is_escalated := TRUE;
            NEW.escalation_reason := 'Mandatory escalation triggered by keyword: ' || v_keyword;
            -- In a real system, this would also invoke pg_net to call an Edge Function 
            -- that pages campus security via PagerDuty/Twilio immediately.
            EXIT;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_process_incident_submission ON public.incident_reports;
CREATE TRIGGER trg_process_incident_submission
BEFORE INSERT ON public.incident_reports
FOR EACH ROW EXECUTE FUNCTION public.process_incident_submission();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- COMPLETE ANONYMITY: No authenticated user can select all reports.
-- Only the Disciplinary Board (via Service Role or a specific admin role check) can view them.
-- We will rely on Edge Functions with Service Role for the Admin Dashboard to bypass RLS securely.

-- Public insertion is allowed BUT must be rate-limited at the Edge Function/API Gateway level.
-- We allow anonymous inserts here, but the application layer MUST enforce CAPTCHA.
CREATE POLICY "Allow anonymous incident submission"
ON public.incident_reports FOR INSERT
WITH CHECK (true); -- Handled by API Gateway rate limiting and CAPTCHA

-- Public can ONLY select their own report if they have the exact claim_ticket.
-- This is used by the /check-status page.
CREATE POLICY "Public can check status via claim ticket"
ON public.incident_reports FOR SELECT
USING (
    -- The application will pass the claim_ticket as a parameter in the query
    -- Since RLS doesn't natively support query parameters, we use a secure RPC instead.
    false 
);

-- Secure RPC for checking status via claim ticket (Bypasses standard RLS select)
CREATE OR REPLACE FUNCTION public.check_incident_status(p_ticket TEXT)
RETURNS TABLE (
    status TEXT,
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    event_title TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ir.status, ir.submitted_at, ir.updated_at, e.title
    FROM public.incident_reports ir
    JOIN public.events e ON ir.event_id = e.id
    WHERE ir.claim_ticket = p_ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
