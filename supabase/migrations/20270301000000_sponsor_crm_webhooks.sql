-- Migration: Sponsor CRM Webhooks
CREATE TABLE IF NOT EXISTS public.sponsor_crm_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, sponsor_id)
);

CREATE TABLE IF NOT EXISTS public.sponsor_crm_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES public.sponsor_crm_webhooks(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.sponsor_leads(id) ON DELETE SET NULL,
    payload JSONB,
    response_status INT,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.sponsor_crm_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_crm_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors can manage their CRM webhooks"
ON public.sponsor_crm_webhooks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = sponsor_crm_webhooks.event_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.event_sponsors es
        WHERE es.event_id = sponsor_crm_webhooks.event_id
        AND es.user_id = auth.uid()
    )
);

CREATE POLICY "Sponsors can view their CRM webhook logs"
ON public.sponsor_crm_webhook_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.sponsor_crm_webhooks w
        WHERE w.id = sponsor_crm_webhook_logs.webhook_id
        AND (
            EXISTS (
                SELECT 1 FROM public.events e
                JOIN public.club_members cm ON e.club_id = cm.club_id
                WHERE e.id = w.event_id
                AND cm.user_id = auth.uid()
                AND cm.status = 'approved'
            )
            OR EXISTS (
                SELECT 1 FROM public.event_sponsors es
                WHERE es.event_id = w.event_id
                AND es.user_id = auth.uid()
            )
        )
    )
);

-- Modify scan_sponsor_lead to return lead_id
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
    v_lead_id UUID;
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
    VALUES (p_event_id, p_sponsor_id, v_user_id, auth.uid(), p_notes)
    RETURNING id INTO v_lead_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Lead successfully captured.', 'attendeeName', v_attendee_name, 'lead_id', v_lead_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
