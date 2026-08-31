-- =============================================================================
-- Test Suite: vending_machine_integration.test.sql
-- Purpose: Verify smart vending machine POS dispenses, credit validations,
--          allocation caps, and real-time ledger deductions.
-- =============================================================================

BEGIN;

SELECT plan(8);

-- 1. Schema verification
SELECT has_table('public', 'event_vending_allocations', 'event_vending_allocations table exists');
SELECT has_table('public', 'vending_user_credits', 'vending_user_credits table exists');
SELECT has_table('public', 'vending_dispense_logs', 'vending_dispense_logs table exists');

-- Setup seeds
-- Profiles
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-ve0000000001'::uuid, 'Vending', 'User', 'student')
ON CONFLICT (id) DO NOTHING;

-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-ve0000000002'::uuid, 'HackClub', 'hack-club')
ON CONFLICT (id) DO NOTHING;

-- Event
INSERT INTO public.events (id, club_id, title)
VALUES ('00000000-0000-0000-0000-ve0000000003'::uuid, '00000000-0000-0000-0000-ve0000000002'::uuid, '24h Hackathon')
ON CONFLICT (id) DO NOTHING;

-- Vending Allocation ($50 total, $10 per student limit)
INSERT INTO public.event_vending_allocations (id, event_id, allocated_amount, per_user_limit)
VALUES (
  '00000000-0000-0000-0000-ve0000000004'::uuid,
  '00000000-0000-0000-0000-ve0000000003'::uuid,
  50.00,
  10.00
)
ON CONFLICT (id) DO NOTHING;

-- Vending User Credit (Active, Expires in 1 day)
INSERT INTO public.vending_user_credits (id, allocation_id, user_id, qr_code_token, expires_at)
VALUES (
  '00000000-0000-0000-0000-ve0000000005'::uuid,
  '00000000-0000-0000-0000-ve0000000004'::uuid,
  '00000000-0000-0000-0000-ve0000000001'::uuid,
  'qr-token-hack-123',
  NOW() + INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test Success Dispense ($2.50 item)
SELECT is(
  (SELECT public.dispense_vending_item(
    'qr-token-hack-123',
    'VEND-MACH-A1',
    'Snickers Bar',
    2.50
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'Successful POS dispense executes and returns success'
);

-- Verify spent balance update
SELECT is(
  (SELECT spent_balance FROM public.vending_user_credits WHERE id = '00000000-0000-0000-0000-ve0000000005'::uuid),
  2.50,
  'Student spent balance correctly increments'
);

-- Verify real-time club ledger deduction expense record creation
SELECT is(
  (SELECT COUNT(*)::INT FROM public.club_transactions 
   WHERE club_id = '00000000-0000-0000-0000-ve0000000002'::uuid AND amount = -2.50),
  1,
  'Real-time negative expense transaction correctly registered to Club ledger'
);

-- 3. Test Failure: Exceeds student limit ($9.00 item, since spent is $2.50, total becomes $11.50 > $10.00)
SELECT is(
  (SELECT public.dispense_vending_item(
    'qr-token-hack-123',
    'VEND-MACH-A1',
    'Energy Drink Pack',
    9.00
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'POS dispense fails when cost exceeds student limit'
);

SELECT is(
  (SELECT public.dispense_vending_item(
    'qr-token-hack-123',
    'VEND-MACH-A1',
    'Energy Drink Pack',
    9.00
  ) ->> 'error')::TEXT,
  'Transaction exceeds student credit limit.',
  'Returns appropriate limit check error description'
);

ROLLBACK;
