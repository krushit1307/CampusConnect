-- Create volunteer_ledger table
CREATE TABLE volunteer_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    hours_credited NUMERIC(5,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_volunteer_ledger_user ON volunteer_ledger(user_id);
CREATE INDEX idx_volunteer_ledger_club ON volunteer_ledger(club_id);
CREATE INDEX idx_volunteer_ledger_status ON volunteer_ledger(status);

-- Enable RLS
ALTER TABLE volunteer_ledger ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own ledger entries
CREATE POLICY "Users can view their own ledger"
ON volunteer_ledger
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert pending ledger entries for themselves
CREATE POLICY "Users can insert their own pending ledger"
ON volunteer_ledger
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  status = 'pending'
);

-- Policy: Club admins can view ledger entries for their club
CREATE POLICY "Club admins can view their club ledger"
ON volunteer_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_members.club_id = volunteer_ledger.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = volunteer_ledger.club_id
    AND clubs.created_by = auth.uid()
  )
);

-- Policy: Club admins can insert/update ledger entries for their club (approve hours)
CREATE POLICY "Club admins can manage their club ledger"
ON volunteer_ledger
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_members.club_id = volunteer_ledger.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = volunteer_ledger.club_id
    AND clubs.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_members.club_id = volunteer_ledger.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = volunteer_ledger.club_id
    AND clubs.created_by = auth.uid()
  )
);
