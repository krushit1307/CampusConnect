-- Issue #4300: Automated Event Feedback LLM Sentiment Alerting.
-- Critical reports are kept out of the normal summary table and are visible only
-- to authorized Student Union safety reviewers and the service role.

CREATE TABLE IF NOT EXISTS public.event_feedback_safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES public.event_feedback(id) ON DELETE CASCADE,
  raw_feedback TEXT NOT NULL CHECK (char_length(btrim(raw_feedback)) > 0),
  detection_source TEXT NOT NULL CHECK (detection_source IN ('llm_marker', 'deterministic_safety_language', 'both')),
  llm_output TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  sms_sent_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  last_delivery_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feedback_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_safety_alerts_event_status
  ON public.event_feedback_safety_alerts (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_safety_alerts_open
  ON public.event_feedback_safety_alerts (status, created_at DESC)
  WHERE status <> 'resolved';

CREATE OR REPLACE FUNCTION public.is_feedback_safety_reviewer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        COALESCE(p.is_admin, FALSE)
        OR p.role::TEXT IN ('admin', 'safety_admin', 'system_admin')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    LEFT JOIN public.club_roles cr ON cr.id = cm.role_id
    WHERE cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND (
        cm.role::TEXT IN ('admin', 'owner', 'president')
        OR COALESCE(cr.permissions_level, 0) >= 100
      )
      AND LOWER(c.name) = 'student union'
  );
$$;

ALTER TABLE public.event_feedback_safety_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Safety reviewers can view safety alerts" ON public.event_feedback_safety_alerts;
CREATE POLICY "Safety reviewers can view safety alerts"
  ON public.event_feedback_safety_alerts FOR SELECT TO authenticated
  USING (public.is_feedback_safety_reviewer(auth.uid()));

DROP POLICY IF EXISTS "Safety reviewers can update safety alerts" ON public.event_feedback_safety_alerts;
CREATE POLICY "Safety reviewers can update safety alerts"
  ON public.event_feedback_safety_alerts FOR UPDATE TO authenticated
  USING (public.is_feedback_safety_reviewer(auth.uid()))
  WITH CHECK (public.is_feedback_safety_reviewer(auth.uid()));

REVOKE INSERT, DELETE ON public.event_feedback_safety_alerts FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.event_feedback_safety_alerts TO authenticated;
GRANT ALL ON public.event_feedback_safety_alerts TO service_role;
GRANT EXECUTE ON FUNCTION public.is_feedback_safety_reviewer(UUID) TO authenticated;

DROP TRIGGER IF EXISTS trg_feedback_safety_alerts_updated_at ON public.event_feedback_safety_alerts;
CREATE TRIGGER trg_feedback_safety_alerts_updated_at
  BEFORE UPDATE ON public.event_feedback_safety_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_open_feedback_safety_alerts()
RETURNS SETOF public.event_feedback_safety_alerts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_feedback_safety_reviewer(auth.uid()) THEN
    RAISE EXCEPTION 'Only safety reviewers may access critical feedback alerts.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT *
    FROM public.event_feedback_safety_alerts
    WHERE status <> 'resolved'
    ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_feedback_safety_alerts() TO authenticated;

COMMENT ON TABLE public.event_feedback_safety_alerts IS
  'Restricted critical safety reports routed outside standard event feedback summaries. Issue #4300.';
