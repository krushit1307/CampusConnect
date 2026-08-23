-- =============================================================================
-- Migration: Interactive Sponsor Booth Leads
-- Issue: #4055 - Build an 'Interactive "Sponsor Booth" Lead Scanner'
-- Description: Creates the sponsor_leads table for tracking leads scanned at
-- sponsor booths. Includes RLS policies and RPC for registering leads.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sponsor_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scanned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sponsor_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_sponsor_id ON public.sponsor_leads(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_leads_event_id ON public.sponsor_leads(event_id);

ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;

-- Sponsors (or club admins) can view their leads. 
CREATE POLICY "Sponsors and club admins can view leads"
ON public.sponsor_leads FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = sponsor_leads.event_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
    OR scanned_by = auth.uid()
);

CREATE POLICY "Scanners can insert leads"
ON public.sponsor_leads FOR INSERT
WITH CHECK (
    scanned_by = auth.uid()
);

-- RPC to process a scan. It resolves the ticket_id to a user_id and inserts the lead.
CREATE OR REPLACE FUNCTION public.scan_sponsor_lead(
    p_ticket_id UUID,
    p_sponsor_id UUID,
    p_event_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_attendee_name TEXT;
    v_existing BOOLEAN;
BEGIN
    -- 1. Find the user associated with this ticket
    SELECT r.user_id, p.full_name INTO v_user_id, v_attendee_name
    FROM public.event_rsvps r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE r.id = p_ticket_id AND r.event_id = p_event_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid ticket for this event.');
    END IF;

    -- 2. Check if lead already exists
    SELECT EXISTS (
        SELECT 1 FROM public.sponsor_leads
        WHERE sponsor_id = p_sponsor_id AND user_id = v_user_id
    ) INTO v_existing;

    IF v_existing THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Lead already scanned.', 'attendeeName', v_attendee_name);
    END IF;

    -- 3. Insert lead
    INSERT INTO public.sponsor_leads (event_id, sponsor_id, user_id, scanned_by, notes)
    VALUES (p_event_id, p_sponsor_id, v_user_id, auth.uid(), p_notes);

    RETURN jsonb_build_object('success', TRUE, 'message', 'Lead successfully captured.', 'attendeeName', v_attendee_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
