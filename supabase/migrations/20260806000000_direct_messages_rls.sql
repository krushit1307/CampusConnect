-- Enable Row-Level Security on direct_messages table
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view their own sent or received messages
CREATE POLICY "Users can view their own messages"
ON direct_messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- INSERT Policy: Users can only send messages as themselves
CREATE POLICY "Users can insert messages as themselves"
ON direct_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- Admin Override Policy: Allow super administrators to view messages
CREATE POLICY "Admins bypass RLS"
ON direct_messages
FOR SELECT
USING (
  (auth.jwt() ->> 'role') = 'admin'
);