-- 1. Create event_recap_reports table
CREATE TABLE IF NOT EXISTS event_recap_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    total_rsvps INTEGER DEFAULT 0 NOT NULL,
    actual_checkins INTEGER DEFAULT 0 NOT NULL,
    turnout_percentage NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    points_awarded INTEGER DEFAULT 0 NOT NULL,
    budget_spent NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    top_photos JSONB DEFAULT '[]'::jsonb NOT NULL,
    ai_summary TEXT NOT NULL,
    pdf_report_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id)
);
-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_recap_reports_event ON event_recap_reports(event_id);
-- Enable RLS
ALTER TABLE event_recap_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Club organizers can generate and view recap reports
CREATE POLICY "Organizers can access event recap reports"
    ON event_recap_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = event_recap_reports.event_id
              AND eo.user_id = auth.uid()
        )
    );