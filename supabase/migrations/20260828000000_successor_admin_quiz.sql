-- Migration: Successor Admin Quiz
-- Description: Adds admin_pending state and trigger to intercept admin promotions

-- Add admin_pending to member_role enum
-- PostgreSQL ALTER TYPE ADD VALUE IF NOT EXISTS cannot be inside a transaction block 
-- if it was created in the same transaction block, but here it's fine. Supabase CLI handles it.
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'admin_pending';

-- Function to intercept admin promotions
CREATE OR REPLACE FUNCTION public.intercept_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Intercept any promotion to 'admin' unless they are already 'admin_pending'
  -- (which means they passed the quiz and are being finalized)
  IF OLD.role != 'admin_pending' AND NEW.role = 'admin' THEN
    NEW.role = 'admin_pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intercept_admin_promotion ON public.club_members;
CREATE TRIGGER trg_intercept_admin_promotion
BEFORE UPDATE OF role ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.intercept_admin_promotion();

-- RPC to pass the quiz
CREATE OR REPLACE FUNCTION public.pass_admin_quiz(club_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user has the admin_pending role in this club
  IF EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = club_id_param 
      AND user_id = auth.uid() 
      AND role = 'admin_pending'
  ) THEN
    -- Update role to admin. 
    -- The intercept trigger won't stop this because OLD.role = 'admin_pending'.
    UPDATE public.club_members
    SET role = 'admin'
    WHERE club_id = club_id_param AND user_id = auth.uid();
  ELSE
    RAISE EXCEPTION 'User is not in admin_pending state for this club';
  END IF;
END;
$$;
