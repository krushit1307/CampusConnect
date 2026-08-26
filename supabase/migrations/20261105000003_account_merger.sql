-- =============================================================================
-- Migration: Automated User Account Merger
-- Issue: #3560 - Implement 'Automated User Account Merger'
-- Description: Creates a highly sensitive Postgres RPC to securely merge two
-- user accounts. Handles unique constraints gracefully by dropping duplicate
-- records before updating foreign keys in an atomic transaction.
-- =============================================================================
-- 1. RPC: Merge User Accounts
CREATE OR REPLACE FUNCTION public.merge_user_accounts(
        p_primary_user_id UUID,
        p_secondary_user_id UUID
    ) RETURNS BOOLEAN AS $$
DECLARE v_table_name TEXT;
v_conflict_count INT;
BEGIN -- Security check: Ensure the caller is the primary user or an admin
IF auth.uid() <> p_primary_user_id
AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
        AND role = 'admin'
) THEN RAISE EXCEPTION 'Unauthorized: You can only merge your own accounts.';
END IF;
-- Prevent merging an account with itself
IF p_primary_user_id = p_secondary_user_id THEN RAISE EXCEPTION 'Cannot merge an account with itself.';
END IF;
-- Begin atomic transaction
-- 1. Handle event_rsvps (Unique constraint on event_id, user_id)
-- Delete RSVPs from the secondary account if the primary account already has an RSVP for the same event
DELETE FROM public.event_rsvps
WHERE user_id = p_secondary_user_id
    AND event_id IN (
        SELECT event_id
        FROM public.event_rsvps
        WHERE user_id = p_primary_user_id
    );
-- Update remaining RSVPs to point to the primary account
UPDATE public.event_rsvps
SET user_id = p_primary_user_id
WHERE user_id = p_secondary_user_id;
-- 2. Handle gamification_points (Assuming unique constraint on user_id, activity_type, reference_id)
DELETE FROM public.gamification_points
WHERE user_id = p_secondary_user_id
    AND (activity_type, reference_id) IN (
        SELECT activity_type,
            reference_id
        FROM public.gamification_points
        WHERE user_id = p_primary_user_id
    );
UPDATE public.gamification_points
SET user_id = p_primary_user_id
WHERE user_id = p_secondary_user_id;
-- 3. Handle club_members (Unique constraint on club_id, user_id)
DELETE FROM public.club_members
WHERE user_id = p_secondary_user_id
    AND club_id IN (
        SELECT club_id
        FROM public.club_members
        WHERE user_id = p_primary_user_id
    );
UPDATE public.club_members
SET user_id = p_primary_user_id
WHERE user_id = p_secondary_user_id;
-- 4. Handle user_notifications
UPDATE public.notifications
SET user_id = p_primary_user_id
WHERE user_id = p_secondary_user_id;
-- 5. Handle user_created_events (Transfer ownership)
UPDATE public.events
SET created_by = p_primary_user_id
WHERE created_by = p_secondary_user_id;
-- 6. Delete the secondary user's profile and auth record
-- Note: Deleting from auth.users requires the supabase_auth_admin role or a trigger.
-- For this migration, we delete the public profile. The auth user deletion should be
-- handled by the application logic via the Supabase Admin API after this RPC succeeds.
DELETE FROM public.profiles
WHERE id = p_secondary_user_id;
RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
