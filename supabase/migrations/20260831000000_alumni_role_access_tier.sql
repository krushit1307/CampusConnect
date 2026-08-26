-- Migration: alumni_role_access_tier
-- Description: Adds 'alumni' role, grace periods, triggers to strip club admin roles, target_audience newsletters, and RSVP blocks.

-- 1. Safely add 'alumni' role to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'alumni';

-- 2. Add alumni_transitioned_at column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alumni_transitioned_at TIMESTAMPTZ;

-- 3. Add allow_alumni column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS allow_alumni BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Add target_audience to bulk_email_jobs
ALTER TABLE public.bulk_email_jobs ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'alumni', 'students'));

-- 5. Create or replace get_club_member_emails to support filtering by audience
CREATE OR REPLACE FUNCTION public.get_club_member_emails(p_club_id UUID, p_target_audience TEXT DEFAULT 'all')
RETURNS TABLE (email TEXT, full_name TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::TEXT,
    p.full_name::TEXT
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  JOIN public.club_members cm ON cm.user_id = u.id
  WHERE cm.club_id = p_club_id
    AND cm.status = 'approved'
    AND (
      p_target_audience = 'all'
      OR (p_target_audience = 'alumni' AND p.role = 'alumni')
      OR (p_target_audience = 'students' AND p.role = 'student')
    );
END;
$$;

-- Secure the function so only the service role/superuser can run it
REVOKE EXECUTE ON FUNCTION public.get_club_member_emails(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_member_emails(UUID, TEXT) TO service_role;

-- 6. Prevent alumni with expired grace periods from holding admin roles
CREATE OR REPLACE FUNCTION public.enforce_no_alumni_club_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.user_id
          AND role = 'alumni'
          AND (alumni_transitioned_at IS NULL OR alumni_transitioned_at < NOW() - INTERVAL '3 months')
    ) AND NEW.role = 'admin' THEN
        RAISE EXCEPTION 'Alumni whose grace period has expired cannot hold club admin permissions.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_no_alumni_club_admin ON public.club_members;
CREATE TRIGGER trg_enforce_no_alumni_club_admin
BEFORE INSERT OR UPDATE ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_no_alumni_club_admin();

-- 7. Daily cleanup task to strip admin roles of expired alumni
CREATE OR REPLACE FUNCTION public.cleanup_expired_alumni_permissions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.club_members
    SET role = 'member'
    WHERE user_id IN (
      SELECT id FROM public.profiles
      WHERE role = 'alumni' AND (alumni_transitioned_at IS NULL OR alumni_transitioned_at < NOW() - INTERVAL '3 months')
    ) AND role = 'admin';
END;
$$;

-- Schedule via pg_cron if enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cleanup-expired-alumni-permissions-daily',
            '0 0 * * *', -- Run every day at midnight
            $$SELECT public.cleanup_expired_alumni_permissions()$$
        );
    END IF;
END $$;

-- 8. Enforce Alumni RSVP restrictions (triggers on insert to event_rsvps/rsvps)
CREATE OR REPLACE FUNCTION public.enforce_alumni_rsvp_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.user_id
          AND role = 'alumni'
          AND (alumni_transitioned_at IS NULL OR alumni_transitioned_at < NOW() - INTERVAL '3 months')
    ) AND NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = NEW.event_id AND allow_alumni = true
    ) THEN
        RAISE EXCEPTION 'Alumni are not allowed to RSVP to student-only events.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_alumni_rsvp_restriction ON public.event_rsvps;
CREATE TRIGGER trg_enforce_alumni_rsvp_restriction
BEFORE INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_alumni_rsvp_restriction();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rsvps') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'rsvps' AND trigger_name = 'trg_enforce_alumni_rsvp_restriction') THEN
            CREATE TRIGGER trg_enforce_alumni_rsvp_restriction
            BEFORE INSERT ON public.rsvps
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_alumni_rsvp_restriction();
        END IF;
    END IF;
END $$;
