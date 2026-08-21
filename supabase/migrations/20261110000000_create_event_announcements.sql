-- supabase/migrations/20261110000000_create_event_announcements.sql

CREATE TABLE event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'high',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE event_announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access to event announcements"
  ON event_announcements
  FOR SELECT
  USING (true);

-- Allow organizers to insert
CREATE POLICY "Organizers can broadcast announcements"
  ON event_announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND e.organizer_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE event_announcements;
