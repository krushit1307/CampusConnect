-- Create event_resources table
CREATE TABLE IF NOT EXISTS event_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf', 'link', 'video')),
    is_private BOOLEAN DEFAULT FALSE NOT NULL, -- If true, restricted to verified attendees
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast resource lookup by event
CREATE INDEX IF NOT EXISTS idx_event_resources_event ON event_resources(event_id);

-- Enable RLS
ALTER TABLE event_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public resources are readable by everyone; private resources require 'attending' RSVP status
CREATE POLICY "Public resources are viewable by anyone"
    ON event_resources FOR SELECT
    USING (
        is_private = FALSE
        OR EXISTS (
            SELECT 1 FROM rsvps r
            WHERE r.event_id = event_resources.event_id
              AND r.user_id = auth.uid()
              AND r.status = 'attending'
        )
    );

CREATE POLICY "Organizers can manage event resources"
    ON event_resources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_resources.event_id
              AND e.organizer_id = auth.uid()
        )
    );