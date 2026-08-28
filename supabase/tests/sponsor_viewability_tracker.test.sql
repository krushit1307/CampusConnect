-- ============================================================
-- Test Suite: sponsor_viewability_tracker.test.sql
-- Description: Verifies 'Sponsor Logo Impression Viewability Tracker' (#4816)
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(13);

-- 1. Check Tables and Columns
SELECT has_table('public', 'sponsor_escrows', 'sponsor_escrows table should exist');
SELECT has_column('public', 'sponsor_escrows', 'sponsor_id', 'sponsor_escrows should have sponsor_id');
SELECT has_column('public', 'sponsor_escrows', 'balance', 'sponsor_escrows should have balance');

SELECT has_table('public', 'sponsor_impression_logs', 'sponsor_impression_logs table should exist');
SELECT has_column('public', 'sponsor_impression_logs', 'sponsor_id', 'sponsor_impression_logs should have sponsor_id');
SELECT has_column('public', 'sponsor_impression_logs', 'event_id', 'sponsor_impression_logs should have event_id');
SELECT has_column('public', 'sponsor_impression_logs', 'time_in_view_ms', 'sponsor_impression_logs should have time_in_view_ms');

-- 2. Mock Setup
-- Add mock sponsor, event, event_sponsorship, and asset
INSERT INTO public.sponsors (id, company_name, contact_email)
VALUES ('77777777-7777-7777-7777-777777777701', 'Test Sponsor Corp', 'sponsor@testcorp.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('77777777-7777-7777-7777-aaaaaaaaaaaa', 'Test Club', 'test-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status)
VALUES ('77777777-7777-7777-7777-eeeeeeeeee01', '77777777-7777-7777-7777-aaaaaaaaaaaa', 'Test Event', 10, 10, NOW(), NOW() + INTERVAL '2 hours', 'PUBLISHED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_sponsorships (id, sponsor_id, event_id, sponsorship_amount, tier)
VALUES ('77777777-7777-7777-7777-ssssssssss01', '77777777-7777-7777-7777-777777777701', '77777777-7777-7777-7777-eeeeeeeeee01', 500.00, 'Gold')
ON CONFLICT (id) DO NOTHING;

-- Initialize escrow with $10
INSERT INTO public.sponsor_escrows (sponsor_id, balance)
VALUES ('77777777-7777-7777-7777-777777777701', 10.0000)
ON CONFLICT (sponsor_id) DO NOTHING;

-- 3. Test Viewability Verification Function (Error validation)
SELECT throws_like(
    $$ SELECT public.record_sponsor_logo_impression('77777777-7777-7777-7777-777777777701', '77777777-7777-7777-7777-eeeeeeeeee01', 1500) $$,
    '%Invalid impression: time_in_view_ms must be at least 2000ms%',
    'Should throw error if time in view is less than 2000ms'
);

-- 4. Test Valid Impression and Escrow Deduction
SELECT lives_ok(
    $$ SELECT public.record_sponsor_logo_impression('77777777-7777-7777-7777-777777777701', '77777777-7777-7777-7777-eeeeeeeeee01', 2500) $$,
    'Should record valid impression without error'
);

-- Verify balance deducted by $0.50
SELECT results_eq(
    $$ SELECT balance FROM public.sponsor_escrows WHERE sponsor_id = '77777777-7777-7777-7777-777777777701' $$,
    $$ VALUES (9.5000::numeric) $$,
    'Escrow balance should be exactly 9.5000 after 1 impression'
);

-- Verify impression log is created
SELECT is(
    (SELECT count(*)::int FROM public.sponsor_impression_logs 
     WHERE sponsor_id = '77777777-7777-7777-7777-777777777701' 
       AND event_id = '77777777-7777-7777-7777-eeeeeeeeee01'
       AND time_in_view_ms = 2500),
    1,
    'Sponsor impression log should be created with correct details'
);

-- Verify marketing asset impressions incremented
SELECT is(
    (SELECT impressions::int FROM public.sponsorship_marketing_assets 
     WHERE sponsorship_id = '77777777-7777-7777-7777-ssssssssss01' 
       AND asset_type = 'logo_placement'),
    1,
    'Logo placement marketing asset impressions count should be 1'
);

-- 5. Test Auto-Provisioning of Escrow balance
-- Create another sponsor without escrow
INSERT INTO public.sponsors (id, company_name, contact_email)
VALUES ('77777777-7777-7777-7777-777777777702', 'Sponsor Two Corp', 'sponsor2@testcorp.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_sponsorships (id, sponsor_id, event_id, sponsorship_amount, tier)
VALUES ('77777777-7777-7777-7777-ssssssssss02', '77777777-7777-7777-7777-777777777702', '77777777-7777-7777-7777-eeeeeeeeee01', 200.00, 'Silver')
ON CONFLICT (id) DO NOTHING;

-- Call record impression which should auto-provision $100 and deduct $0.50
SELECT lives_ok(
    $$ SELECT public.record_sponsor_logo_impression('77777777-7777-7777-7777-777777777702', '77777777-7777-7777-7777-eeeeeeeeee01', 3000) $$,
    'Should record impression and auto-provision escrow'
);

SELECT results_eq(
    $$ SELECT balance FROM public.sponsor_escrows WHERE sponsor_id = '77777777-7777-7777-7777-777777777702' $$,
    $$ VALUES (99.5000::numeric) $$,
    'Escrow balance should be exactly 99.5000 after auto-provision and deduction'
);

ROLLBACK;
