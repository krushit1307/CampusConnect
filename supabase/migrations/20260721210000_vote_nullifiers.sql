-- Create table to track used nullifier hashes for anonymous voting
CREATE TABLE IF NOT EXISTS vote_nullifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id TEXT NOT NULL,
  nullifier_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, nullifier_hash)
);

-- Enable RLS
ALTER TABLE vote_nullifiers ENABLE ROW LEVEL SECURITY;

-- Create policy for Edge Functions / Service Role to manage nullifiers
CREATE POLICY "Service role can manage vote_nullifiers" ON vote_nullifiers
  FOR ALL USING (auth.role() = 'service_role');
