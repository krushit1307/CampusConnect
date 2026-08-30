-- =============================================================================
-- Migration: 20270901000000_database_audit_log_cdc.sql
-- Issue: #2327 - [REFACTOR]: Setup Database Audit Log (CDC) via Postgres Triggers
-- Description: Creates an immutable, forensic audit_logs Change Data Capture (CDC)
-- table and PL/pgSQL trigger function to record all row-level UPDATE and DELETE 
-- mutations on critical tables (clubs, events, profiles/users, club_members).
-- Supports user context tracking via myapp.current_user_id and 90-day retention purging.
-- =============================================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Immutable forensic Change Data Capture (CDC) audit log tracking historical updates and deletes on critical tables';

-- 2. Indexes for fast forensic querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record 
ON public.audit_logs (table_name, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by 
ON public.audit_logs (changed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON public.audit_logs (action, created_at DESC);

-- 3. PL/pgSQL Trigger Function: log_audit_event()
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_changed_by UUID;
    v_app_user_id TEXT;
BEGIN
    -- 1. Determine actor/changed_by from auth.uid() or custom session setting (SET LOCAL myapp.current_user_id = '...')
    BEGIN
        v_app_user_id := current_setting('myapp.current_user_id', true);
    EXCEPTION WHEN OTHERS THEN
        v_app_user_id := NULL;
    END;

    v_changed_by := COALESCE(
        auth.uid(),
        NULLIF(v_app_user_id, '')::UUID,
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );

    -- 2. Capture and serialize OLD and NEW record states into JSONB using native row_to_json / to_jsonb
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        
        -- Safely extract record_id if OLD has an id column
        BEGIN
            v_record_id := (OLD.id)::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        BEGIN
            v_record_id := (NEW.id)::UUID;
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_record_id := (OLD.id)::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL;
            END;
        END;

    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        
        BEGIN
            v_record_id := (NEW.id)::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_record_id := NULL;
        END;
    END IF;

    -- 3. Scrub sensitive security attributes from JSONB payloads before persistence
    IF v_old_data IS NOT NULL THEN
        v_old_data := v_old_data - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token' - 'totp_secret';
    END IF;

    IF v_new_data IS NOT NULL THEN
        v_new_data := v_new_data - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token' - 'totp_secret';
    END IF;

    -- 4. Insert CDC audit log entry
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_changed_by,
        NOW()
    );

    -- 5. Return appropriate row to complete the transaction
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Attach AFTER UPDATE OR DELETE Triggers on Critical Tables
DROP TRIGGER IF EXISTS trg_audit_clubs ON public.clubs;
CREATE TRIGGER trg_audit_clubs
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_events ON public.events;
CREATE TRIGGER trg_audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_club_members ON public.club_members;
CREATE TRIGGER trg_audit_club_members
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 5. Retention Policy: Purge audit logs older than N days (default: 90 days)
CREATE OR REPLACE FUNCTION public.purge_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_old_audit_logs IS 'Deletes audit log entries older than retention_days (default 90 days) to prevent storage exhaustion';

-- 6. Row Level Security (RLS) & Immutability
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and system administrators can read audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('club_admin', 'system_admin')
    )
    OR changed_by = auth.uid()
);

-- Immutable Append-Only: Prohibit manual modifications or deletions from PostgREST/client
DROP POLICY IF EXISTS "Audit logs are append-only by triggers" ON public.audit_logs;
CREATE POLICY "Audit logs are append-only by triggers"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Audit logs cannot be updated" ON public.audit_logs;
CREATE POLICY "Audit logs cannot be updated"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Audit logs cannot be deleted by users" ON public.audit_logs;
CREATE POLICY "Audit logs cannot be deleted by users"
ON public.audit_logs FOR DELETE
TO authenticated
USING (false);
