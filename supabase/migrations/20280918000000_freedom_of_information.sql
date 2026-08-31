-- Issue #5260: Freedom of information request handling
--
-- Separate from the subject access request tables in #5162. Same institution,
-- different statute, and the differences are the ones that make reusing that
-- schema produce wrong deadlines: this clock runs in working days, it stops and
-- restarts, and it carries a cost limit tested after aggregation.
--
-- The deadline is not a stored column. It is a function of the receipt date,
-- the working calendar, the suspensions and any extension, all of which change
-- after the row is written. A stored due_on is correct until the first
-- clarification and wrong afterwards.

CREATE TABLE IF NOT EXISTS public.institutional_closure_days (
  closure_date DATE PRIMARY KEY,
  reason TEXT NOT NULL
);

COMMENT ON TABLE public.institutional_closure_days IS
  'Days that are not working days. Twenty working days from 20 December is not twenty calendar days later.';

CREATE TABLE IF NOT EXISTS public.foi_requesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A campaign submitting under five names is one requester for the cost limit.
-- The relation is recorded rather than guessed, because acting in concert is a
-- finding somebody has to make and be able to justify.
CREATE TABLE IF NOT EXISTS public.foi_requester_concert (
  requester_id UUID NOT NULL REFERENCES public.foi_requesters(id) ON DELETE CASCADE,
  connected_requester_id UUID NOT NULL REFERENCES public.foi_requesters(id) ON DELETE CASCADE,
  determined_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  determined_on DATE NOT NULL DEFAULT CURRENT_DATE,
  basis TEXT NOT NULL,
  PRIMARY KEY (requester_id, connected_requester_id),
  CHECK (requester_id <> connected_requester_id)
);

CREATE TABLE IF NOT EXISTS public.foi_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES public.foi_requesters(id) ON DELETE RESTRICT,
  -- Aggregation turns on "the same or similar subject". A stated key is
  -- auditable in a way a fuzzy match on the request wording is not.
  subject_key TEXT NOT NULL,
  request_text TEXT NOT NULL,
  -- The clock starts on receipt, not on the day somebody recognised it as a
  -- request. A request recognised eleven days late has eleven days gone.
  received_on DATE NOT NULL,
  recognised_on DATE,
  responded_on DATE,
  refused_on_cost BOOLEAN NOT NULL DEFAULT FALSE,
  -- Working days beyond the statutory twenty, where a genuine public interest
  -- balance needed longer. Recorded as an extension rather than by moving a
  -- deadline column nobody would notice had changed.
  extension_working_days SMALLINT NOT NULL DEFAULT 0
    CHECK (extension_working_days >= 0 AND extension_working_days <= 20),
  extension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((extension_working_days = 0) = (extension_reason IS NULL)),
  CHECK (recognised_on IS NULL OR recognised_on >= received_on)
);

CREATE INDEX IF NOT EXISTS foi_requests_aggregation_idx
  ON public.foi_requests (requester_id, subject_key, received_on);

CREATE INDEX IF NOT EXISTS foi_requests_open_idx
  ON public.foi_requests (received_on)
  WHERE responded_on IS NULL;

-- The clock stops on the day clarification is sought and restarts on the day
-- the answer arrives. Stored as spans so the days already spent stay spent: a
-- request clarified on day fifteen has five days left, not twenty.
CREATE TABLE IF NOT EXISTS public.foi_clarifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.foi_requests(id) ON DELETE CASCADE,
  sought_on DATE NOT NULL,
  sought_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  question TEXT NOT NULL,
  answered_on DATE,
  answer TEXT,
  CHECK (answered_on IS NULL OR answered_on >= sought_on),
  CHECK ((answered_on IS NULL) = (answer IS NULL))
);

-- Two open clarifications would make "is the clock stopped" ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS foi_clarifications_one_open_idx
  ON public.foi_clarifications (request_id)
  WHERE answered_on IS NULL;

CREATE TABLE IF NOT EXISTS public.foi_record_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.foi_requests(id) ON DELETE CASCADE,
  custodian TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Locating, retrieving and extracting. Not reading, redacting or arguing:
  -- including those inflates every estimate past the limit.
  estimated_hours NUMERIC(6, 2) NOT NULL CHECK (estimated_hours >= 0),
  basis_of_estimate TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS foi_record_sets_request_idx
  ON public.foi_record_sets (request_id);

CREATE TABLE IF NOT EXISTS public.foi_exemptions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  -- The distinction the whole classification turns on. An absolute exemption
  -- withholds on its own; a qualified one does not.
  exemption_class TEXT NOT NULL CHECK (exemption_class IN ('ABSOLUTE', 'QUALIFIED'))
);

