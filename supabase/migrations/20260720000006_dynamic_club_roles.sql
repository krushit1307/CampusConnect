CREATE TABLE club_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  permissions_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, title),
  UNIQUE(id, club_id) 
);

CREATE INDEX idx_club_roles_club_id ON club_roles(club_id);

ALTER TABLE club_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read club roles." ON club_roles FOR SELECT USING (true);


ALTER TABLE club_members ADD COLUMN role_id UUID;

-- FIX 1: Use RESTRICT on the composite foreign key so we don't accidentally NULL the club_id
ALTER TABLE club_members
ADD CONSTRAINT fk_club_members_role 
FOREIGN KEY (role_id, club_id) 
REFERENCES club_roles(id, club_id) 
ON DELETE RESTRICT;


INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Admin', 100 FROM clubs;

INSERT INTO club_roles (club_id, title, permissions_level)
SELECT id, 'Member', 10 FROM clubs;


UPDATE club_members cm SET role_id = cr.id FROM club_roles cr 
WHERE cm.club_id = cr.club_id AND cr.title = 'Admin' AND cm.role::text = 'admin';

UPDATE club_members cm SET role_id = cr.id FROM club_roles cr 
WHERE cm.club_id = cr.club_id AND cr.title = 'Member' AND cm.role::text = 'member';


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

ALTER TABLE club_members ALTER COLUMN role_id SET NOT NULL;


CREATE OR REPLACE FUNCTION public.is_club_admin(check_club_id UUID, check_user_id UUID)
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
    WHERE cm.club_id = check_club_id 
      AND cm.user_id = check_user_id 
      AND cr.permissions_level >= 100
      AND cm.status = 'approved'
  );
$$;

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


ALTER TABLE club_members ALTER COLUMN role DROP DEFAULT;

-- By using RESTRICT instead of CASCADE, this will fail visibly if we missed any dependencies!
ALTER TABLE club_members DROP COLUMN role RESTRICT;
DROP TYPE member_role RESTRICT;