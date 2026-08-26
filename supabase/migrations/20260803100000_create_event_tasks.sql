-- Create event_tasks table for Gantt chart management
CREATE TABLE IF NOT EXISTS event_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  dependencies UUID[] DEFAULT '{}',
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_dates ON event_tasks(start_date, end_date);

-- Enable RLS
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Viewable by anyone who can view the event (public event or club member)
CREATE POLICY "Event tasks are viewable by everyone" ON event_tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_tasks.event_id
  )
);

-- Policy: Event tasks can be created by club members of the event host club
CREATE POLICY "Club members can insert event tasks" ON event_tasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    JOIN club_members cm ON cm.club_id = e.club_id
    WHERE e.id = event_tasks.event_id AND cm.user_id = auth.uid()
  )
);

-- Policy: Club members can update event tasks
CREATE POLICY "Club members can update event tasks" ON event_tasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN club_members cm ON cm.club_id = e.club_id
    WHERE e.id = event_tasks.event_id AND cm.user_id = auth.uid()
  )
);

-- Policy: Club admins can delete event tasks
CREATE POLICY "Club admins can delete event tasks" ON event_tasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_tasks.event_id AND public.is_club_admin(e.club_id, auth.uid())
  )
);

-- Trigger for auto updated_at
CREATE TRIGGER trg_update_event_tasks_updated_at
  BEFORE UPDATE ON event_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
