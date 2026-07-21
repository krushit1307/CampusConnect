-- Migration: Prevent non-admins from pinning discussion posts
-- Adds pinned column to posts and enforces permissions via trigger.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.check_post_pin_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pinned = TRUE THEN
    -- Verify the user is an admin of the corresponding club or the club owner
    IF NOT (
      public.is_club_admin(NEW.club_id, auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = NEW.club_id AND created_by = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'Only club administrators can pin posts.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER before_post_pin_check
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.check_post_pin_permission();
