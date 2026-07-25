-- Create table for event attendance logs
CREATE TABLE event_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL
);

-- Adding indexes for performance
CREATE INDEX idx_event_attendance_logs_rsvp_id ON event_attendance_logs(rsvp_id);
CREATE INDEX idx_event_attendance_logs_recorded_by ON event_attendance_logs(recorded_by);

-- Enable RLS
ALTER TABLE event_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Setup basic RLS policies
CREATE POLICY "Club admins can view attendance logs." ON event_attendance_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM event_rsvps er
    JOIN events e ON e.id = er.event_id
    WHERE er.id = event_attendance_logs.rsvp_id 
      AND public.is_club_admin(e.club_id, auth.uid())
  )
);

CREATE POLICY "Admins can insert attendance logs." ON event_attendance_logs FOR INSERT WITH CHECK (
  auth.uid() = recorded_by
);
