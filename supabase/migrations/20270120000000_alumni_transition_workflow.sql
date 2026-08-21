-- Migration: 20270120000000_alumni_transition_workflow.sql
-- Description: Implement Automated Post-Graduation Alumni Transition Workflow (#3613).

-- 1. Add expected_graduation_date to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS expected_graduation_date DATE DEFAULT NULL;

-- 2. Create archived_rsvps table (Read-only vault)
CREATE TABLE IF NOT EXISTS public.archived_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT,
    checked_in BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.archived_rsvps ENABLE ROW LEVEL SECURITY;

-- Read-only policy: Users can only select their own archived RSVPs (no INSERT/UPDATE/DELETE policies, keeping it read-only)
DROP POLICY IF EXISTS "Users can select their own archived RSVPs." ON public.archived_rsvps;
CREATE POLICY "Users can select their own archived RSVPs." ON public.archived_rsvps
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Create transition processing function
CREATE OR REPLACE FUNCTION public.process_graduating_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT id, first_name, last_name, email
        FROM public.profiles
        WHERE role = 'student'::public.user_role
          AND expected_graduation_date IS NOT NULL
          AND NOW()::DATE >= expected_graduation_date
    LOOP
        -- A. Transition user profile role to alumni
        UPDATE public.profiles
        SET role = 'alumni'::public.user_role,
            updated_at = NOW()
        WHERE id = r.id;

        -- B. Strip undergraduate administrative/executive roles from club memberships
        DELETE FROM public.club_members
        WHERE user_id = r.id;

        -- C. Archive undergraduate event RSVPs into read-only vault
        -- Copy to archived_rsvps
        INSERT INTO public.archived_rsvps (
            id, event_id, user_id, status, checked_in, created_at
        )
        SELECT 
            id, event_id, user_id, status, checked_in, created_at
        FROM public.event_rsvps
        WHERE user_id = r.id;

        -- Delete from active event_rsvps
        DELETE FROM public.event_rsvps
        WHERE user_id = r.id;

        -- D. Send automated congratulatory notification (simulating graduation email)
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            link
        ) VALUES (
            r.id,
            'graduation_congratulations',
            'Happy Graduation! 🎓',
            'Your account has been migrated to the Alumni Network. Click here to mentor a current student.',
            '/mentorship-dashboard'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_graduating_users() TO authenticated, service_role;

-- 4. Schedule monthly pg_cron job if pg_cron extension is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing schedule if any to prevent duplicates
        PERFORM cron.unschedule('process-graduating-users-monthly');
        
        -- Schedule monthly on the 1st
        PERFORM cron.schedule(
            'process-graduating-users-monthly',
            '0 0 1 * *',
            'SELECT public.process_graduating_users();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Prevent failure in sandboxed tests without pg_cron schema privileges
    NULL;
END $$;