INSERT INTO public.foi_exemptions (code, description, exemption_class) VALUES
  ('ACCESSIBLE_BY_OTHER_MEANS', 'Reasonably accessible to the applicant by other means', 'ABSOLUTE'),
  ('PERSONAL_DATA_OF_OTHERS',   'Personal data of a third party',                        'ABSOLUTE'),
  ('COURT_RECORDS',             'Held only by virtue of court proceedings',              'ABSOLUTE'),
  ('PROVIDED_IN_CONFIDENCE',    'Obtained in confidence, disclosure actionable',         'ABSOLUTE'),
  ('COMMERCIAL_INTERESTS',      'Would prejudice commercial interests',                  'QUALIFIED'),
  ('POLICY_FORMULATION',        'Relates to the formulation of policy',                  'QUALIFIED'),
  ('HEALTH_AND_SAFETY',         'Would endanger physical or mental health or safety',    'QUALIFIED'),
  ('LAW_ENFORCEMENT',           'Would prejudice law enforcement',                       'QUALIFIED')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.foi_located_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.foi_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  custodian TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disclosure is per item because the usual answer is partial: some of it out,
-- some withheld, and a response that says which is which.
CREATE TABLE IF NOT EXISTS public.foi_item_classifications (
  item_id UUID PRIMARY KEY REFERENCES public.foi_located_items(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('DISCLOSED', 'WITHHELD', 'REDACTED')),
  exemption_code TEXT REFERENCES public.foi_exemptions(code) ON DELETE RESTRICT,
  -- The balance, recorded per exemption because it is the thing an appeal
  -- examines. Free text on both sides: the reasoning is the record.
  public_interest_in_disclosure TEXT,
  public_interest_in_maintaining TEXT,
  balance_favours_withholding BOOLEAN,
  decided_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_on DATE,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nothing is withheld without naming what withholds it.
  CHECK (outcome = 'DISCLOSED' OR exemption_code IS NOT NULL),
  -- A balance is recorded in full or not at all.
  CHECK (
    (public_interest_in_disclosure IS NULL
      AND public_interest_in_maintaining IS NULL
      AND balance_favours_withholding IS NULL
      AND decided_by IS NULL
      AND decided_on IS NULL)
    OR
    (public_interest_in_disclosure IS NOT NULL
      AND public_interest_in_maintaining IS NOT NULL
      AND balance_favours_withholding IS NOT NULL
      AND decided_by IS NOT NULL
      AND decided_on IS NOT NULL)
  )
);

-- A qualified exemption with no recorded balance is an unfinished refusal, and
-- an unfinished refusal discloses. Enforced here so the incomplete row cannot
-- sit in the table looking like a decision.
CREATE OR REPLACE FUNCTION public.foi_qualified_exemption_needs_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_class TEXT;
BEGIN
  IF NEW.outcome = 'DISCLOSED' OR NEW.exemption_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT exemption_class INTO v_class
    FROM public.foi_exemptions
   WHERE code = NEW.exemption_code;

  IF v_class = 'QUALIFIED' AND NEW.balance_favours_withholding IS NULL THEN
    RAISE EXCEPTION
      'Exemption % is qualified and withholding it requires a recorded public interest balance',
      NEW.exemption_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS foi_qualified_exemption_balance_trigger
  ON public.foi_item_classifications;
CREATE TRIGGER foi_qualified_exemption_balance_trigger
  BEFORE INSERT OR UPDATE ON public.foi_item_classifications
  FOR EACH ROW
  EXECUTE FUNCTION public.foi_qualified_exemption_needs_balance();

-- An internal review runs its own clock from the day it is asked for, carrying
-- none of the original's lateness with it.
CREATE TABLE IF NOT EXISTS public.foi_internal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.foi_requests(id) ON DELETE CASCADE,
  requested_on DATE NOT NULL,
  grounds TEXT NOT NULL,
  reviewer UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  concluded_on DATE,
  outcome TEXT CHECK (outcome IN ('UPHELD', 'PARTIALLY_UPHELD', 'OVERTURNED')),
  CHECK ((concluded_on IS NULL) = (outcome IS NULL)),
  CHECK (concluded_on IS NULL OR concluded_on >= requested_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS foi_internal_reviews_one_open_idx
  ON public.foi_internal_reviews (request_id)
  WHERE concluded_on IS NULL;

-- Working days after a date, skipping weekends and closure days. The deadline
-- is computed rather than stored because every input to it changes after the
-- request row is written.
CREATE OR REPLACE FUNCTION public.foi_add_working_days(p_from DATE, p_days INTEGER)
RETURNS DATE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cursor DATE := p_from;
  v_counted INTEGER := 0;
  v_walked INTEGER := 0;
BEGIN
  WHILE v_counted < p_days AND v_walked < 4000 LOOP
    v_cursor := v_cursor + 1;
    v_walked := v_walked + 1;

    IF EXTRACT(ISODOW FROM v_cursor) < 6
       AND NOT EXISTS (
         SELECT 1 FROM public.institutional_closure_days c
          WHERE c.closure_date = v_cursor
       )
    THEN
      v_counted := v_counted + 1;
    END IF;
  END LOOP;

  RETURN v_cursor;
END;
$$;

COMMENT ON FUNCTION public.foi_add_working_days(DATE, INTEGER) IS
  'Working days after a date, excluding the date itself, skipping weekends and closure days.';
COMMENT ON COLUMN public.foi_requests.received_on IS
  'The clock starts on receipt. A request recognised eleven days late has eleven days already gone.';
COMMENT ON TABLE public.foi_clarifications IS
  'Clock suspensions as spans, so days already spent stay spent when the clock restarts.';
