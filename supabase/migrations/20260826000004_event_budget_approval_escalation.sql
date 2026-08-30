-- Migration: 20260826000004_event_budget_approval_escalation.sql
-- Description: Dynamic Event Budget Approval Escalation Engine schema, tiered approval thresholds, and audit logging (Issue #4287)

CREATE TABLE IF NOT EXISTS public.event_budget_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  club_name TEXT NOT NULL,
  event_title TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  tier_category TEXT NOT NULL CHECK (
    tier_category IN ('micro_tier', 'mid_tier', 'high_value_tier')
  ),
  approval_status TEXT NOT NULL DEFAULT 'pending_treasurer' CHECK (
    approval_status IN (
      'system_auto_approved',
      'pending_treasurer',
      'pending_admin',
      'approved',
      'rejected',
      'escalated'
    )
  ),
  assigned_queue TEXT NOT NULL CHECK (
    assigned_queue IN ('none', 'student_union_treasurer', 'university_admin')
  ),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  review_notes TEXT,
  rejection_reason TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_auto_approved BOOLEAN NOT NULL DEFAULT false,
  audit_tag TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_approval_status_queue ON public.event_budget_approval_requests (approval_status, assigned_queue);
CREATE INDEX IF NOT EXISTS idx_budget_approval_club_event ON public.event_budget_approval_requests (club_id, event_id);

CREATE TABLE IF NOT EXISTS public.budget_approval_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.event_budget_approval_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  previous_status TEXT,
  new_status TEXT NOT NULL,
  audit_tag TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_audit_request ON public.budget_approval_audit_trail (request_id, created_at);

-- Enable RLS
ALTER TABLE public.event_budget_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_approval_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to budget approval requests"
  ON public.event_budget_approval_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert of budget requests"
  ON public.event_budget_approval_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update of budget requests"
  ON public.event_budget_approval_requests
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow read access to budget audit trail"
  ON public.budget_approval_audit_trail
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert of budget audit trail"
  ON public.budget_approval_audit_trail
  FOR INSERT
  WITH CHECK (true);

-- RPC: Evaluates and routes new budget request through tiered escalation rules
CREATE OR REPLACE FUNCTION public.submit_event_budget_with_escalation(
  p_event_id UUID,
  p_club_id UUID,
  p_club_name TEXT,
  p_event_title TEXT,
  p_total_amount NUMERIC,
  p_submitted_by UUID,
  p_submitted_by_name TEXT,
  p_line_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_queue TEXT;
  v_is_auto BOOLEAN;
  v_audit_tag TEXT;
  v_request_id UUID;
BEGIN
  -- Tiered Financial Escalation Rules:
  -- Total < $200: Auto-Approve immediately (tag: 'System_Auto_Approved')
  -- Total >= $200 and < $2000: Route to 'Student Union Treasurer' queue
  -- Total >= $2000: Route to 'University Admin' queue
  IF p_total_amount < 200.00 THEN
    v_tier := 'micro_tier';
    v_status := 'system_auto_approved';
    v_queue := 'none';
    v_is_auto := true;
    v_audit_tag := 'System_Auto_Approved';
  ELSIF p_total_amount < 2000.00 THEN
    v_tier := 'mid_tier';
    v_status := 'pending_treasurer';
    v_queue := 'student_union_treasurer';
    v_is_auto := false;
    v_audit_tag := 'Routed_Student_Union_Treasurer';
  ELSE
    v_tier := 'high_value_tier';
    v_status := 'pending_admin';
    v_queue := 'university_admin';
    v_is_auto := false;
    v_audit_tag := 'Routed_University_Admin';
  END IF;

  INSERT INTO public.event_budget_approval_requests (
    event_id,
    club_id,
    club_name,
    event_title,
    total_amount,
    tier_category,
    approval_status,
    assigned_queue,
    submitted_by,
    submitted_by_name,
    is_auto_approved,
    audit_tag,
    line_items,
    reviewed_at
  ) VALUES (
    p_event_id,
    p_club_id,
    p_club_name,
    p_event_title,
    p_total_amount,
    v_tier,
    v_status,
    v_queue,
    p_submitted_by,
    p_submitted_by_name,
    v_is_auto,
    v_audit_tag,
    p_line_items,
    CASE WHEN v_is_auto THEN now() ELSE NULL END
  ) RETURNING id INTO v_request_id;

  -- Create initial audit trail entry
  INSERT INTO public.budget_approval_audit_trail (
    request_id,
    action,
    actor_name,
    previous_status,
    new_status,
    audit_tag,
    notes
  ) VALUES (
    v_request_id,
    CASE WHEN v_is_auto THEN 'AUTO_APPROVED' ELSE 'SUBMITTED_FOR_REVIEW' END,
    CASE WHEN v_is_auto THEN 'System Escalation Engine' ELSE p_submitted_by_name END,
    'draft',
    v_status,
    v_audit_tag,
    CASE
      WHEN v_is_auto THEN 'Total amount ($' || p_total_amount || ') under $200 threshold: Automatically approved with audit tag System_Auto_Approved.'
      WHEN p_total_amount < 2000.00 THEN 'Total amount ($' || p_total_amount || ') routed to Student Union Treasurer queue.'
      ELSE 'High value budget ($' || p_total_amount || ') routed to University Admin approval queue.'
    END
  );

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'status', v_status,
    'queue', v_queue,
    'tier', v_tier,
    'is_auto_approved', v_is_auto,
    'audit_tag', v_audit_tag
  );
END;
$$;
