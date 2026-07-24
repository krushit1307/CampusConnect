-- Migration: 20260720230000_create_audit_logs.sql
-- Description: Create audit_logs table, trigger function, triggers on clubs, events, club_members, and RLS policies

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only system admins can select audit logs
DROP POLICY IF EXISTS "System admins can view audit logs" ON public.audit_logs;
CREATE POLICY "System admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_system_admin());

-- 2. Create audit log trigger function
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
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    target_table,
    record_id,
    details
  ) VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_details
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Create triggers on clubs, events, and club_members
DROP TRIGGER IF EXISTS tr_audit_clubs ON public.clubs;
CREATE TRIGGER tr_audit_clubs
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_events ON public.events;
CREATE TRIGGER tr_audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS tr_audit_club_members ON public.club_members;
CREATE TRIGGER tr_audit_club_members
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
