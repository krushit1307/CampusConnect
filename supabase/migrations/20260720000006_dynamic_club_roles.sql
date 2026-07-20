-- 1. Create the new dynamic roles table
CREATE TABLE club_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  permissions_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, title),
  UNIQUE(id, club_id) -- Required for the composite foreign key
);

CREATE INDEX idx_club_roles_club_id ON club_roles(club_id);

ALTER TABLE club_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read club roles." ON club_roles FOR SELECT USING (true);


-- 2. Add the new role_id column and link it safely
ALTER TABLE club_members ADD COLUMN role_id UUID;

ALTER TABLE club_members
ADD CONSTRAINT fk_club_members_role 
FOREIGN KEY (role_id, club_id) 
REFERENCES club_roles(id, club_id) 
ON DELETE RESTRICT;


-- 3. DATA MIGRATION: Create default roles for existing clubs
INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Admin', 100 FROM clubs;

INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Member', 10 FROM clubs;


-- 4. DATA MIGRATION: Map existing users to their new roles
UPDATE club_members cm SET role_id = cr.id FROM club_roles cr 
WHERE cm.club_id = cr.club_id AND cr.title = 'Admin' AND cm.role::text = 'admin';

UPDATE club_members cm SET role_id = cr.id FROM club_roles cr 
WHERE cm.club_id = cr.club_id AND cr.title = 'Member' AND cm.role::text = 'member';


-- 5. TRIGGER: Auto-assign 'Member' role to future inserts missing a role_id
CREATE OR REPLACE FUNCTION public.assign_default_club_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    SELECT id INTO NEW.role_id
    FROM public.club_roles
    WHERE club_id = NEW.club_id AND title = 'Member'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_club_member_inserted
BEFORE INSERT ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_club_role();

-- Now enforce NOT NULL since existing and future data is covered
ALTER TABLE club_members ALTER COLUMN role_id SET NOT NULL;


-- 6. RECREATE DEPENDENCIES: Update functions and policies before dropping old enum
-- A. Update the is_club_admin function to use the new permissions_level (Using $1 and $2 to avoid renaming errors)
CREATE OR REPLACE FUNCTION public.is_club_admin(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM club_members cm
    JOIN club_roles cr ON cm.role_id = cr.id
    WHERE cm.club_id = $1 
      AND cm.user_id = $2 
      AND cr.permissions_level >= 100
      AND cm.status = 'approved'
  );
$$;

-- B. Update club_members RLS policy
DROP POLICY IF EXISTS "Admins can update members." ON club_members;
CREATE POLICY "Admins can update members." ON club_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM club_members admin_members 
    JOIN club_roles cr ON admin_members.role_id = cr.id
    WHERE admin_members.club_id = club_members.club_id 
      AND admin_members.user_id = auth.uid() 
      AND cr.permissions_level >= 100 
      AND admin_members.status = 'approved'
  ) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND created_by = auth.uid())
);

-- C. Update event_rsvps policy
DROP POLICY IF EXISTS "Club admins can update RSVP check in." ON event_rsvps;
CREATE POLICY "Club admins can update RSVP check in." ON event_rsvps FOR UPDATE USING (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_rsvps.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);

-- D. Update club_invite_codes policies
DROP POLICY IF EXISTS "Club admins can create invite codes." ON club_invite_codes;
CREATE POLICY "Club admins can create invite codes." ON club_invite_codes FOR INSERT WITH CHECK (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_invite_codes.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update invite codes." ON club_invite_codes;
CREATE POLICY "Club admins can update invite codes." ON club_invite_codes FOR UPDATE USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_invite_codes.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can delete invite codes." ON club_invite_codes;
CREATE POLICY "Club admins can delete invite codes." ON club_invite_codes FOR DELETE USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_invite_codes.club_id AND created_by = auth.uid())
);


-- 7. CLEANUP: Remove the old enum safely using RESTRICT
ALTER TABLE club_members ALTER COLUMN role DROP DEFAULT;

-- This will now succeed!
ALTER TABLE club_members DROP COLUMN role RESTRICT;
DROP TYPE member_role RESTRICT;
