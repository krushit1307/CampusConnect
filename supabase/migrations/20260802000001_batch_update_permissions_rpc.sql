-- Migration: 20260802000001_batch_update_permissions_rpc.sql
-- Description: Create RPC function for batch updating club member permissions

-- Create a custom type for permission updates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_update') THEN
    CREATE TYPE permission_update AS (
      member_id UUID,
      can_edit_events BOOLEAN,
      can_manage_finance BOOLEAN,
      can_remove_members BOOLEAN,
      can_post_news BOOLEAN,
      can_manage_permissions BOOLEAN
    );
  END IF;
END
$$;

-- Create the batch update function with authorization check
CREATE OR REPLACE FUNCTION batch_update_permissions(updates permission_update[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item permission_update;
  target_club_id UUID;
  caller_role TEXT;
BEGIN
  -- Process each update item
  FOREACH update_item IN ARRAY updates
  LOOP
    -- Resolve the club that this member belongs to
    SELECT club_id INTO target_club_id
    FROM club_members
    WHERE id = update_item.member_id;

    IF target_club_id IS NULL THEN
      RAISE EXCEPTION 'Member % not found', update_item.member_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Verify that the caller is an admin of that club
    SELECT role INTO caller_role
    FROM club_members
    WHERE club_id = target_club_id
      AND user_id = auth.uid()
      AND status = 'approved';

    IF caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: you must be a club admin to manage permissions'
        USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;

    -- Prevent callers from modifying their own permissions (self-lockout guard)
    IF EXISTS (
      SELECT 1 FROM club_members
      WHERE id = update_item.member_id
        AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Cannot modify your own permissions'
        USING ERRCODE = '42501';
    END IF;

    -- Apply the permission update
    UPDATE club_members
    SET
      can_edit_events      = update_item.can_edit_events,
      can_manage_finance   = update_item.can_manage_finance,
      can_remove_members   = update_item.can_remove_members,
      can_post_news        = update_item.can_post_news,
      can_manage_permissions = update_item.can_manage_permissions,
      updated_at           = NOW()
    WHERE id = update_item.member_id;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION batch_update_permissions(permission_update[]) TO authenticated;
