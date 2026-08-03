-- Create task status enum
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo'::task_status,
  order_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_tasks_club_id_status_order ON tasks(club_id, status, order_index);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view tasks of public clubs or clubs they are members of
CREATE POLICY "Tasks are viewable by club members and public clubs" ON tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clubs 
    WHERE id = tasks.club_id 
    AND (
      visibility = 'public' 
      OR EXISTS (
        SELECT 1 FROM club_members 
        WHERE club_id = tasks.club_id AND user_id = auth.uid()
      )
    )
  )
);

-- Policy: Club members can insert tasks
CREATE POLICY "Club members can insert tasks" ON tasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_id = tasks.club_id AND user_id = auth.uid()
  )
);

-- Policy: Club members can update tasks
CREATE POLICY "Club members can update tasks" ON tasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_id = tasks.club_id AND user_id = auth.uid()
  )
);

-- Policy: Club admins can delete tasks
CREATE POLICY "Club admins can delete tasks" ON tasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_id = tasks.club_id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER trg_update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
