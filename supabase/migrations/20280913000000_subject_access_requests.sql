-- Issue #5162: Subject Access Request Clock
--
-- The clock starts on receipt. received_on and recognised_on are separate
-- columns precisely so that the second one cannot be mistaken for the first: a
-- request opened in a shared inbox during reading week and recognised eleven
-- days later has eleven days already gone, and a deadline computed from
-- recognition is wrong in the only direction that matters.
--
-- Suspensions are stored as the interval between asking for identification and
-- being given it, rather than as a paused flag, because a flag can be left on
-- after the passport photograph arrives and nothing about the row would say so.
--
-- Exemptions hang off items rather than requests. Withholding a whole file
-- because one welfare note names another student is over-redaction; releasing
-- it because most of it is fine discloses somebody else's personal data.

CREATE TABLE IF NOT EXISTS public.subject_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- A requester who is not a platform user still has rights, so the identifying
  -- details are held rather than assumed to be joinable.
  subject_name TEXT NOT NULL,
  subject_contact TEXT NOT NULL,
  received_on TIMESTAMPTZ NOT NULL,
  recognised_on TIMESTAMPTZ,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'POST', 'IN_PERSON', 'SOCIAL_MEDIA', 'FORM')),
  state TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (
    state IN ('RECEIVED', 'IDENTITY_PENDING', 'SEARCHING', 'READY_TO_RESPOND', 'RESPONDED', 'REFUSED')
  ),
  responded_on TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (recognised_on IS NULL OR recognised_on >= received_on),
  CHECK ((state = 'RESPONDED') = (responded_on IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS subject_access_requests_open_idx
  ON public.subject_access_requests (received_on)
  WHERE state NOT IN ('RESPONDED', 'REFUSED');

-- The clock pauses for one reason and resumes on an answer. Both dates are
-- here so the pause can be audited rather than asserted.
CREATE TABLE IF NOT EXISTS public.sar_identity_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.subject_access_requests(id) ON DELETE CASCADE,
  requested_on TIMESTAMPTZ NOT NULL,
  responded_on TIMESTAMPTZ,
  what_was_asked_for TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (responded_on IS NULL OR responded_on >= requested_on)
);

CREATE INDEX IF NOT EXISTS sar_identity_checks_open_idx
  ON public.sar_identity_checks (request_id)
  WHERE responded_on IS NULL;

-- An extension claimed after the period it would extend is not an extension.
-- claimed_on is therefore mandatory and the ground is not free-form.
CREATE TABLE IF NOT EXISTS public.sar_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.subject_access_requests(id) ON DELETE CASCADE,
  claimed_on TIMESTAMPTZ NOT NULL,
  ground TEXT NOT NULL CHECK (ground IN ('COMPLEXITY', 'VOLUME_OF_REQUESTS')),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  granted BOOLEAN NOT NULL,
  refusal_reason TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (granted OR refusal_reason IS NOT NULL)
);

-- One row per custodian. A custodian that holds nothing has to say so: silence
-- is not a nil return, and a response assembled from whoever replied is a
-- partial disclosure presented as a full one.
CREATE TABLE IF NOT EXISTS public.sar_search_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.subject_access_requests(id) ON DELETE CASCADE,
  custodian TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'ITEMS_RETURNED', 'NIL_RETURN')),
  completed_on TIMESTAMPTZ,
  UNIQUE (request_id, custodian),
  CHECK ((state = 'OPEN') = (completed_on IS NULL))
);

CREATE INDEX IF NOT EXISTS sar_search_tasks_outstanding_idx
  ON public.sar_search_tasks (request_id)
  WHERE state = 'OPEN';

