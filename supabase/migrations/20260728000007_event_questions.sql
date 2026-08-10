CREATE TABLE event_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'answering_now', 'answered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_questions_event_id ON event_questions(event_id);

ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can read the live queue
CREATE POLICY "Anyone can read event questions." ON event_questions FOR SELECT USING (true);

-- Attendees can submit their own question
CREATE POLICY "Users can submit questions." ON event_questions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only the organizer (club admin or club creator) can change status (e.g. spotlight a question)
CREATE POLICY "Organizers can update question status." ON event_questions FOR UPDATE USING (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_questions.event_id), auth.uid())
  OR EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_questions.event_id) AND created_by = auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE event_questions;