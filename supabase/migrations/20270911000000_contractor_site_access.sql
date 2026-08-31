-- Issue #4923: Contractor Site Access
--
-- Validity is stored as a window on every piece of evidence, because the thing
-- a certificate certifies is not the upload, it is the day of the work. Nothing
-- here carries an "approved" boolean: approval is derived from evidence that
-- covers the works window, so it cannot go stale without changing.
--
-- Indemnity limits are integer pence. A shortfall computed from floating-point
-- pounds is a shortfall of £0.00000001.

CREATE TABLE IF NOT EXISTS public.contractor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  primary_contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.contractor_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.contractor_companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  -- No date of birth, no address, no identity documents. Site access needs to
  -- know who is on site and what they are signed off for, and nothing else.
  photo_id_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contractor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.contractor_companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('RAMS', 'METHOD_STATEMENT', 'PUBLIC_LIABILITY', 'EMPLOYERS_LIABILITY')
  ),
  reference TEXT NOT NULL,
  storage_path TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  -- Exclusive. A certificate expiring on the 30th does not cover work on the 30th.
  valid_until TIMESTAMPTZ NOT NULL,
  -- Set on liability certificates. A policy has a number on it as well as a date.
  indemnity_limit_pence BIGINT CHECK (indemnity_limit_pence IS NULL OR indemnity_limit_pence >= 0),
  -- Set on RAMS and method statements: the activity codes the document was
  -- written for. An activity outside this set is not covered, however current
  -- the document is.
  covers_activities TEXT[],
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until > valid_from)
);

-- Competency is per person, per activity, and each certificate expires on its
-- own schedule. A company-level approval grants nothing here.
CREATE TABLE IF NOT EXISTS public.contractor_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.contractor_personnel(id) ON DELETE CASCADE,
  competency_code TEXT NOT NULL,
  certificate_reference TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS public.site_activity_requirements (
  activity_code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  required_indemnity_pence BIGINT NOT NULL DEFAULT 0 CHECK (required_indemnity_pence >= 0),
  requires_rams BOOLEAN NOT NULL DEFAULT FALSE,
  required_competencies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Declared incompatibility between two activity types. Stored once, in sorted
-- order, so a conflict cannot be registered in one direction and missed in the
-- other.
CREATE TABLE IF NOT EXISTS public.site_activity_conflicts (
  activity_a TEXT NOT NULL REFERENCES public.site_activity_requirements(activity_code)
    ON DELETE CASCADE,
  activity_b TEXT NOT NULL REFERENCES public.site_activity_requirements(activity_code)
    ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_a, activity_b),
  CHECK (activity_a < activity_b)
);

CREATE TABLE IF NOT EXISTS public.site_works_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.contractor_companies(id) ON DELETE RESTRICT,
  zone_id TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  activity_codes TEXT[] NOT NULL DEFAULT '{}',
  personnel_ids UUID[] NOT NULL DEFAULT '{}',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'PERMITTED', 'CANCELLED')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end > window_start)
);

CREATE TABLE IF NOT EXISTS public.site_access_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  works_id UUID NOT NULL REFERENCES public.site_works_orders(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL,
  issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The permit records what it was issued against, because every check that
  -- produced it was computed from these three things. Changing any of them
  -- voids the permit rather than carrying it across.
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  activity_codes TEXT[] NOT NULL,
  personnel_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'VOIDED')),
  voided_reason TEXT,
  voided_at TIMESTAMPTZ,
  CHECK (window_end > window_start),
  CHECK (
    (status = 'VOIDED' AND voided_reason IS NOT NULL AND voided_at IS NOT NULL)
    OR (status = 'ISSUED' AND voided_reason IS NULL AND voided_at IS NULL)
  )
);

-- At most one live permit per works order.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_permit_per_works
  ON public.site_access_permits(works_id)
  WHERE status = 'ISSUED';

