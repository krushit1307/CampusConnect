-- Create saved_events junction table
CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own saved events"
  ON saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved events"
  ON saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved events"
  ON saved_events FOR DELETE
  USING (auth.uid() = user_id);

-- Add to publication for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE saved_events;
