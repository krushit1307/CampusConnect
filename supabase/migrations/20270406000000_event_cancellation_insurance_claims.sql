-- =============================================================================
-- Issue #4727 - Automated Event Cancellation Insurance Claims
-- Club policy id + claim ledger for underwriter payloads.
-- =============================================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS insurance_policy_id TEXT;

COMMENT ON COLUMN public.clubs.insurance_policy_id IS
  'Active event-cancellation insurance policy id used when filing claims.';

CREATE TABLE IF NOT EXISTS public.event_insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  insurance_policy_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  lost_revenue INTEGER NOT NULL DEFAULT 0 CHECK (lost_revenue >= 0),
  sunk_costs INTEGER NOT NULL DEFAULT 0 CHECK (sunk_costs >= 0),
  weather JSONB,
  payload JSONB NOT NULL,
  underwriter_status TEXT NOT NULL DEFAULT 'compiled',
  underwriter_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_insurance_claims_event
  ON public.event_insurance_claims (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_insurance_claims_club
  ON public.event_insurance_claims (club_id, created_at DESC);

ALTER TABLE public.event_insurance_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view event insurance claims" ON public.event_insurance_claims;
CREATE POLICY "Organizers can view event insurance claims"
  ON public.event_insurance_claims FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR (
      club_id IS NOT NULL
      AND public.is_club_admin(club_id, auth.uid())
    )
  );

GRANT SELECT ON public.event_insurance_claims TO authenticated;
GRANT ALL ON public.event_insurance_claims TO service_role;
