-- Migration: Add bulk_approve_members SECURITY DEFINER RPC function
-- Issue: #599
-- Description: Allows club admins to accept pending club membership join requests in bulk via a single RPC call.

CREATE OR REPLACE FUNCTION public.bulk_approve_members(
  club_id UUID,
  user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify that auth.uid() is an admin or creator of the specified club_id
  IF NOT (
    public.is_club_admin(club_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND created_by = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not an admin of this club'
      USING ERRCODE = '42501';
  END IF;

  -- Update status to 'approved' for matching club_id and pending user_ids
  UPDATE public.club_members
  SET status = 'approved'::join_status
  WHERE club_members.club_id = bulk_approve_members.club_id
    AND club_members.user_id = ANY(bulk_approve_members.user_ids)
    AND club_members.status = 'pending'::join_status;
END;
$$;

-- Explicit permissions
REVOKE ALL ON FUNCTION public.bulk_approve_members(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_approve_members(UUID, UUID[]) TO authenticated;
