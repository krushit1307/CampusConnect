-- Add permissions_mask integer column to club_members
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS permissions_mask INTEGER DEFAULT 0 NOT NULL;

-- Helper SQL function for bitwise permission check inside RLS/Queries
CREATE OR REPLACE FUNCTION has_club_permission(mask INTEGER, required_permission INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (mask & required_permission) = required_permission;
END;
$$ LANGUAGE plpgsql IMMUTABLE;