-- Step 1: Add soft delete column
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Step 2: Update SELECT RLS policies
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON clubs;
CREATE POLICY "Clubs are viewable by everyone." ON clubs FOR SELECT USING (deleted_at IS NULL);

-- Optional index for faster filtering
CREATE INDEX IF NOT EXISTS idx_clubs_deleted_at ON clubs(deleted_at);

-- Step 3: Remove CASCADE constraints from child tables referencing clubs
-- For club_members
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_club_id_fkey;
ALTER TABLE club_members ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT;

-- For events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_club_id_fkey;
ALTER TABLE events ADD CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT;

-- For posts
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_club_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE RESTRICT;
