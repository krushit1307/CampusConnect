-- 1. Create event_messages table
CREATE TABLE IF NOT EXISTS event_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    message_text TEXT NOT NULL,
    is_announcement BOOLEAN DEFAULT FALSE NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for live chat feed retrieval
CREATE INDEX IF NOT EXISTS idx_event_messages_feed ON event_messages(event_id, created_at ASC);

-- Enable RLS & Realtime
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only checked-in or attending users can read event chat messages
CREATE POLICY "Attendees can view event chat messages"
    ON event_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rsvps r
            WHERE r.event_id = event_messages.event_id
              AND r.user_id = auth.uid()
              AND r.status IN ('attending', 'attended')
        )
    );

-- RLS Policy: Checked-in attendees can post regular messages; only organizers can post announcements
CREATE POLICY "Attendees and organizers can insert event messages"
    ON event_messages FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            is_announcement = FALSE
            OR EXISTS (
                SELECT 1 FROM event_organizers eo
                WHERE eo.event_id = event_messages.event_id AND eo.user_id = auth.uid()
            )
        )
    );