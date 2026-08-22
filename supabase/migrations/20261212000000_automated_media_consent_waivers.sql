-- Issue #3893: Automated Media Consent Waivers

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS has_photography BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS no_media_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_has_photography
  ON public.events (has_photography)
  WHERE has_photography = TRUE;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_no_media_consent
  ON public.event_rsvps (event_id, no_media_consent)
  WHERE no_media_consent = TRUE;

COMMENT ON COLUMN public.events.has_photography IS
  'Whether event photography or filming is planned and RSVP media consent must be collected.';

COMMENT ON COLUMN public.event_rsvps.no_media_consent IS
  'True when this ticket holder declined event photography; door staff should issue a red wristband.';
