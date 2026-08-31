-- Issue #4837: Dynamic "Alumni Speaker" Automated NDA Signature
-- Adds NDA requirement flag to events and a table to track signature status
-- per attendee, gating RSVP/checkout finalization until signed.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS requires_signature boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_template_url text;

CREATE TABLE IF NOT EXISTS event_nda_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  envelope_id text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'completed', 'declined')),
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_nda_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own NDA signature status"
  ON event_nda_signatures FOR SELECT
  USING (auth.uid() = user_id);