-- Refusals are kept so a contractor turned away can be told everything that is
-- wrong at once. One sent away twice sends nobody.
CREATE TABLE IF NOT EXISTS public.site_access_refusals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  works_id UUID NOT NULL REFERENCES public.site_works_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'NO_ACTIVITIES',
      'NO_PERSONNEL',
      'UNKNOWN_ACTIVITY',
      'UNKNOWN_PERSONNEL',
      'PERSONNEL_NOT_EMPLOYED_BY_COMPANY',
      'DOCUMENT_MISSING',
      'DOCUMENT_NOT_YET_VALID',
      'DOCUMENT_EXPIRED',
      'INSUFFICIENT_INDEMNITY',
      'COMPETENCY_MISSING',
      'COMPETENCY_EXPIRED',
      'RAMS_SCOPE_GAP',
      'PERMIT_CONFLICT'
    )
  ),
  person_id UUID REFERENCES public.contractor_personnel(id) ON DELETE SET NULL,
  activity_code TEXT,
  document_kind TEXT,
  lapsed_at TIMESTAMPTZ,
  shortfall_pence BIGINT,
  conflicting_permit_id UUID REFERENCES public.site_access_permits(id) ON DELETE SET NULL,
  detail TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractor_documents_validity
  ON public.contractor_documents(company_id, kind, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_contractor_competencies_validity
  ON public.contractor_competencies(person_id, competency_code, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_site_works_zone_window
  ON public.site_works_orders(zone_id, window_start, window_end);

CREATE INDEX IF NOT EXISTS idx_site_permits_zone_window
  ON public.site_access_permits(zone_id, window_start, window_end)
  WHERE status = 'ISSUED';

CREATE INDEX IF NOT EXISTS idx_site_refusals_works
  ON public.site_access_refusals(works_id, evaluated_at DESC);

-- Documents whose validity window is about to stop covering a works order that
-- is already permitted. This is the report that would have caught the marquee
-- firm approved in March turning up in May.
CREATE OR REPLACE VIEW public.site_access_expiring_evidence AS
SELECT
  w.id AS works_id,
  w.zone_id,
  w.window_start,
  w.window_end,
  c.name AS company_name,
  d.kind AS document_kind,
  d.reference,
  d.valid_until
FROM public.site_works_orders w
JOIN public.contractor_companies c ON c.id = w.company_id
JOIN public.contractor_documents d ON d.company_id = w.company_id
WHERE w.status = 'PERMITTED'
  AND d.valid_until < w.window_end;

ALTER TABLE public.contractor_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_activity_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_activity_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_works_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_access_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_access_refusals ENABLE ROW LEVEL SECURITY;

-- Activity requirements and conflicts are reference data: anybody raising a
-- works order needs to know what will be asked of them before they raise it.
DROP POLICY IF EXISTS "Activity requirements are readable" ON public.site_activity_requirements;
CREATE POLICY "Activity requirements are readable"
  ON public.site_activity_requirements FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Activity conflicts are readable" ON public.site_activity_conflicts;
CREATE POLICY "Activity conflicts are readable"
  ON public.site_activity_conflicts FOR SELECT TO authenticated
  USING (TRUE);

-- Insurance certificates and competency records are commercially sensitive and
-- belong to the contractor. Only estates staff read them.
DROP POLICY IF EXISTS "Estates staff can read contractor documents" ON public.contractor_documents;
CREATE POLICY "Estates staff can read contractor documents"
  ON public.contractor_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Estates staff can read competencies" ON public.contractor_competencies;
CREATE POLICY "Estates staff can read competencies"
  ON public.contractor_competencies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Works orders are visible to their submitter" ON public.site_works_orders;
CREATE POLICY "Works orders are visible to their submitter"
  ON public.site_works_orders FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Societies can raise works orders" ON public.site_works_orders;
CREATE POLICY "Societies can raise works orders"
  ON public.site_works_orders FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'SUBMITTED');

DROP POLICY IF EXISTS "Permits follow their works order" ON public.site_access_permits;
CREATE POLICY "Permits follow their works order"
  ON public.site_access_permits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_works_orders w
      WHERE w.id = site_access_permits.works_id
        AND (
          w.submitted_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Refusals follow their works order" ON public.site_access_refusals;
CREATE POLICY "Refusals follow their works order"
  ON public.site_access_refusals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_works_orders w
      WHERE w.id = site_access_refusals.works_id AND w.submitted_by = auth.uid()
    )
  );

-- Evaluation, issue and void all run server side: each depends on the state of
-- every other permit in the zone as well as on the contractor's own evidence.
REVOKE INSERT, UPDATE, DELETE ON public.contractor_companies FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contractor_personnel FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contractor_documents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.contractor_competencies FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_activity_requirements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_activity_conflicts FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.site_works_orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_access_permits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_access_refusals FROM anon, authenticated;
REVOKE ALL ON public.site_access_expiring_evidence FROM anon;
