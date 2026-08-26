ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_table TEXT;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS record_id UUID;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation
ON public.audit_logs (admin_id, record_id, created_at DESC);

DROP POLICY IF EXISTS "System admins can insert impersonation audit logs"
ON public.audit_logs;

CREATE POLICY "System admins can insert impersonation audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_system_admin()
  AND admin_id = auth.uid()
  AND action = 'IMPERSONATE'
);