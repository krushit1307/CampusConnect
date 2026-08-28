-- Add emergency contact to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Create safety roll call tables
CREATE TABLE safety_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE safety_check_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_check_id UUID REFERENCES safety_checks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SAFE')),
  responded_at TIMESTAMPTZ,
  UNIQUE(safety_check_id, user_id)
);

-- Enable RLS
ALTER TABLE safety_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_check_responses ENABLE ROW LEVEL SECURITY;

-- Policies for safety_checks
CREATE POLICY "Public read safety_checks" ON safety_checks FOR SELECT USING (true);
CREATE POLICY "Organizers can insert safety_checks" ON safety_checks FOR INSERT WITH CHECK (true);

-- Policies for safety_check_responses
CREATE POLICY "Public read safety_check_responses" ON safety_check_responses FOR SELECT USING (true);
CREATE POLICY "Users can update their own response" ON safety_check_responses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Organizers can insert safety_check_responses" ON safety_check_responses FOR INSERT WITH CHECK (true);

-- Enable Realtime for safety_check_responses
ALTER PUBLICATION supabase_realtime ADD TABLE safety_check_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE safety_checks;
