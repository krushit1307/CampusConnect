-- ============================================================
-- Migration: Student Union Bank — Point Loan System (#4840)
-- Creates collateral-free "Point Loans" so clubs with < 100
-- points can borrow 1,000 auction-locked points at 10% interest,
-- repaid via 50% garnishment of points earned for 3 months.
-- ============================================================

-- Defensive create: ledger_transactions is referenced by several
-- existing functions (award_points, probation penalty) but has no
-- creating migration in this codebase, so we ensure it exists.
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    club_id UUID REFERENCES public.clubs(id),
    event_id UUID,
    amount INT NOT NULL,
    transaction_type TEXT NOT NULL,
    base_points INT,
    streak_multiplier NUMERIC DEFAULT 1.0,
    is_streak_bonus BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.point_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    principal_points INT NOT NULL DEFAULT 1000,
    interest_points INT NOT NULL DEFAULT 100,
    total_owed_points INT NOT NULL DEFAULT 1100,
    amount_repaid_points INT NOT NULL DEFAULT 0,
    locked_points_remaining INT NOT NULL DEFAULT 1000,
    garnishment_rate NUMERIC NOT NULL DEFAULT 0.5,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'garnishment_expired')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    garnishment_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 months'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS active_loan_id UUID REFERENCES public.point_loans(id);

ALTER TABLE public.point_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their own point loans"
    ON public.point_loans FOR SELECT
    USING (
        club_id IN (
            SELECT club_id FROM public.club_members WHERE user_id = auth.uid()
        )
    );

-- Grants a Point Loan to an under-resourced club.
CREATE OR REPLACE FUNCTION public.apply_for_point_loan(p_club_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INT := 0;
    v_existing_loan UUID;
    v_new_loan_id UUID;
BEGIN
    SELECT active_loan_id INTO v_existing_loan FROM public.clubs WHERE id = p_club_id;
    IF v_existing_loan IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Club already has an active point loan.');
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_current_balance
    FROM public.ledger_transactions
    WHERE club_id = p_club_id;

    IF v_current_balance >= 100 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Club must have fewer than 100 points to qualify for a Resource Loan.');
    END IF;

    INSERT INTO public.point_loans (club_id)
    VALUES (p_club_id)
    RETURNING id INTO v_new_loan_id;

    -- Club ledger takes on the negative liability immediately (-1,100).
    INSERT INTO public.ledger_transactions (club_id, amount, transaction_type, description)
    VALUES (p_club_id, -1100, 'loan_debit', 'Student Union Bank Point Loan (10% interest) issued.');

    UPDATE public.clubs SET active_loan_id = v_new_loan_id WHERE id = p_club_id;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', v_new_loan_id,
        'locked_auction_points', 1000,
        'total_owed_points', 1100
    );
END;
$$;

-- Called whenever a club earns points; splits the amount 50/50
-- toward the club and toward loan repayment while a loan is active
-- and within its 3-month garnishment window.
CREATE OR REPLACE FUNCTION public.garnish_club_points(
    p_club_id UUID,
    p_event_id UUID,
    p_gross_points INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan public.point_loans%ROWTYPE;
    v_garnished INT := 0;
    v_net INT := p_gross_points;
BEGIN
    SELECT pl.* INTO v_loan
    FROM public.point_loans pl
    JOIN public.clubs c ON c.active_loan_id = pl.id
    WHERE c.id = p_club_id AND pl.status = 'active';

    IF NOT FOUND OR v_loan.garnishment_expires_at < NOW() THEN
        IF FOUND THEN
            UPDATE public.point_loans SET status = 'garnishment_expired', updated_at = NOW() WHERE id = v_loan.id;
            UPDATE public.clubs SET active_loan_id = NULL WHERE id = p_club_id;
        END IF;

        INSERT INTO public.ledger_transactions (club_id, event_id, amount, transaction_type, description)
        VALUES (p_club_id, p_event_id, p_gross_points, 'gamification_reward', 'Club points awarded.');

        RETURN jsonb_build_object('garnished', 0, 'net_awarded', p_gross_points);
    END IF;

    v_garnished := FLOOR(p_gross_points * v_loan.garnishment_rate);
    v_net := p_gross_points - v_garnished;

    INSERT INTO public.ledger_transactions (club_id, event_id, amount, transaction_type, description)
    VALUES (p_club_id, p_event_id, v_net, 'gamification_reward', 'Club points awarded (50% garnished for loan repayment).');

    INSERT INTO public.ledger_transactions (club_id, event_id, amount, transaction_type, description)
    VALUES (p_club_id, p_event_id, v_garnished, 'loan_garnishment', 'Garnished toward Student Union Bank loan repayment.');

    UPDATE public.point_loans
    SET amount_repaid_points = amount_repaid_points + v_garnished,
        status = CASE WHEN amount_repaid_points + v_garnished >= total_owed_points THEN 'repaid' ELSE status END,
        updated_at = NOW()
    WHERE id = v_loan.id;

    IF (SELECT amount_repaid_points FROM public.point_loans WHERE id = v_loan.id) >= v_loan.total_owed_points THEN
        UPDATE public.clubs SET active_loan_id = NULL WHERE id = p_club_id;
    END IF;

    RETURN jsonb_build_object('garnished', v_garnished, 'net_awarded', v_net);
END;
$$;