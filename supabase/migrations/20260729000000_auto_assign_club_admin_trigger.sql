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
DECLARE
    v_admin_role_id UUID;
BEGIN
    -- 1. Create the default roles for the new club
    INSERT INTO public.club_roles (club_id, title, permissions_level)
    VALUES 
        (NEW.id, 'Admin', 100),
        (NEW.id, 'Member', 10)
    ON CONFLICT (club_id, title) DO NOTHING;

    -- 2. Fetch the admin role ID
    SELECT id INTO v_admin_role_id
    FROM public.club_roles
    WHERE club_id = NEW.id AND title = 'Admin';

    -- 3. If created_by is NOT NULL, insert them as the approved admin member
    IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.club_members (
            club_id,
            user_id,
            role_id,
            status
        )
        VALUES (
            NEW.id,
            NEW.created_by,
            v_admin_role_id,
            'approved'
        )
        ON CONFLICT (club_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trg_auto_assign_club_admin
AFTER INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_club_admin();
