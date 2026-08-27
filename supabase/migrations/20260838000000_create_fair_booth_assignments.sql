-- Create fair_booth_assignments table
CREATE TABLE IF NOT EXISTS fair_booth_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    booth_label TEXT NOT NULL, -- e.g. 'Table 104' or 'A-12'
    pos_x NUMERIC(6,2) NOT NULL, -- Relative X coordinate percentage (0.00 to 100.00)
    pos_y NUMERIC(6,2) NOT NULL, -- Relative Y coordinate percentage (0.00 to 100.00)
    status TEXT DEFAULT 'AVAILABLE' NOT NULL CHECK (status IN ('AVAILABLE', 'BUSY', 'CLOSED')),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, booth_label)
);

-- Index for fast lookup by event and assigned club
CREATE INDEX IF NOT EXISTS idx_fair_booths_event ON fair_booth_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_fair_booths_club ON fair_booth_assignments(club_id);

-- Enable RLS
ALTER TABLE fair_booth_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view booth assignments"
    ON fair_booth_assignments FOR SELECT USING (true);

CREATE POLICY "Club reps or organizers can update booth status"
    ON fair_booth_assignments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM club_members cm
            WHERE cm.user_id = auth.uid()
              AND cm.club_id = fair_booth_assignments.club_id
              AND cm.status = 'ACTIVE'
        )
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = fair_booth_assignments.event_id
              AND e.organizer_id = auth.uid()
        )
    );