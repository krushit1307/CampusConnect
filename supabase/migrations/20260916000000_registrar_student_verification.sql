-- Migration: 20260916000000_registrar_student_verification.sql
-- Description: Issue #3691 - Implement 'Automated "Student Status" Registrar Verification'

-- 1. Add student_id, enrollment_status, account_locked, and last_registrar_sync to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS student_id TEXT,
ADD COLUMN IF NOT EXISTS enrollment_status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'suspended' | 'expelled'
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_registrar_sync TIMESTAMPTZ;

-- 2. Create registrar_sync_logs table for audit logging
CREATE TABLE IF NOT EXISTS public.registrar_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    user_full_name TEXT NOT NULL,
    previous_status TEXT NOT NULL DEFAULT 'active',
    new_status TEXT NOT NULL, -- 'inactive' | 'expelled' | 'suspended'
    action_taken TEXT NOT NULL DEFAULT 'ACCOUNT_LOCKED_PURGED',
    clubs_notified_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying registrar sync logs by user
CREATE INDEX IF NOT EXISTS idx_registrar_sync_user ON public.registrar_sync_logs (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.registrar_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Registrar sync logs readable by authenticated users" ON public.registrar_sync_logs;
CREATE POLICY "Registrar sync logs readable by authenticated users"
    ON public.registrar_sync_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Registrar sync logs insertable by authenticated users" ON public.registrar_sync_logs;
CREATE POLICY "Registrar sync logs insertable by authenticated users"
    ON public.registrar_sync_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.registrar_sync_logs;

-- 3. Create RPC function to purge inactive student, lock account, remove from rosters, and notify presidents
CREATE OR REPLACE FUNCTION public.purge_inactive_student(
    p_user_id UUID,
    p_student_id TEXT,
    p_new_status TEXT DEFAULT 'inactive',
    p_reason TEXT DEFAULT 'Enrollment status changed to inactive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_name TEXT;
    v_club_count INT := 0;
    v_club RECORD;
BEGIN
    -- Query user details
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;
    IF v_user_name IS NULL THEN
        v_user_name := 'Student User';
    END IF;

    -- 1. Lock profile account & update enrollment_status
    UPDATE public.profiles
    SET enrollment_status = p_new_status,
        account_locked = true,
        last_registrar_sync = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 2. Count clubs user belonged to
    SELECT COUNT(*) INTO v_club_count FROM public.club_members WHERE user_id = p_user_id;

    -- 3. Remove user from all club rosters
    DELETE FROM public.club_members WHERE user_id = p_user_id;

    -- 4. Log in registrar_sync_logs
    INSERT INTO public.registrar_sync_logs (
        user_id,
        student_id,
        user_full_name,
        previous_status,
        new_status,
        action_taken,
        clubs_notified_count,
        created_at
    ) VALUES (
        p_user_id,
        p_student_id,
        v_user_name,
        'active',
        p_new_status,
        'ACCOUNT_LOCKED_PURGED',
        v_club_count,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'student_id', p_student_id,
        'account_locked', true,
        'clubs_purged_count', v_club_count,
        'notification_message', 'User ' || v_user_name || ' has been automatically removed from your roster due to a change in university enrollment status.'
    );
END;
$$;
