-- =============================================================================
-- Migration: GDPR Interactive Deletion Request ("Right to be Forgotten")
-- Issue: #3191 - GDPR Data Deletion Portal
-- Description:
--   1. Postgres RPC `delete_user_data(target_user_id)` to handle massive cascade
--      deletion or anonymization across the tables.
--   2. Strict validation check for sole club ownership (prevents orphaning clubs).
--   3. Anonymization of forum posts (sets user_id = NULL and author_name = '[Deleted User]').
--   4. Scrubbing of transactions table: preserves monetary amount for audit/ledger,
--      but clears PII columns (user_id/description/etc.).
--   5. Physical user profile deletion.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_orphaned_club_name TEXT;
    v_has_sole_ownership BOOLEAN;
BEGIN
    -- 1. Check if the user is the sole President of any active club
    -- Under RBAC schema, club_roles links to public.club_roles and club_members.role_id links to it.
    -- If a user is the owner of a club (clubs.created_by = target_user_id) or holds the 'President' role
    -- and there are no other approved members holding the 'President' role in that club.
    SELECT c.name INTO v_orphaned_club_name
    FROM public.clubs c
    WHERE c.deleted_at IS NULL AND (
        -- User is creator and the only approved member
        (c.created_by = target_user_id AND NOT EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = c.id AND cm.user_id != target_user_id AND cm.status = 'approved'
        ))
        OR
        -- User is the ONLY President role holder
        EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.club_roles cr ON cm.role_id = cr.id
            WHERE cm.club_id = c.id AND cm.user_id = target_user_id AND cr.name = 'President' AND cm.status = 'approved'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.club_roles cr ON cm.role_id = cr.id
            WHERE cm.club_id = c.id AND cm.user_id != target_user_id AND cr.name = 'President' AND cm.status = 'approved'
        )
    )
    LIMIT 1;

    IF v_orphaned_club_name IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete account. You are the sole President of club: %. Please transition leadership first.', v_orphaned_club_name;
    END IF;

    -- 2. Anonymize Forum Posts (posts)
    -- Do not delete the rows to prevent breaking threaded conversations, set author_id = NULL
    -- NOTE: In schema.sql, public.posts has author_id (UUID references profiles(id) ON DELETE SET NULL).
    -- We can also check comments table which has author_id.
    UPDATE public.posts
    SET author_id = NULL,
        content = '[Deleted User]: ' || COALESCE(content, '')
    WHERE author_id = target_user_id;

    UPDATE public.comments
    SET author_id = NULL,
        content = '[Deleted User]: ' || COALESCE(content, '')
    WHERE author_id = target_user_id;

    -- 3. Scrub Transactions Table
    -- Preserves the financial ledger/monetary values but scrubs PII.
    -- The financial ledger is in the transactions table (public.transactions).
    -- Let's scrub created_by and description.
    UPDATE public.transactions
    SET created_by = NULL,
        description = 'PII Scrubbed (GDPR Deletion Request)'
    WHERE created_by = target_user_id;

    -- For club_transactions (if any reference user_id directly; none do, but let's check created_by if it exists, or just in case)
    -- As seen in create_club_finances, club_transactions does not link to profiles/users table directly, only to clubs.

    -- 4. Cascading delete from other relational tables
    -- Deletes are safe and will cascade automatically to:
    --   - club_members (due to ON DELETE CASCADE)
    --   - event_rsvps (due to ON DELETE CASCADE)
    --   - event_waitlist (due to ON DELETE CASCADE)
    --   - likes (due to ON DELETE CASCADE)
    --   - saved_events (due to ON DELETE CASCADE)
    --   - notifications (due to ON DELETE CASCADE)
    --   - user_public_keys (due to ON DELETE CASCADE)
    --   - direct_messages (due to ON DELETE CASCADE)
    -- Let's run manual DELETEs on tables that might NOT have cascade to be absolutely safe:
    DELETE FROM public.club_members WHERE user_id = target_user_id;
    DELETE FROM public.event_rsvps WHERE user_id = target_user_id;
    DELETE FROM public.event_waitlist WHERE user_id = target_user_id;
    DELETE FROM public.likes WHERE user_id = target_user_id;
    DELETE FROM public.saved_events WHERE user_id = target_user_id;
    DELETE FROM public.notifications WHERE user_id = target_user_id;
    DELETE FROM public.user_public_keys WHERE user_id = target_user_id;
    DELETE FROM public.direct_messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;

    -- 5. Delete physical user profile
    DELETE FROM public.profiles WHERE id = target_user_id;

END;
$$;
