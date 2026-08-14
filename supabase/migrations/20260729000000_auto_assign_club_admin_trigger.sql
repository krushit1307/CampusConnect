-- Migration: Auto-assign club creator as admin
-- Description:
-- Automatically creates an approved admin membership whenever
-- a new club is created. This ensures the club creator can
-- immediately manage the club without relying on frontend logic.

-- Clean up old objects if they exist
DROP TRIGGER IF EXISTS trg_auto_assign_club_admin ON public.clubs;
DROP FUNCTION IF EXISTS public.handle_new_club_admin() CASCADE;

-- Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_club_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.club_members (
        club_id,
        user_id,
        role,
        status
    )
    VALUES (
        NEW.id,
        NEW.created_by,
        'admin',
        'approved'
    )
    ON CONFLICT (club_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trg_auto_assign_club_admin
AFTER INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_club_admin();
