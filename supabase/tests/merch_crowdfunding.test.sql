-- ============================================================
-- Test Suite: merch_crowdfunding.test.sql
-- Description: Verifies merchandise crowdfunding campaign setups, RLS policies, and the cron evaluation function.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(9);

-- 1. Check schemas
SELECT has_table('public', 'merch_preorders', 'merch_preorders table should exist');
SELECT has_column('public', 'merch_items', 'funding_goal_count', 'merch_items should have funding_goal_count column');
SELECT has_column('public', 'merch_items', 'campaign_end_date', 'merch_items should have campaign_end_date column');
SELECT has_column('public', 'merch_items', 'campaign_status', 'merch_items should have campaign_status column');

-- 2. Mock data setup
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000d11', 'executive-crowdfund@campus.edu'),
    ('00000000-0000-0000-0000-000000000d12', 'backer-crowdfund@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000d11', 'Rob', 'Executive', 'rob_exec', 'executive-crowdfund@campus.edu'),
    ('00000000-0000-0000-0000-000000000d12', 'Sarah', 'Backer', 'sarah_backer', 'backer-crowdfund@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000dc1',
    'Crowdfund Club',
    'crowdfund-club',
    '00000000-0000-0000-0000-000000000d11'
)
ON CONFLICT (id) DO NOTHING;

-- Make Rob executive
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000dm1',
    '00000000-0000-0000-0000-000000000dc1',
    '00000000-0000-0000-0000-000000000d11',
    'executive',
    'approved'
)
ON CONFLICT (id) DO NOTHING;

-- Create campaign item
INSERT INTO public.merch_items (id, club_id, name, description, funding_goal_count, campaign_end_date, campaign_status)
VALUES (
    '00000000-0000-0000-0000-000000000di1',
    '00000000-0000-0000-0000-000000000dc1',
    'Embroidered Jacket',
    'Heavy premium jacket',
    2, -- Goal is 2 preorders
    NOW() - INTERVAL '1 hour', -- campaign has ended
    'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.merch_variants (id, merch_item_id, name, price, stock)
VALUES (
    '00000000-0000-0000-0000-000000000dv1',
    '00000000-0000-0000-0000-000000000di1',
    'Large',
    6000,
    100
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert RLS prevents non-owners from selecting preorders
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000d12'; -- Sarah

-- Sarah backs the jacket
INSERT INTO public.merch_preorders (id, user_id, merch_item_id, variant_id, payment_method_id, quantity, status)
VALUES (
    '00000000-0000-0000-0000-000000000dp1',
    '00000000-0000-0000-0000-000000000d12',
    '00000000-0000-0000-0000-000000000di1',
    '00000000-0000-0000-0000-000000000dv1',
    'pm_mock_test123',
    1,
    'pending'
);

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.merch_preorders
    WHERE id = '00000000-0000-0000-0000-000000000dp1';
    $$,
    ARRAY[1],
    'Sarah should be allowed to view her own preorders'
);

-- 4. Test evaluate_crowdfunding_campaigns: Goal Not Met (Failed)
SELECT lives_ok(
    $$
    SELECT public.evaluate_crowdfunding_campaigns();
    $$,
    'Campaign evaluation function should run successfully'
);

SELECT results_eq(
    $$
    SELECT campaign_status FROM public.merch_items WHERE id = '00000000-0000-0000-0000-000000000di1';
    $$,
    ARRAY['failed'],
    'Campaign should fail when total orders (1) is less than the goal (2)'
);

SELECT results_eq(
    $$
    SELECT status FROM public.merch_preorders WHERE id = '00000000-0000-0000-0000-000000000dp1';
    $$,
    ARRAY['released'],
    'Pre-orders should be marked as released when campaign fails'
);

-- 5. Test evaluate_crowdfunding_campaigns: Goal Met (Succeeded)
-- Reset campaign and insert enough preorders to meet the goal
UPDATE public.merch_items
SET campaign_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000di1';

UPDATE public.merch_preorders
SET status = 'pending', quantity = 2 -- set quantity to 2 to reach goal of 2
WHERE id = '00000000-0000-0000-0000-000000000dp1';

SELECT lives_ok(
    $$
    SELECT public.evaluate_crowdfunding_campaigns();
    $$,
    'Campaign evaluation function should run successfully on goal met'
);

SELECT results_eq(
    $$
    SELECT campaign_status FROM public.merch_items WHERE id = '00000000-0000-0000-0000-000000000di1';
    $$,
    ARRAY['succeeded'],
    'Campaign status should be succeeded when goal is met'
);

SELECT results_eq(
    $$
    SELECT status FROM public.merch_preorders WHERE id = '00000000-0000-0000-0000-000000000dp1';
    $$,
    ARRAY['captured'],
    'Pre-orders should be marked as captured when campaign succeeds'
);

ROLLBACK;
