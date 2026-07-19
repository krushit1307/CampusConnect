CREATE TABLE IF NOT EXISTS saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'saved_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE saved_events;
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can read own saved events." ON saved_events;
CREATE POLICY "Users can read own saved events." ON saved_events 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save events." ON saved_events;
CREATE POLICY "Users can save events." ON saved_events 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave events." ON saved_events;
CREATE POLICY "Users can unsave events." ON saved_events 
  FOR DELETE USING (auth.uid() = user_id);

-- Backfill any missing profiles for existing authenticated users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
