-- =============================================================================
-- Migration: Club Dues, Delinquency & Dunning
-- Description: Adds per-club dues plans and per-member invoices, plus the
--              record of which dunning reminders have already been sent, so
--              that membership standing stops being a matter of opinion.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dues_billing_period') THEN
        CREATE TYPE public.dues_billing_period AS ENUM ('monthly', 'semester', 'annual');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dues_proration_policy') THEN
        CREATE TYPE public.dues_proration_policy AS ENUM ('daily', 'none', 'half_cycle');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dues_invoice_status') THEN
        CREATE TYPE public.dues_invoice_status AS ENUM ('issued', 'paid', 'waived', 'void');
    END IF;
END$$;

-- 1. Plans -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_dues_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Membership dues',
    amount_cents BIGINT NOT NULL,
    billing_period public.dues_billing_period NOT NULL DEFAULT 'semester',
    -- First day of the first billing cycle, usually the start of the year.
    cycle_anchor DATE NOT NULL,
    grace_days SMALLINT NOT NULL DEFAULT 7,
    suspend_after_days SMALLINT NOT NULL DEFAULT 30,
    proration public.dues_proration_policy NOT NULL DEFAULT 'daily',
    -- Ordered reminder schedule, e.g.
    -- [{"key":"overdue","offsetDays":1,"channel":"email","template":"dues-overdue"}]
    dunning_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_dues_plans_amount_positive CHECK (amount_cents >= 0),
    CONSTRAINT club_dues_plans_grace_range CHECK (grace_days BETWEEN 0 AND 180),
    CONSTRAINT club_dues_plans_suspend_after_grace CHECK (suspend_after_days >= grace_days),
    CONSTRAINT club_dues_plans_steps_array CHECK (jsonb_typeof(dunning_steps) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_dues_plans_active
    ON public.club_dues_plans (club_id) WHERE is_active;

-- 2. Invoices ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_dues_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.club_dues_plans(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    amount_due_cents BIGINT NOT NULL,
    amount_paid_cents BIGINT NOT NULL DEFAULT 0,
    status public.dues_invoice_status NOT NULL DEFAULT 'issued',
    waived_reason TEXT,
    -- Keys of dunning steps already sent, so a reminder is never repeated.
    sent_step_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_dues_invoices_amounts CHECK (
        amount_due_cents >= 0 AND amount_paid_cents >= 0
    ),
    CONSTRAINT club_dues_invoices_period_order CHECK (period_end >= period_start),
    CONSTRAINT club_dues_invoices_unique_period UNIQUE (plan_id, member_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_club_dues_invoices_club_status
    ON public.club_dues_invoices (club_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_club_dues_invoices_member
    ON public.club_dues_invoices (member_id, due_date DESC);

-- 3. Payments recorded against an invoice ------------------------------------

CREATE TABLE IF NOT EXISTS public.club_dues_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.club_dues_invoices(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_dues_payments_amount_positive CHECK (amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_club_dues_payments_invoice
    ON public.club_dues_payments (invoice_id);

-- Payments roll up onto the invoice so the roster can be read in one query.
CREATE OR REPLACE FUNCTION public.apply_dues_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total BIGINT;
    v_due BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total
    FROM public.club_dues_payments
    WHERE invoice_id = NEW.invoice_id;

    SELECT amount_due_cents INTO v_due
    FROM public.club_dues_invoices
    WHERE id = NEW.invoice_id;

    UPDATE public.club_dues_invoices
    SET amount_paid_cents = v_total,
        status = CASE
            WHEN status IN ('waived', 'void') THEN status
            WHEN v_total >= v_due THEN 'paid'::public.dues_invoice_status
            ELSE 'issued'::public.dues_invoice_status
        END,
        updated_at = NOW()
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_dues_payment ON public.club_dues_payments;
CREATE TRIGGER trg_apply_dues_payment
AFTER INSERT ON public.club_dues_payments
FOR EACH ROW
EXECUTE FUNCTION public.apply_dues_payment();

-- 4. Recording that a dunning step has been sent -----------------------------
--
-- Appends the step key only if it is not already present, so a retried job
-- cannot cause a member to be chased twice for the same reminder.
CREATE OR REPLACE FUNCTION public.record_dunning_step(
    p_invoice_id UUID,
    p_step_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE public.club_dues_invoices
    SET sent_step_keys = array_append(sent_step_keys, p_step_key),
        updated_at = NOW()
    WHERE id = p_invoice_id
      AND NOT (p_step_key = ANY (sent_step_keys));

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_dunning_step(UUID, TEXT) TO authenticated;

-- 5. Row level security ------------------------------------------------------

ALTER TABLE public.club_dues_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_dues_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_dues_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can see the dues plan" ON public.club_dues_plans;
CREATE POLICY "Members can see the dues plan"
ON public.club_dues_plans FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage the dues plan" ON public.club_dues_plans;
CREATE POLICY "Officers manage the dues plan"
ON public.club_dues_plans FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

-- A member sees their own invoices; officers see the whole roster.
DROP POLICY IF EXISTS "Members see their own invoices" ON public.club_dues_invoices;
CREATE POLICY "Members see their own invoices"
ON public.club_dues_invoices FOR SELECT
USING (member_id = auth.uid() OR public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage invoices" ON public.club_dues_invoices;
CREATE POLICY "Officers manage invoices"
ON public.club_dues_invoices FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Members see payments on their invoices" ON public.club_dues_payments;
CREATE POLICY "Members see payments on their invoices"
ON public.club_dues_payments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_dues_invoices i
        WHERE i.id = club_dues_payments.invoice_id
          AND (i.member_id = auth.uid() OR public.is_club_admin(i.club_id, auth.uid()))
    )
);

DROP POLICY IF EXISTS "Officers record payments" ON public.club_dues_payments;
CREATE POLICY "Officers record payments"
ON public.club_dues_payments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_dues_invoices i
        WHERE i.id = club_dues_payments.invoice_id
          AND public.is_club_admin(i.club_id, auth.uid())
    )
);
