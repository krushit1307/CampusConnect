-- ============================================================
-- Migration: 20260726030000_admin_audit_logs_immutability.sql
-- Issue: #1183
-- Description:
--   Ensures audit_logs table includes admin_id, old_value, and new_value
--   columns, records AFTER UPDATE changes on the clubs table, and enforces
--   strict immutability preventing any UPDATE or DELETE operations.
-- ============================================================

-- 1. Create audit_logs table if not exists & ensure columns
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB;

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- System admins view policy
DROP POLICY IF EXISTS "System admins can view audit logs" ON public.audit_logs;
CREATE POLICY "System admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'club_admin'::user_role
  )
);

-- 2. Create or replace audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_record_id UUID;
  v_details JSONB;
  v_old JSONB;
  v_new JSONB;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_details := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_details := jsonb_build_object('old', v_old, 'new', v_new);
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_details := jsonb_build_object('old', v_old);
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    admin_id,
    action,
    target_table,
    record_id,
    details,
    old_value,
    new_value
  ) VALUES (
    v_user_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_details,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Ensure trigger on clubs table is registered
DROP TRIGGER IF EXISTS tr_audit_clubs ON public.clubs;
CREATE TRIGGER tr_audit_clubs
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. Enforce Immutability: Prevent UPDATE or DELETE on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_audit_log_modification ON public.audit_logs;
CREATE TRIGGER tr_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Revoke UPDATE and DELETE permissions on audit_logs
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC, authenticated, anon;
