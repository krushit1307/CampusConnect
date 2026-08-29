-- =============================================================================
-- Migration: Dynamic "Sponsor Lead" CRM Integration
-- Issue: #4418 - Pipe sponsor leads directly into Salesforce or HubSpot
-- Description:
--   1. sponsor_crm_connections stores each sponsor's CRM credential (HubSpot
--      private-app token or Salesforce OAuth token) plus provider config.
--   2. sponsor_crm_deliveries is the background job queue. A trigger on
--      sponsor_leads enqueues a PENDING delivery for every newly captured
--      booth lead whenever an enabled integration exists.
--   3. A scheduled worker drains the queue: it POSTs the mapped contact to the
--      sponsor's CRM and records the outcome (DELIVERED / FAILED).
-- Credentials are secrets: they are stored server-side only, never exposed
-- through RLS-readable columns to non-owner roles beyond a masked hint.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sponsor_crm_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('hubspot', 'salesforce')),
    -- Secret material. Readable only by the service role / definer functions.
    credential_secret TEXT NOT NULL,
    -- Masked preview (e.g. 'pat-...f4c9') safe to show the sponsor.
    credential_hint TEXT NOT NULL DEFAULT '••••',
    instance_url TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sponsor_id)
);

CREATE TABLE IF NOT EXISTS public.sponsor_crm_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.sponsor_leads(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.sponsor_crm_connections(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    crm_record_id TEXT,
    last_error TEXT,
    -- Snapshot of the mapped contact fields captured at enqueue time so the
    -- worker never needs to join back into attendee PII tables.
    contact_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_crm_connections_sponsor_id
    ON public.sponsor_crm_connections(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_crm_deliveries_status
    ON public.sponsor_crm_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_crm_deliveries_connection_id
    ON public.sponsor_crm_deliveries(connection_id);

ALTER TABLE public.sponsor_crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_crm_deliveries ENABLE ROW LEVEL SECURITY;

-- Club admins (approved members of the club running the sponsor's event)
-- manage their sponsors' integration row. The secret column itself is revoked
-- from authenticated reads below; only the masked hint travels to clients.
CREATE POLICY "Sponsors can view their CRM connections"
ON public.sponsor_crm_connections FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.sponsors s
        JOIN public.events e ON e.id = s.event_id
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE s.id = sponsor_crm_connections.sponsor_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Sponsors can insert their CRM connections"
ON public.sponsor_crm_connections FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.sponsors s
        JOIN public.events e ON e.id = s.event_id
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE s.id = sponsor_crm_connections.sponsor_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Sponsors can update their CRM connections"
ON public.sponsor_crm_connections FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.sponsors s
        JOIN public.events e ON e.id = s.event_id
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE s.id = sponsor_crm_connections.sponsor_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

-- Never let clients read the raw secret; they only need the hint.
REVOKE SELECT (credential_secret) ON public.sponsor_crm_connections FROM authenticated;

CREATE POLICY "Sponsors can view their CRM deliveries"
ON public.sponsor_crm_deliveries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.sponsor_crm_connections c
        JOIN public.sponsors s ON s.id = c.sponsor_id
        JOIN public.events e ON e.id = s.event_id
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE c.id = sponsor_crm_deliveries.connection_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

-- Deliveries are written by the backend worker (service role only).

-- -----------------------------------------------------------------------------
-- Enqueue hook: when a booth scan registers a lead (#4284), snapshot the
-- mapped contact and queue an instant CRM delivery if the sponsor integrated.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_sponsor_crm_delivery()
RETURNS TRIGGER AS $$
DECLARE
    v_connection_id UUID;
    v_attendee RECORD;
BEGIN
    SELECT id INTO v_connection_id
    FROM public.sponsor_crm_connections
    WHERE sponsor_id = NEW.sponsor_id AND enabled = TRUE;

    IF v_connection_id IS NULL THEN
        -- No active integration; the CSV export flow still applies.
        RETURN NEW;
    END IF;

    SELECT p.first_name, p.last_name, u.email, p.major
    INTO v_attendee
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = NEW.user_id;

    INSERT INTO public.sponsor_crm_deliveries
        (lead_id, connection_id, status, contact_payload)
    VALUES (
        NEW.id,
        v_connection_id,
        'PENDING',
        jsonb_build_object(
            'firstName', COALESCE(v_attendee.first_name, ''),
            'lastName', COALESCE(v_attendee.last_name, '(unknown)'),
            'email', COALESCE(v_attendee.email, ''),
            'major', COALESCE(v_attendee.major, ''),
            'leadId', NEW.id::TEXT,
            'sponsorId', NEW.sponsor_id::TEXT,
            'eventId', NEW.event_id::TEXT,
            'notes', NEW.notes
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lead_captured_enqueue_crm ON public.sponsor_leads;
CREATE TRIGGER on_lead_captured_enqueue_crm
AFTER INSERT ON public.sponsor_leads
FOR EACH ROW EXECUTE FUNCTION public.enqueue_sponsor_crm_delivery();

-- -----------------------------------------------------------------------------
-- Worker entry point: processes due deliveries and POSTs them to the CRM.
-- Called by a scheduled job (pg_cron / edge function) as service role. Each
-- call attempts up to p_batch_size pending jobs; failures retry with backoff
-- up to 3 attempts before being marked FAILED.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_sponsor_crm_queue(p_batch_size INT DEFAULT 25)
RETURNS TABLE (delivery_id UUID, status TEXT, crm_record_id TEXT, error TEXT) AS $$
DECLARE
    v_job RECORD;
    v_connection RECORD;
    v_response JSONB;
    v_http_status INT;
    v_endpoint TEXT;
    v_auth_header TEXT;
    v_error TEXT;
    v_record_id TEXT;
    v_new_status TEXT;
BEGIN
    FOR v_job IN (
        SELECT d.*, c.provider, c.credential_secret, c.instance_url
        FROM public.sponsor_crm_deliveries d
        JOIN public.sponsor_crm_connections c ON c.id = d.connection_id
        WHERE (d.status = 'PENDING' OR d.status = 'FAILED')
        AND d.attempts < 3
        AND d.next_attempt_at <= NOW()
        ORDER BY d.created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            IF v_job.provider = 'hubspot' THEN
                v_endpoint := 'https://api.hubapi.com/crm/v3/objects/contacts';
                v_auth_header := 'Bearer ' || v_job.credential_secret;
                v_response := public.crm_post_contact(
                    v_endpoint,
                    v_auth_header,
                    jsonb_build_object(
                        'properties', jsonb_strip_nulls(jsonb_build_object(
                            'firstname', v_job.contact_payload->>'firstName',
                            'lastname', v_job.contact_payload->>'lastName',
                            'email', v_job.contact_payload->>'email',
                            'major', v_job.contact_payload->>'major',
                            'description', 'CampusConnect booth lead.'
                        ))
                    )
                );
            ELSE
                v_endpoint := COALESCE(v_job.instance_url, '') || '/services/data/v60.0/sobjects/Contact';
                v_auth_header := 'Bearer ' || v_job.credential_secret;
                v_response := public.crm_post_contact(
                    v_endpoint,
                    v_auth_header,
                    jsonb_build_object(
                        'FirstName', v_job.contact_payload->>'firstName',
                        'LastName', v_job.contact_payload->>'lastName',
                        'Email', v_job.contact_payload->>'email',
                        'Department', v_job.contact_payload->>'major',
                        'LeadSource', 'CampusConnect Booth Scan',
                        'Description', 'CampusConnect booth lead.'
                    )
                );
            END IF;

            v_http_status := (v_response->>'status')::INT;
            v_record_id := v_response->>'recordId';

            IF v_http_status BETWEEN 200 AND 299 THEN
                v_new_status := 'DELIVERED';
                UPDATE public.sponsor_crm_deliveries
                SET status = 'DELIVERED',
                    crm_record_id = v_record_id,
                    delivered_at = NOW(),
                    last_error = NULL,
                    attempts = attempts + 1
                WHERE id = v_job.id;
            ELSE
                v_error := 'CRM responded with HTTP ' || v_http_status;
                v_new_status := CASE WHEN v_job.attempts + 1 >= 3 THEN 'FAILED' ELSE 'PENDING' END;
                UPDATE public.sponsor_crm_deliveries
                SET status = v_new_status,
                    attempts = attempts + 1,
                    last_error = v_error,
                    next_attempt_at = NOW() + make_interval(secs => LEAST(60, power(2, v_job.attempts) * 5))
                WHERE id = v_job.id;
            END IF;

            delivery_id := v_job.id;
            status := v_new_status;
            crm_record_id := v_record_id;
            error := v_error;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            v_new_status := CASE WHEN v_job.attempts + 1 >= 3 THEN 'FAILED' ELSE 'PENDING' END;
            UPDATE public.sponsor_crm_deliveries
            SET status = v_new_status,
                attempts = attempts + 1,
                last_error = LEFT(v_error, 500),
                next_attempt_at = NOW() + make_interval(secs => LEAST(60, power(2, v_job.attempts) * 5))
            WHERE id = v_job.id;

            delivery_id := v_job.id;
            status := v_new_status;
            crm_record_id := NULL;
            error := v_error;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thin HTTP wrapper kept separate so it is easy to mock/replace in staging.
CREATE OR REPLACE FUNCTION public.crm_post_contact(
    p_url TEXT,
    p_auth_header TEXT,
    p_body JSONB
) RETURNS JSONB AS $$
DECLARE
    v_response JSONB;
    v_status INT;
    v_body TEXT;
BEGIN
    SELECT content, status INTO v_body, v_status
    FROM http((
        'POST',
        p_url,
        ARRAY[http_header('Authorization', p_auth_header),
              http_header('Content-Type', 'application/json')],
        'application/json',
        p_body::TEXT
    )::http_request);

    v_response := jsonb_build_object('status', v_status);
    IF v_body LIKE '{%' THEN
        v_response := v_response || jsonb_build_object(
            'recordId', COALESCE(
                (v_body::JSONB ->> 'id'),
                (v_body::JSONB -> 'properties' ->> 'id')
            )
        );
    END IF;
    RETURN v_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
