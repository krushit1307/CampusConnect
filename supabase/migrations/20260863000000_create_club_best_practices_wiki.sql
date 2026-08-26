-- 1. Create club_wiki table to store AI-synthesized leadership manuals
CREATE TABLE IF NOT EXISTS club_wiki (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    semester_label TEXT NOT NULL,
    wiki_markdown TEXT NOT NULL,
    extracted_insights_count INTEGER DEFAULT 0 NOT NULL,
    processed_post_mortems_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(club_id, semester_label)
);

-- Index for dashboard retrieval
CREATE INDEX IF NOT EXISTS idx_club_wiki_club ON club_wiki(club_id, created_at DESC);

-- Enable RLS
ALTER TABLE club_wiki ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Club members can view the club wiki; officers/presidents can update
CREATE POLICY "Club members can view best practices wiki"
    ON club_wiki FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM club_memberships cm
            WHERE cm.club_id = club_wiki.club_id AND cm.user_id = auth.uid()
        )
    );