CREATE TABLE IF NOT EXISTS public.sar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.subject_access_requests(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.sar_search_tasks(id) ON DELETE SET NULL,
  custodian TEXT NOT NULL,
  description TEXT NOT NULL,
  source_reference TEXT,
  names_third_parties BOOLEAN NOT NULL DEFAULT FALSE,
  third_party_consent_obtained BOOLEAN NOT NULL DEFAULT FALSE,
  -- Whether the third party can be taken out and the rest still make sense.
  -- This is the fact that decides between redaction and withholding.
  third_party_severable BOOLEAN NOT NULL DEFAULT FALSE,
  located_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sar_items_request_idx ON public.sar_items (request_id);

CREATE TABLE IF NOT EXISTS public.sar_item_exemptions (
  item_id UUID NOT NULL REFERENCES public.sar_items(id) ON DELETE CASCADE,
  exemption TEXT NOT NULL CHECK (
    exemption IN (
      'THIRD_PARTY_DATA',
      'LEGAL_PRIVILEGE',
      'CONFIDENTIAL_REFERENCE',
      'MANAGEMENT_PLANNING',
      'CRIME_PREVENTION'
    )
  ),
  PRIMARY KEY (item_id, exemption)
);

-- Three outcomes, because two cannot express the case that comes up most: an
-- item that is largely the subject's own record and names somebody else in one
-- line.
CREATE TABLE IF NOT EXISTS public.sar_item_decisions (
  item_id UUID PRIMARY KEY REFERENCES public.sar_items(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('DISCLOSE', 'REDACT_THIRD_PARTY', 'WITHHOLD')),
  exemption_applied TEXT CHECK (
    exemption_applied IS NULL
    OR exemption_applied IN (
      'THIRD_PARTY_DATA',
      'LEGAL_PRIVILEGE',
      'CONFIDENTIAL_REFERENCE',
      'MANAGEMENT_PLANNING',
      'CRIME_PREVENTION'
    )
  ),
  reason TEXT NOT NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Anything held back or redacted was held back under something. A withheld
  -- item with no exemption named is a decision nobody can defend later.
  CHECK ((outcome = 'DISCLOSE') = (exemption_applied IS NULL))
);

-- A refusal is subject to the same deadline as a disclosure. Nothing was
-- disclosed and it is still late.
CREATE TABLE IF NOT EXISTS public.sar_refusals (
  request_id UUID PRIMARY KEY REFERENCES public.subject_access_requests(id) ON DELETE CASCADE,
  refused_on TIMESTAMPTZ NOT NULL,
  ground TEXT NOT NULL CHECK (ground IN ('MANIFESTLY_UNFOUNDED', 'EXCESSIVE', 'REPEAT_REQUEST')),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  complaint_rights_given BOOLEAN NOT NULL,
  refused_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- The deadline, derived rather than stored, so it cannot drift from the events
-- that determine it. NULL is a real answer here: while an identity check is
-- open there is not yet a date, and reporting a stale one is worse than
-- reporting none.
CREATE OR REPLACE FUNCTION public.sar_effective_deadline(p_request_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_received TIMESTAMPTZ;
  v_open_checks INTEGER;
  v_suspension_days INTEGER;
  v_extension_months INTEGER;
BEGIN
  SELECT received_on INTO v_received
  FROM public.subject_access_requests
  WHERE id = p_request_id;

  IF v_received IS NULL THEN
    RAISE EXCEPTION 'Unknown subject access request %', p_request_id;
  END IF;

  SELECT COUNT(*) INTO v_open_checks
  FROM public.sar_identity_checks
  WHERE request_id = p_request_id AND responded_on IS NULL;

  IF v_open_checks > 0 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(CEIL(EXTRACT(EPOCH FROM (responded_on - requested_on)) / 86400)), 0)
  INTO v_suspension_days
  FROM public.sar_identity_checks
  WHERE request_id = p_request_id AND responded_on IS NOT NULL;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.sar_extensions
    WHERE request_id = p_request_id AND granted
  ) THEN 2 ELSE 0 END
  INTO v_extension_months;

  RETURN v_received
    + make_interval(months => 1 + v_extension_months)
    + make_interval(days => v_suspension_days);
END;
$$;

ALTER TABLE public.subject_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_identity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_search_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_item_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_item_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sar_refusals ENABLE ROW LEVEL SECURITY;

-- The subject can see the progress of their own request — the deadline, the
-- suspension, the extension and the refusal are all things they are entitled to
-- know about. What the search turned up is released through the disclosure
-- pack, once decided, and not through a table read.
CREATE POLICY subject_access_requests_own_read
  ON public.subject_access_requests FOR SELECT
  USING (subject_id = auth.uid());
CREATE POLICY sar_identity_checks_own_read
  ON public.sar_identity_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subject_access_requests r
      WHERE r.id = request_id AND r.subject_id = auth.uid()
    )
  );
CREATE POLICY sar_refusals_own_read
  ON public.sar_refusals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subject_access_requests r
      WHERE r.id = request_id AND r.subject_id = auth.uid()
    )
  );
