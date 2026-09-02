-- =============================================================================
-- Test Suite: defi_leveraged_yield_donations.test.sql
-- Purpose: Verify MakerDAO CDP variables, liquidation prices, leverage rates,
--          and capital gains tax-exempt calculator offsets.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- 1. Schema verification
SELECT has_column('public', 'lossless_yield_donations', 'collateral_amount', 'collateral_amount column exists');
SELECT has_column('public', 'lossless_yield_donations', 'debt_amount_dai', 'debt_amount_dai column exists');
SELECT has_column('public', 'lossless_yield_donations', 'is_leveraged', 'is_leveraged column exists');

-- Setup seeds
-- Profiles
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES 
  ('00000000-0000-0000-0000-df0000000001'::uuid, 'Donor', 'DeFi', 'student'),
  ('00000000-0000-0000-0000-df0000000002'::uuid, 'Chess', 'Club', 'club_president')
ON CONFLICT (id) DO NOTHING;

-- Donation
INSERT INTO public.lossless_yield_donations (
  id,
  donor_id,
  club_id,
  contract_address,
  principal_locked_usdc,
  apy_rate,
  status
)
VALUES (
  '00000000-0000-0000-0000-df0000000003'::uuid,
  '00000000-0000-0000-0000-df0000000001'::uuid,
  '00000000-0000-0000-0000-df0000000002'::uuid,
  '0xDeFiMockContractAddress',
  1000000.00,
  5.0,
  'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test MakerDAO CDP simulation RPC execution
SELECT is(
  (SELECT public.simulate_maker_cdp_leverage(
    '00000000-0000-0000-0000-df0000000003'::uuid,
    333.33,
    500000.00,
    3000.00
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'Simulation function successfully resolves'
);

SELECT is(
  (SELECT is_leveraged FROM public.lossless_yield_donations WHERE id = '00000000-0000-0000-0000-df0000000003'::uuid),
  TRUE,
  'Donation record is marked as leveraged'
);

SELECT is(
  (SELECT debt_amount_dai FROM public.lossless_yield_donations WHERE id = '00000000-0000-0000-0000-df0000000003'::uuid),
  500000.00,
  'CDP debt DAI amount matches input value'
);

-- Liquidation price check: (500000 * 1.5) / 333.33 = ~2250
SELECT is(
  ROUND((SELECT liquidation_price FROM public.lossless_yield_donations WHERE id = '00000000-0000-0000-0000-df0000000003'::uuid), 0),
  2250,
  'Liquidation Price is mathematically calculated and stored correctly'
);

ROLLBACK;
