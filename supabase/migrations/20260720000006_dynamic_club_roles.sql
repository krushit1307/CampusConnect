CREATE TABLE club_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  permissions_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, title)
);

CREATE INDEX idx_club_roles_club_id ON club_roles(club_id);

ALTER TABLE club_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read club roles." ON club_roles FOR SELECT USING (true);


ALTER TABLE club_members
ADD COLUMN role_id UUID REFERENCES club_roles(id) ON DELETE SET NULL;


-- We will use permission level 100 for Admins and 10 for Members
INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Admin', 100 FROM clubs;

INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Member', 10 FROM clubs;


-- Link existing admins
UPDATE club_members cm
SET role_id = cr.id
FROM club_roles cr
WHERE cm.club_id = cr.club_id 
  AND cr.title = 'Admin' 
  AND cm.role::text = 'admin';

-- Link existing members
UPDATE club_members cm
SET role_id = cr.id
FROM club_roles cr
WHERE cm.club_id = cr.club_id 
  AND cr.title = 'Member' 
  AND cm.role::text = 'member';


-- Remove the default constraint first, otherwise the column drop will fail
ALTER TABLE club_members ALTER COLUMN role DROP DEFAULT;

-- Drop the old column safely
ALTER TABLE club_members DROP COLUMN role CASCADE;

-- Drop the old enum type completely
DROP TYPE member_role CASCADE;