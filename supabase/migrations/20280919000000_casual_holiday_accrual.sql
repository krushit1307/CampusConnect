-- Issue #5262: Irregular-hours holiday entitlement accrual for casual student staff
--
-- There is no annual_leave_days column anywhere here. An irregular-hours worker
-- does not have an allowance handed to them at the start of the year; they
-- accrue entitlement per hour, and a fixed number is wrong for everyone who did
-- not work a full year.
--
-- Balance is derived from the pay periods and the leave taken, both of which
-- keep changing after any given payroll run. A stored balance is correct until
-- the first backdated timesheet.
--
-- The leave year hangs off the worker rather than the institution because a
-- casual contract that starts in October has a leave year that starts in
-- October, and the balance a leave-year boundary produces depends entirely on
-- where that boundary is.

CREATE TABLE IF NOT EXISTS public.worker_leave_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  -- Exclusive. A year ending on 1 April does not include 1 April.
  ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.worker_leave_years
  DROP CONSTRAINT IF EXISTS worker_leave_years_no_overlap;

-- Overlapping leave years would make "which year does this leave belong to" a
-- question with two answers, and the two answers are two different balances.
ALTER TABLE public.worker_leave_years
  ADD CONSTRAINT worker_leave_years_no_overlap
  EXCLUDE USING gist (
    worker_id WITH =,
    daterange(starts_on, ends_on, '[)') WITH &&
  );

CREATE TABLE IF NOT EXISTS public.casual_pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  hours_worked NUMERIC(8, 3) NOT NULL DEFAULT 0 CHECK (hours_worked >= 0),
  -- Hours not worked because the worker was on sick or family leave. These
  -- accrue entitlement exactly as worked hours do, and an implementation that
  -- multiplies hours_worked alone drops them in the months where dropping them
  -- matters most to the person it happens to.
  statutory_leave_hours_credited NUMERIC(8, 3) NOT NULL DEFAULT 0
    CHECK (statutory_leave_hours_credited >= 0),
  hourly_rate_pence INTEGER NOT NULL CHECK (hourly_rate_pence > 0),
  -- What was actually paid as holiday pay in this period.
  rolled_up_paid_pence INTEGER NOT NULL DEFAULT 0 CHECK (rolled_up_paid_pence >= 0),
  -- Whether it was shown separately on the payslip, which is a separate
  -- question from whether the right amount went out. Paying it without
  -- itemising it does not discharge the obligation.
  rolled_up_itemised BOOLEAN NOT NULL DEFAULT FALSE,
  paid_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on > starts_on)
);

CREATE INDEX IF NOT EXISTS casual_pay_periods_worker_window_idx
  ON public.casual_pay_periods (worker_id, starts_on, ends_on);

CREATE INDEX IF NOT EXISTS casual_pay_periods_non_compliant_idx
  ON public.casual_pay_periods (worker_id, starts_on)
  WHERE rolled_up_itemised = FALSE;

CREATE TABLE IF NOT EXISTS public.casual_leave_taken (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The date the leave was taken. Leave booked in March and taken in April
  -- belongs to the year containing April, whatever the booking screen said.
  taken_on DATE NOT NULL,
  hours NUMERIC(8, 3) NOT NULL CHECK (hours > 0),
  approved_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casual_leave_taken_worker_idx
  ON public.casual_leave_taken (worker_id, taken_on);

-- Carry-over is a decision, so it is a row with a reason rather than a number
-- that appears in next year's opening balance. Leave the worker was prevented
-- from taking carries differently from leave they simply did not book, and
-- collapsing the two either gives away entitlement that lapsed or takes away
-- entitlement that did not.
CREATE TABLE IF NOT EXISTS public.casual_leave_carry_over (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_leave_year_id UUID NOT NULL
    REFERENCES public.worker_leave_years(id) ON DELETE CASCADE,
  to_leave_year_id UUID NOT NULL
    REFERENCES public.worker_leave_years(id) ON DELETE CASCADE,
  basis TEXT NOT NULL CHECK (basis IN ('PREVENTED_FROM_TAKING', 'BY_AGREEMENT')),
  hours NUMERIC(8, 3) NOT NULL CHECK (hours > 0),
  reason TEXT NOT NULL,
  decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_on DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (worker_id, from_leave_year_id, basis),
  CHECK (from_leave_year_id <> to_leave_year_id)
);

CREATE TABLE IF NOT EXISTS public.casual_termination_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terminated_on DATE NOT NULL,
  untaken_hours NUMERIC(8, 3) NOT NULL CHECK (untaken_hours >= 0),
  -- The average actually used, kept because it is the number the worker would
  -- query and it cannot be recomputed once the pay history is archived.
  average_weekly_pay_pence INTEGER NOT NULL CHECK (average_weekly_pay_pence >= 0),
  average_weekly_hours NUMERIC(8, 3) NOT NULL CHECK (average_weekly_hours >= 0),
  reference_weeks_used SMALLINT NOT NULL CHECK (reference_weeks_used >= 0),
  reference_weeks_skipped SMALLINT NOT NULL DEFAULT 0 CHECK (reference_weeks_skipped >= 0),
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  paid_on DATE,
  UNIQUE (worker_id, terminated_on)
);

