-- =============================================================================
-- Test Suite: vendor_sla_escrow_slashing.test.sql
-- Purpose: Verify multi-oracle SLA checks, temperature threshold penalties,
--          real-time ledger refunds, and transaction statuses.
-- =============================================================================

BEGIN;

SELECT plan(9);

-- 1. Schema verification
SELECT has_column('public', 'vendor_contracts', 'delivery_deadline', 'delivery_deadline column exists');
SELECT has_column('public', 'vendor_contracts', 'min_temp_limit', 'min_temp_limit column exists');
SELECT has_column('public', 'vendor_contracts', 'status', 'status column exists');

-- Setup seeds
-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-sl0000000001'::uuid, 'Gourmet Club', 'gourmet-club')
ON CONFLICT (id) DO NOTHING;

-- Contract 1 (For Slashed case)
INSERT INTO public.vendor_contracts (
  id, 
  club_id, 
  vendor_name, 
  expiration_date, 
  amount, 
  delivery_deadline, 
  min_temp_limit, 
  status
)
VALUES (
  '00000000-0000-0000-0000-sl0000000002'::uuid,
  '00000000-0000-0000-0000-sl0000000001'::uuid,
  'Pizza Plaza',
  '2028-12-31'::date,
  100.00,
  NOW() + INTERVAL '2 hours',
  140.00,
  'PENDING'
)
ON CONFLICT (id) DO NOTHING;

-- Contract 2 (For Released 100% case)
INSERT INTO public.vendor_contracts (
  id, 
  club_id, 
  vendor_name, 
  expiration_date, 
  amount, 
  delivery_deadline, 
  min_temp_limit, 
  status
)
VALUES (
  '00000000-0000-0000-0000-sl0000000003'::uuid,
  '00000000-0000-0000-0000-sl0000000001'::uuid,
  'Pizza Express',
  '2028-12-31'::date,
  200.00,
  NOW() + INTERVAL '2 hours',
  140.00,
  'PENDING'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test SLA Violation: Temperature is below 140°F (125°F) -> 50% slash
SELECT is(
  (SELECT public.execute_vendor_sla_payout(
    '00000000-0000-0000-0000-sl0000000002'::uuid,
    NOW(),
    125.00,
    'oracle-signature-cold'
  ) ->> 'payout_status')::TEXT,
  'SLASHED',
  'Contract with temperature < 140F triggers SLASHED payout status'
);

SELECT is(
  (SELECT status FROM public.vendor_contracts WHERE id = '00000000-0000-0000-0000-sl0000000002'::uuid),
  'SLASHED',
  'Contract status is updated to SLASHED'
);

SELECT is(
  (SELECT slashed_amount FROM public.vendor_contracts WHERE id = '00000000-0000-0000-0000-sl0000000002'::uuid),
  50.00,
  'Slashed amount is set to exactly 50%'
);

-- Verify real-time positive ledger refund is written
SELECT is(
  (SELECT COUNT(*)::INT FROM public.club_transactions 
   WHERE club_id = '00000000-0000-0000-0000-sl0000000001'::uuid AND amount = 50.00),
  1,
  'Positive refund credit is added back to club ledger balance'
);

-- 3. Test SLA Verification Success: Temperature >= 140°F (145°F) -> 100% payout
SELECT is(
  (SELECT public.execute_vendor_sla_payout(
    '00000000-0000-0000-0000-sl0000000003'::uuid,
    NOW(),
    145.00,
    'oracle-signature-hot'
  ) ->> 'payout_status')::TEXT,
  'RELEASED',
  'Contract with temperature >= 140F triggers RELEASED payout status'
);

SELECT is(
  (SELECT status FROM public.vendor_contracts WHERE id = '00000000-0000-0000-0000-sl0000000003'::uuid),
  'RELEASED',
  'Contract status is updated to RELEASED'
);

ROLLBACK;
