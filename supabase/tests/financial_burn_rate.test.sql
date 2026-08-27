-- ============================================================
-- Test Suite: financial_burn_rate.test.sql
-- Description: Verifies time-series expense burn rates and runway month projections.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(5);

-- 1. Check function exists
SELECT has_function('public', 'get_club_burn_rate', 'get_club_burn_rate function should exist');

-- 2. Mock club and transactions
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000fe1',
    'Finances Club',
    'finances-club',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Let's say the club starts with $5000 income, then has expenses of $1000 and $1500
-- Total balance = 5000 - 1000 - 1500 = 2500
-- Total expenses in last 90 days = 1000 + 1500 = 2500
-- Average monthly burn = 2500 / 3 = 833.33
-- Runway in months = 2500 / 833.33 = 3.0 months
INSERT INTO public.club_transactions (id, club_id, amount, transaction_type, category, description, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000ft1', '00000000-0000-0000-0000-000000000fe1', 5000.00, 'INCOME', 'Grants', 'Initial allocation', now() - INTERVAL '40 days'),
    ('00000000-0000-0000-0000-000000000ft2', '00000000-0000-0000-0000-000000000fe1', -1000.00, 'EXPENSE', 'Food', 'September Banquet catering', now() - INTERVAL '30 days'),
    ('00000000-0000-0000-0000-000000000ft3', '00000000-0000-0000-0000-000000000fe1', -1500.00, 'EXPENSE', 'Venue', 'October Hall rentals', now() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Execute function and assert results
SELECT results_eq(
    $$
    SELECT ledger_balance FROM public.get_club_burn_rate('00000000-0000-0000-0000-000000000fe1');
    $$,
    ARRAY[2500.00::numeric],
    'Ledger balance should be 5000 - 1000 - 1500 = 2500'
);

SELECT results_eq(
    $$
    SELECT average_monthly_burn FROM public.get_club_burn_rate('00000000-0000-0000-0000-000000000fe1');
    $$,
    ARRAY[833.33::numeric], -- 2500 / 3 = 833.33
    'Average monthly burn should be round(2500 / 3) = 833.33'
);

SELECT results_eq(
    $$
    SELECT runway_months FROM public.get_club_burn_rate('00000000-0000-0000-0000-000000000fe1');
    $$,
    ARRAY[3.00::numeric], -- 2500 / 833.33 = 3.0
    'Runway in months should be 2500 / 833.33 = 3.0'
);

-- Test zero expense (infinite runway) case
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000fe2',
    'No Expenses Club',
    'no-expenses-club',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

SELECT results_eq(
    $$
    SELECT runway_months FROM public.get_club_burn_rate('00000000-0000-0000-0000-000000000fe2');
    $$,
    ARRAY[999.00::numeric],
    'Runway months should return 999 representing infinity when there is zero burn'
);

ROLLBACK;
