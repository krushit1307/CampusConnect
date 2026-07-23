-- Create enums for reports
CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'user');
CREATE TYPE report_status AS ENUM ('pending', 'resolved');

-- Create reports table
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type  report_target_type NOT NULL,
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  status       report_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_type, target_id)
);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit reports
DROP POLICY IF EXISTS "Users can insert reports." ON reports;

CREATE POLICY "Users can insert reports." ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Reporters can view their own reports
DROP POLICY IF EXISTS "Users can view own reports." ON reports;

CREATE POLICY "Users can view own reports." ON reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- System admins can view all reports
DROP POLICY IF EXISTS "System admins can view all reports." ON reports;

CREATE POLICY "System admins can view all reports." ON reports
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- System admins can update reports
DROP POLICY IF EXISTS "System admins can update reports." ON reports;

CREATE POLICY "System admins can update reports." ON reports
  FOR UPDATE TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());