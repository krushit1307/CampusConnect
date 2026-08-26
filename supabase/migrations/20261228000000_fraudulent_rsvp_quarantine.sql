-- =============================================================================
-- Migration: Automated "Fraudulent RSVP" Detection
-- Issue: #4252 - Implement 'Automated "Fraudulent RSVP" Detection'
-- Description: Adds 'quarantined' to event_rsvps status constraint.
-- =============================================================================

ALTER TABLE public.event_rsvps
    DROP CONSTRAINT IF EXISTS check_event_rsvps_status;

ALTER TABLE public.event_rsvps
    ADD CONSTRAINT check_event_rsvps_status
    CHECK (status IN ('attending', 'waitlisted', 'cancelled', 'swapping', 'quarantined', 'PAID'));

COMMENT ON COLUMN public.event_rsvps.status IS 'Status of the RSVP. "quarantined" marks suspected bots silently shadowed.';
