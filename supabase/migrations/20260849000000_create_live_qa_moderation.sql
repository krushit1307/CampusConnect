-- 1. Create live_questions table with moderation status enum
CREATE TABLE IF NOT EXISTS live_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    upvotes_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for real-time query filtering
CREATE INDEX IF NOT EXISTS idx_live_questions_event_status ON live_questions(event_id, status);

-- Enable RLS and Realtime
ALTER TABLE live_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public audience can ONLY read APPROVED questions
CREATE POLICY "Public audience can view approved live questions"
    ON live_questions FOR SELECT
    USING (
        status = 'approved' 
        OR auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = live_questions.event_id AND eo.user_id = auth.uid()
        )
    );

-- RLS Policy: Event moderators/organizers can update question status
CREATE POLICY "Moderators can update question moderation status"
    ON live_questions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = live_questions.event_id AND eo.user_id = auth.uid()
        )
    );