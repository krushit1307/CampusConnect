-- Live Polls for Event Presentations

-- 1. Tables

CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  question TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 2. Indexes

CREATE INDEX idx_polls_event_id ON polls(event_id);
CREATE INDEX idx_polls_event_id_active ON polls(event_id) WHERE is_active = TRUE;
CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_poll_id_user_id ON poll_votes(poll_id, user_id);

-- 3. RLS

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- polls: anyone can read, only event organizer can insert/update
CREATE POLICY "Polls are viewable by everyone."
  ON polls FOR SELECT
  USING (true);

CREATE POLICY "Event organizers can create polls."
  ON polls FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND (
      public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
      EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
    )
  );

CREATE POLICY "Event organizers can manage polls."
  ON polls FOR UPDATE
  USING (
    public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
    EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
    EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
  );

-- poll_options: anyone can read, only poll creator can insert/delete
CREATE POLICY "Poll options are viewable by everyone."
  ON poll_options FOR SELECT
  USING (true);

CREATE POLICY "Poll creators can insert options."
  ON poll_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_id AND polls.created_by = auth.uid()
    )
  );

CREATE POLICY "Poll creators can delete options."
  ON poll_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_id AND polls.created_by = auth.uid()
    )
  );

-- poll_votes: users can read all votes, insert own, delete own
CREATE POLICY "Poll votes are viewable by everyone."
  ON poll_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can cast their own vote."
  ON poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote."
  ON poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Realtime publication

ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
