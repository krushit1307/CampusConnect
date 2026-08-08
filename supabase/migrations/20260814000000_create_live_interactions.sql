-- 1. Create table for live Q&A questions
CREATE TABLE IF NOT EXISTS event_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    question_text TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0 NOT NULL,
    is_answered BOOLEAN DEFAULT FALSE NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create table for live polls
CREATE TABLE IF NOT EXISTS event_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["Option A", "Option B"]
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create table for poll responses
CREATE TABLE IF NOT EXISTS event_poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES event_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    selected_option INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_poll_responses ENABLE ROW LEVEL SECURITY;

-- Allow read access for connected attendees
CREATE POLICY "Attendees can view event questions" ON event_questions FOR SELECT USING (true);
CREATE POLICY "Attendees can view event polls" ON event_polls FOR SELECT USING (true);
CREATE POLICY "Attendees can view poll responses" ON event_poll_responses FOR SELECT USING (true);

-- Enable Supabase Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE event_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE event_polls;