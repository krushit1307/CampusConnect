-- Migration: 20260729200000_merge_user_accounts_rpc.sql
-- Description: Creates a PostgreSQL function to securely merge two user accounts into one, handling uniqueness constraints gracefully.

CREATE OR REPLACE FUNCTION public.merge_user_accounts(primary_id UUID, secondary_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the caller is authenticated as the primary user
    -- SECURITY DEFINER bypasses RLS for the updates, so this check is crucial.
    IF auth.uid() IS NULL OR auth.uid() != primary_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller must be the primary user.';
    END IF;

    IF primary_id = secondary_id THEN
        RAISE EXCEPTION 'Cannot merge an account with itself.';
    END IF;

    -- Basic Updates (No UNIQUE user_id constraints)
    UPDATE public.clubs SET created_by = primary_id WHERE created_by = secondary_id;
    UPDATE public.clubs SET reviewed_by = primary_id WHERE reviewed_by = secondary_id;
    UPDATE public.events SET created_by = primary_id WHERE created_by = secondary_id;
    UPDATE public.posts SET author_id = primary_id WHERE author_id = secondary_id;
    UPDATE public.comments SET author_id = primary_id WHERE author_id = secondary_id;
    UPDATE public.certificates SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.notifications SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.audit_logs SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.event_attendance_logs SET recorded_by = primary_id WHERE recorded_by = secondary_id;
    UPDATE public.handle_history SET profile_id = primary_id WHERE profile_id = secondary_id;

    -- Updates with ON CONFLICT DO NOTHING (Tables with UNIQUE constraints)
    
    -- 1. club_members (UNIQUE: club_id, user_id)
    UPDATE public.club_members SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (club_id, user_id) DO NOTHING;

    -- 2. event_rsvps (UNIQUE: event_id, user_id)
    UPDATE public.event_rsvps SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 3. saved_events (UNIQUE: event_id, user_id)
    UPDATE public.saved_events SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 4. post_reactions (UNIQUE: post_id, user_id, emoji)
    UPDATE public.post_reactions SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (post_id, user_id, emoji) DO NOTHING;

    -- 5. profile_achievements (UNIQUE: profile_id, achievement_id)
    UPDATE public.profile_achievements SET profile_id = primary_id WHERE profile_id = secondary_id
    ON CONFLICT (profile_id, achievement_id) DO NOTHING;

    -- 6. event_waitlist (UNIQUE: event_id, user_id)
    UPDATE public.event_waitlist SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 7. event_feedbacks (UNIQUE: event_id, user_id)
    UPDATE public.event_feedbacks SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 8. daily_active_users (UNIQUE: user_id, activity_date)
    UPDATE public.daily_active_users SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (user_id, activity_date) DO NOTHING;

    -- 9. post_likes (UNIQUE: post_id, user_id)
    UPDATE public.post_likes SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (post_id, user_id) DO NOTHING;

    -- 10. reports (UNIQUE: reporter_id, target_type, target_id)
    UPDATE public.reports SET reporter_id = primary_id WHERE reporter_id = secondary_id
    ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING;

    -- Clean up leftover conflicting rows that ON CONFLICT DO NOTHING left behind.
    -- (This simulates the ON DELETE CASCADE that the hard-delete previously provided).
    DELETE FROM public.club_members WHERE user_id = secondary_id;
    DELETE FROM public.event_rsvps WHERE user_id = secondary_id;
    DELETE FROM public.saved_events WHERE user_id = secondary_id;
    DELETE FROM public.post_reactions WHERE user_id = secondary_id;
    DELETE FROM public.profile_achievements WHERE profile_id = secondary_id;
    DELETE FROM public.event_waitlist WHERE user_id = secondary_id;
    DELETE FROM public.event_feedbacks WHERE user_id = secondary_id;
    DELETE FROM public.daily_active_users WHERE user_id = secondary_id;
    DELETE FROM public.post_likes WHERE user_id = secondary_id;
    DELETE FROM public.reports WHERE reporter_id = secondary_id;

    -- Soft-delete the secondary profile
    UPDATE public.profiles SET deleted_at = NOW() WHERE id = secondary_id;

END;
$$;

-- Ensure authenticated users can call the function, but it relies on auth.uid() check inside
GRANT EXECUTE ON FUNCTION public.merge_user_accounts(UUID, UUID) TO authenticated;
