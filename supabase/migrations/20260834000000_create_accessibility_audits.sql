-- Create event_accessibility_audits table
CREATE TABLE IF NOT EXISTS event_accessibility_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for rapid lookup by event ID and completion status
CREATE INDEX IF NOT EXISTS idx_accessibility_audits_event ON event_accessibility_audits(event_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_audits_completed ON event_accessibility_audits(is_completed);

-- Enable Row Level Security
ALTER TABLE event_accessibility_audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view completed accessibility audits"
    ON event_accessibility_audits FOR SELECT
    USING (true);

CREATE POLICY "Organizers can update their event accessibility audits"
    ON event_accessibility_audits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_accessibility_audits.event_id
              AND e.organizer_id = auth.uid()
        )
    );