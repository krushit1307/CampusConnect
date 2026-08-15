-- Migration: bulk_email_queue
-- Description: Sets up the job queue table and secure member lookup function for bulk email newsletters

CREATE TABLE IF NOT EXISTS public.bulk_email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    template_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processed_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bulk_email_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service_role complete access to bulk_email_jobs
DROP POLICY IF EXISTS "service_role has full access to bulk_email_jobs" ON public.bulk_email_jobs;
CREATE POLICY "service_role has full access to bulk_email_jobs"
    ON public.bulk_email_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow approved club admins to select bulk_email_jobs for their club
DROP POLICY IF EXISTS "Admins can select bulk_email_jobs for their club" ON public.bulk_email_jobs;
CREATE POLICY "Admins can select bulk_email_jobs for their club"
    ON public.bulk_email_jobs
    FOR SELECT
    TO authenticated
    USING (
        public.is_club_admin(bulk_email_jobs.club_id, auth.uid())
    );

-- Create secure RPC to fetch emails for approved club members
CREATE OR REPLACE FUNCTION public.get_club_member_emails(p_club_id UUID)
RETURNS TABLE (email TEXT, full_name TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::TEXT,
    (p.first_name || ' ' || p.last_name)::TEXT
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  JOIN public.club_members cm ON cm.user_id = u.id
  WHERE cm.club_id = p_club_id
    AND cm.status = 'approved';
END;
$$;

-- Secure the function so only the database superuser/service_role can execute it
REVOKE EXECUTE ON FUNCTION public.get_club_member_emails(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_member_emails(UUID) TO service_role;

-- Create secure RPC to dequeue next pending job using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_bulk_email_job()
RETURNS TABLE (
    id UUID,
    club_id UUID,
    template_id UUID,
    status TEXT,
    processed_count INT,
    total_count INT,
    error_message TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    target_id UUID;
BEGIN
    -- Select the oldest pending job and lock it
    SELECT j.id INTO target_id
    FROM public.bulk_email_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF target_id IS NOT NULL THEN
        -- Update the status to processing
        RETURN QUERY
        UPDATE public.bulk_email_jobs
        SET status = 'processing', updated_at = NOW()
        WHERE public.bulk_email_jobs.id = target_id
        RETURNING *;
    END IF;
END;
$$;

-- Secure dequeue RPC function
REVOKE EXECUTE ON FUNCTION public.dequeue_bulk_email_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dequeue_bulk_email_job() TO service_role;
