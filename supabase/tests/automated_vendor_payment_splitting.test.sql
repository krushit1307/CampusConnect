-- Test suite: Automated Vendor Payment Splitting Test
BEGIN;
SELECT plan(13);

-- 1. Setup mock events, clubs, users
INSERT INTO public.clubs (id, name, slug, description, visibility, is_private)
VALUES ('c_split_1', 'Split Club', 'split-club', 'desc', 'public', false);

INSERT INTO public.events (id, title, description, start_date, created_by, club_id)
VALUES ('e_split_1', 'Split Festival', 'Festival description', NOW() + INTERVAL '1 day', '00000000-0000-0000-0000-000000000000', 'c_split_1');

-- Add active user
INSERT INTO auth.users (id, email)
VALUES ('77777777-7777-7777-7777-777777777777', 'attendee@connect.edu');

-- Set up wallet for user
INSERT INTO public.user_wallets (user_id, balance)
VALUES ('77777777-7777-7777-7777-777777777777', 5000); -- $50.00 in credits

-- 2. Setup vendors with different onboarding configurations
INSERT INTO public.event_vendors (id, event_id, name, description, approval_status, stripe_account_id, payouts_enabled, profit_share_pct)
VALUES 
    ('v_split_ok', 'e_split_1', 'Vendor Good', 'Delicious hot dogs', 'APPROVED', 'acct_vendor_ok', true, 10.00), -- 10% fee
    ('v_split_pending', 'e_split_1', 'Vendor Pending', 'Pending vendor info', 'PENDING', 'acct_vendor_pend', true, 5.00),
    ('v_split_nostripe', 'e_split_1', 'Vendor No Stripe', 'No stripe account', 'APPROVED', NULL, false, 0.00);

-- Verify columns exist
SELECT has_column('public', 'event_vendors', 'stripe_account_id', 'event_vendors table should have stripe_account_id column');
SELECT has_column('public', 'event_vendors', 'payouts_enabled', 'event_vendors table should have payouts_enabled column');
SELECT has_column('public', 'event_vendors', 'profit_share_pct', 'event_vendors table should have profit_share_pct column');

-- Test 1: Fail payment when balance is insufficient
SELECT throws_ok(
    $$ SELECT public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_ok', 10000, 'Overdraft ticket') $$,
    'P0001',
    NULL,
    'Should throw exception for insufficient wallet balance'
);

-- Test 2: Fail payment if vendor is not approved
SELECT throws_ok(
    $$ SELECT public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_pending', 1000, 'Buy taco') $$,
    'P0001',
    'Vendor is not approved',
    'Should throw exception for unapproved vendor'
);

-- Test 3: Fail payment if vendor has no stripe setup
SELECT throws_ok(
    $$ SELECT public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_nostripe', 1000, 'Buy ice cream') $$,
    'P0001',
    'Vendor is not configured for Stripe payouts',
    'Should throw exception for missing Stripe payout status'
);

-- Test 4: Successful payout calculation and split routing
SELECT lives_ok(
    $$ SELECT public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_ok', 1000, 'Scan Hotdog') $$,
    'Should complete payment successfully under normal conditions'
);

-- Verify balances
SELECT results_eq(
    $$ SELECT balance FROM public.user_wallets WHERE user_id = '77777777-7777-7777-7777-777777777777' $$,
    $$ VALUES (4000) $$,
    'Wallet balance should be decremented by $10 (1000 cents)'
);

-- Verify split results using the RPC output return values
SELECT results_eq(
    $$ SELECT (public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_ok', 1000, 'Hotdog Split'))->>'vendor_payout_cents' $$,
    $$ VALUES ('900') $$,
    'Vendor should receive remaining profit split (90% = 900 cents)'
);

SELECT results_eq(
    $$ SELECT (public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_ok', 1000, 'Hotdog Split'))->>'fee_cents' $$,
    $$ VALUES ('100') $$,
    'Platform/Club fee split should match the profit percentage (10% = 100 cents)'
);

SELECT results_eq(
    $$ SELECT (public.process_vendor_wallet_payment('77777777-7777-7777-7777-777777777777', 'v_split_ok', 1000, 'Hotdog Split'))->>'stripe_account_id' $$,
    $$ VALUES ('acct_vendor_ok') $$,
    'Returned connected Stripe account ID should match the vendor record'
);

-- Verify ledger transaction logging
SELECT results_eq(
    $$ SELECT amount, transaction_type, reference_id FROM public.wallet_transactions WHERE description = 'Scan Hotdog' $$,
    $$ VALUES (-1000, 'purchase', 'v_split_ok'::UUID) $$,
    'Wallet transactions ledger must log the purchase with correct amount and reference'
);

SELECT * FROM finish();
ROLLBACK;
