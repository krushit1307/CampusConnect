-- Unified bookmarks table (polymorphic via nullable FKs)
CREATE TABLE IF NOT EXISTS bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  post_id    UUID,
  club_id    UUID REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- exactly one FK must be set
  CONSTRAINT bookmarks_single_target CHECK (
    (event_id IS NOT NULL)::int +
    (post_id  IS NOT NULL)::int +
    (club_id  IS NOT NULL)::int = 1
  ),
  CONSTRAINT bookmarks_unique_event UNIQUE (user_id, event_id),
  CONSTRAINT bookmarks_unique_post  UNIQUE (user_id, post_id),
  CONSTRAINT bookmarks_unique_club  UNIQUE (user_id, club_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_select" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_insert" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookmarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks;
  END IF;
END $$;
