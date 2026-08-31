-- Issue #4676: Automated Club Leadership Background Check Integration
-- SSN, DOB, report details, and provider access tokens never enter CampusConnect.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'Standard'
  CHECK (risk_level IN ('Standard', 'High_Minors'));

CREATE TABLE IF NOT EXISTS public.club_leadership_background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'checkr',
  provider_candidate_id TEXT,
  provider_report_id TEXT,
  desired_role_id UUID REFERENCES public.club_roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'clear', 'consider', 'failed')),
  hosted_apply_url TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.club_leadership_background_check_events (
  provider_event_id TEXT PRIMARY KEY,
  background_check_id UUID REFERENCES public.club_leadership_background_checks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadership_background_checks_review
  ON public.club_leadership_background_checks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadership_background_checks_club
  ON public.club_leadership_background_checks(club_id, status);

ALTER TABLE public.club_leadership_background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_leadership_background_check_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admins can view leadership checks" ON public.club_leadership_background_checks;
CREATE POLICY "Club admins can view leadership checks"
  ON public.club_leadership_background_checks FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_leadership_background_checks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND (cm.role = 'admin' OR cm.can_manage_permissions = TRUE)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Dean reviewers can view leadership checks" ON public.club_leadership_background_checks;
CREATE POLICY "Dean reviewers can view leadership checks"
  ON public.club_leadership_background_checks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')));

REVOKE ALL ON public.club_leadership_background_check_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.club_leadership_background_checks FROM anon, authenticated;
GRANT SELECT ON public.club_leadership_background_checks TO authenticated;

COMMENT ON TABLE public.club_leadership_background_checks IS 'State machine for high-risk leadership vetting; no SSN, DOB, report details, or provider tokens are stored.';
COMMENT ON TABLE public.club_leadership_background_check_events IS 'Append-only provider webhook idempotency keys.';