-- 5.6 weeks over the 46.4 remaining working weeks. Kept as a function rather
-- than a literal sprinkled through queries, because the day it changes it has
-- to change in one place.
CREATE OR REPLACE FUNCTION public.casual_accrual_rate()
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT 5.6 / 46.4;
$$;

-- Entitlement earned by one pay period.
CREATE OR REPLACE FUNCTION public.casual_period_accrual_hours(p_period_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT ROUND(
    (p.hours_worked + p.statutory_leave_hours_credited) * public.casual_accrual_rate(),
    3
  )
  FROM public.casual_pay_periods p
  WHERE p.id = p_period_id;
$$;

-- Periods that did not discharge the rolled-up obligation, for either reason.
-- Underpaying and not itemising are separate failures and both are reported,
-- because fixing one does not fix the other.
CREATE OR REPLACE VIEW public.casual_rolled_up_compliance AS
SELECT
  p.id AS period_id,
  p.worker_id,
  p.starts_on,
  p.ends_on,
  ROUND((p.hours_worked + p.statutory_leave_hours_credited) * public.casual_accrual_rate(), 3)
    AS accrued_hours,
  ROUND(
    (p.hours_worked + p.statutory_leave_hours_credited)
      * public.casual_accrual_rate() * p.hourly_rate_pence
  )::INTEGER AS due_pence,
  p.rolled_up_paid_pence AS paid_pence,
  p.rolled_up_itemised AS itemised,
  (
    p.rolled_up_paid_pence >= ROUND(
      (p.hours_worked + p.statutory_leave_hours_credited)
        * public.casual_accrual_rate() * p.hourly_rate_pence
    )
    AND (
      p.rolled_up_itemised
      OR (p.hours_worked + p.statutory_leave_hours_credited) = 0
    )
  ) AS compliant
FROM public.casual_pay_periods p;

-- Accrual over a leave year, with a pay period straddling the boundary split
-- pro-rata on elapsed time. The period does not record hours per day, so this
-- is an approximation — a far smaller one than assigning the whole period to
-- whichever side its end date happens to fall.
CREATE OR REPLACE FUNCTION public.casual_year_accrual_hours(
  p_worker_id UUID,
  p_leave_year_id UUID
) RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(ROUND(SUM(
    (p.hours_worked + p.statutory_leave_hours_credited)
      * public.casual_accrual_rate()
      * (
          GREATEST(0, LEAST(p.ends_on, y.ends_on) - GREATEST(p.starts_on, y.starts_on))::NUMERIC
          / NULLIF((p.ends_on - p.starts_on)::NUMERIC, 0)
        )
  ), 3), 0)
  FROM public.casual_pay_periods p
  JOIN public.worker_leave_years y ON y.id = p_leave_year_id
  WHERE p.worker_id = p_worker_id
    AND p.starts_on < y.ends_on
    AND p.ends_on > y.starts_on;
$$;

ALTER TABLE public.casual_pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casual_leave_taken ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casual_termination_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS casual_pay_periods_self_read ON public.casual_pay_periods;
CREATE POLICY casual_pay_periods_self_read
  ON public.casual_pay_periods
  FOR SELECT
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS casual_leave_taken_self_read ON public.casual_leave_taken;
CREATE POLICY casual_leave_taken_self_read
  ON public.casual_leave_taken
  FOR SELECT
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS casual_termination_payments_self_read ON public.casual_termination_payments;
CREATE POLICY casual_termination_payments_self_read
  ON public.casual_termination_payments
  FOR SELECT
  USING (worker_id = auth.uid());

COMMENT ON COLUMN public.casual_pay_periods.statutory_leave_hours_credited IS
  'Hours on sick or family leave. They accrue entitlement exactly as worked hours do.';
COMMENT ON COLUMN public.casual_pay_periods.rolled_up_itemised IS
  'Paying the right amount without itemising it does not discharge the obligation.';
COMMENT ON COLUMN public.casual_termination_payments.average_weekly_pay_pence IS
  'The average actually used, kept because it cannot be recomputed once pay history is archived.';
COMMENT ON TABLE public.casual_leave_carry_over IS
  'Carry-over as a decision with a basis. Prevented-from-taking and by-agreement carry differently.';
