-- =============================================================================
-- MIGRATION: Create Audit Logs Table and Triggers
-- ISSUE: #1677
-- PURPOSE: Tamper-proof historical log of all critical database mutations.
-- =============================================================================

DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Tamper-proof audit log for critical database mutations';

-- 2. Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only club admins or global admins can read the audit logs
CREATE POLICY "Audit logs are viewable by admins"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('club_admin', 'system_admin')
        )
    );

-- Prevent anyone (even admins) from manually updating/deleting logs to ensure tamper-proof nature
CREATE POLICY "Audit logs cannot be manually modified or deleted"
    ON public.audit_logs FOR ALL
    USING (false);

-- 3. Generic trigger function to log changes
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    old_record JSONB;
    new_record JSONB;
    user_id UUID;
BEGIN
    -- Get the current user ID from Supabase auth context
    user_id := auth.uid();

    -- Serialize OLD and NEW records, excluding sensitive fields
    IF (TG_OP = 'DELETE') THEN
        old_record := to_jsonb(OLD);
        old_record := old_record - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token';
        new_record := NULL;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_record := to_jsonb(OLD);
        old_record := old_record - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token';
        new_record := to_jsonb(NEW);
        new_record := new_record - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token';
    ELSIF (TG_OP = 'INSERT') THEN
        old_record := NULL;
        new_record := to_jsonb(NEW);
        new_record := new_record - 'password_hash' - 'hashed_password' - 'reset_token' - 'access_token';
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, old_record, new_record, user_id);

    -- Return the row to allow the actual operation to proceed
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach triggers to critical tables
DROP TRIGGER IF EXISTS audit_events_trigger ON public.events;
CREATE TRIGGER audit_events_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_clubs_trigger ON public.clubs;
CREATE TRIGGER audit_clubs_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_club_members_trigger ON public.club_members;
CREATE TRIGGER audit_club_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 5. Index for faster querying
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
