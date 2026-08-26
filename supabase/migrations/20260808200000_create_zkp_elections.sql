-- ZKP Anonymous Elections Schema Migration

-- 1. Create elections table
CREATE TABLE IF NOT EXISTS elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create eligible_voters table
CREATE TABLE IF NOT EXISTS eligible_voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  commitment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  nullifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(election_id, nullifier)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_eligible_voters_election_id ON eligible_voters(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_election_id_nullifier ON votes(election_id, nullifier);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligible_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS policies
DROP POLICY IF EXISTS "Elections are viewable by everyone" ON elections;
CREATE POLICY "Elections are viewable by everyone" ON elections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Eligible voters are viewable by everyone" ON eligible_voters;
CREATE POLICY "Eligible voters are viewable by everyone" ON eligible_voters FOR SELECT USING (true);

DROP POLICY IF EXISTS "Votes are viewable by everyone" ON votes;
CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);
