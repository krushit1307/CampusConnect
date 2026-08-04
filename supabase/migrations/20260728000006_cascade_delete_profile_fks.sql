-- Ensure deleting a profile cascades safely through clubs, events, and polls
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_created_by_fkey;
ALTER TABLE clubs
  ADD CONSTRAINT clubs_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
ALTER TABLE polls
  ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;