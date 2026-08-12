-- Migration: 20260802000000_club_member_permissions.sql
-- Description: Add granular permission columns to club_members table for role management

-- Add permission columns to club_members table
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS can_edit_events BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_manage_finance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_remove_members BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_post_news BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_manage_permissions BOOLEAN DEFAULT FALSE;

-- Update existing admins to have all permissions by default
UPDATE club_members 
SET 
  can_edit_events = TRUE,
  can_manage_finance = TRUE,
  can_remove_members = TRUE,
  can_post_news = TRUE,
  can_manage_permissions = TRUE
WHERE role = 'admin' AND status = 'approved';

-- Add comment to document the permission system
COMMENT ON COLUMN club_members.can_edit_events IS 'Permission to create, edit, and delete club events';
COMMENT ON COLUMN club_members.can_manage_finance IS 'Permission to access and manage club financial information';
COMMENT ON COLUMN club_members.can_remove_members IS 'Permission to remove members from the club';
COMMENT ON COLUMN club_members.can_post_news IS 'Permission to create and post news/updates for the club';
COMMENT ON COLUMN club_members.can_manage_permissions IS 'Permission to manage other members'' permissions (should prevent self-lockout)';
