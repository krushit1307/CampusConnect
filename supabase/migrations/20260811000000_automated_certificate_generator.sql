-- ============================================================
-- Migration: Automated Certificate Generator (#2910)
-- Description:
--  1. Adds generates_certificate column to public.events (defaults to TRUE)
--  2. Updates public.certificates table to snapshot attendee_name, event_title, event_date
--  3. Adds email_sent_at timestamp to certificates table for email delivery tracking
--  4. Adds unique constraint on (event_id, user_id) to prevent duplicate certificates
--  5. Updates issue_certificate_on_checkin trigger function to snapshot details & respect generates_certificate
--  6. Triggers async generate-event-certs Edge Function via pg_net HTTP POST upon check-in
-- ============================================================

-- Safely attempt to enable pg_net extension if available
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 1. Add generates_certificate column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS generates_certificate BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.generates_certificate IS 
'Determines if attendance certificates are automatically generated for checked-in attendees.';

-- 2. Add snapshotted detail columns to certificates table if they do not exist
ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS attendee_name TEXT;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS event_title TEXT;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.certificates.attendee_name IS 
'Snapshotted name of the attendee at certificate issuance time.';

COMMENT ON COLUMN public.certificates.event_title IS 
'Snapshotted title of the event at certificate issuance time.';

COMMENT ON COLUMN public.certificates.event_date IS 
'Snapshotted date of the event at certificate issuance time.';

COMMENT ON COLUMN public.certificates.email_sent_at IS 
'Timestamp when the certificate delivery email was dispatched to the attendee.';

-- 3. Prevent duplicate certificates for the same attendee and event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'certificates_event_id_user_id_key' 
       OR conname = 'unique_event_user_certificate'
  ) THEN
    ALTER TABLE public.certificates 
    ADD CONSTRAINT unique_event_user_certificate UNIQUE (event_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certificates_event_user 
ON public.certificates (event_id, user_id);

-- 4. Update database trigger function to check generates_certificate, snapshot details, & invoke Edge Function
CREATE OR REPLACE FUNCTION public.issue_certificate_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title TEXT;
  v_event_date TIMESTAMPTZ;
  v_generates_cert BOOLEAN;
  v_first_name TEXT;
  v_last_name TEXT;
  v_attendee_name TEXT;
  v_function_url TEXT := 'http://localhost:54321/functions/v1/generate-event-certs';
  v_payload JSONB;
BEGIN
  -- Fetch event configuration and snapshot details
  SELECT title, COALESCE(event_date, start_date), COALESCE(generates_certificate, TRUE)
  INTO v_event_title, v_event_date, v_generates_cert
  FROM public.events
  WHERE id = NEW.event_id;

  -- Skip certificate issuance if event does not generate certificates
  IF v_generates_cert IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Fetch attendee profile name for snapshotting
  SELECT first_name, last_name
  INTO v_first_name, v_last_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_attendee_name := TRIM(CONCAT(COALESCE(v_first_name, ''), ' ', COALESCE(v_last_name, '')));
  IF v_attendee_name IS NULL OR v_attendee_name = '' THEN
    v_attendee_name := 'Student';
  END IF;

  -- Insert a certificate record with snapshotted values if one does not already exist (Idempotent)
  INSERT INTO public.certificates (
    event_id,
    user_id,
    attendee_name,
    event_title,
    event_date,
    certificate_url
  )
  VALUES (
    NEW.event_id,
    NEW.user_id,
    v_attendee_name,
    COALESCE(v_event_title, 'Untitled Event'),
    COALESCE(v_event_date, NOW()),
    'pending'
  )
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Dispatch async HTTP webhook request to generate-event-certs Edge Function
  v_payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'event_rsvps',
    'record', jsonb_build_object(
      'event_id', NEW.event_id,
      'user_id', NEW.user_id
    )
  );

  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
      PERFORM net.http_post(
        url := v_function_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    ELSIF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
      PERFORM extensions.http_post(
        url := v_function_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Gracefully swallow webhook dispatch errors to prevent blocking check-in transaction
    NULL;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger AFTER UPDATE OF checked_in ON public.event_rsvps
DROP TRIGGER IF EXISTS trg_issue_certificate_on_checkin ON public.event_rsvps;

CREATE TRIGGER trg_issue_certificate_on_checkin
AFTER UPDATE OF checked_in ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.checked_in IS DISTINCT FROM TRUE AND NEW.checked_in = TRUE)
EXECUTE FUNCTION public.issue_certificate_on_checkin();
