-- =============================================================================
-- Test Suite: caterer_zk_snark_compliance.test.sql
-- Purpose: Verify zk-SNARK proof submissions, cryptographic verification steps,
--          FDA safety criteria, and Stripe release configurations.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- 1. Schema checks
SELECT has_table('public', 'caterer_zk_proofs', 'caterer_zk_proofs table exists');
SELECT has_column('public', 'caterer_zk_proofs', 'proof_hash', 'proof_hash column exists');
SELECT has_column('public', 'event_caterer_contracts', 'zk_compliance_status', 'zk_compliance_status column exists');

-- Setup seeds
-- Profiles
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-zk0000000001'::uuid, 'Alice', 'Organizer', 'student')
ON CONFLICT (id) DO NOTHING;

-- Event
INSERT INTO public.events (id, club_id, title, created_by)
VALUES (
  '00000000-0000-0000-0000-zk0000000002'::uuid,
  '00000000-0000-0000-0000-da0000000004'::uuid, -- Reusing Dutch Club uuid from seeds
  'ZK Safety Event',
  '00000000-0000-0000-0000-zk0000000001'::uuid
)
ON CONFLICT (id) DO NOTHING;

-- Event Caterer Contract
INSERT INTO public.event_caterer_contracts (id, event_id, caterer_name, caterer_email, rfp_finalized_at)
VALUES (
  '00000000-0000-0000-0000-zk0000000003'::uuid,
  '00000000-0000-0000-0000-zk0000000002'::uuid,
  'ZK Caterer LLC',
  'chef@zkcater.com',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test submit_caterer_zk_proof RPC execution
SELECT is(
  (SELECT public.submit_caterer_zk_proof(
    '00000000-0000-0000-0000-zk0000000003'::uuid,
    'Lot 123',
    'zk-snark-groth16-proof-hash-abc-123',
    5000,
    40.00
  ) ->> 'status')::TEXT,
  'VERIFIED',
  'Cryptographic zk-SNARK verification function successfully resolves'
);

SELECT is(
  (SELECT verification_status FROM public.caterer_zk_proofs WHERE contract_id = '00000000-0000-0000-0000-zk0000000003'::uuid),
  'VERIFIED',
  'ZK proof record status is verified'
);

SELECT is(
  (SELECT shipment_status FROM public.event_caterer_contracts WHERE id = '00000000-0000-0000-0000-zk0000000003'::uuid),
  'SAFE',
  'Caterer contract shipment status is set to SAFE'
);

SELECT is(
  (SELECT stripe_payment_blocked FROM public.event_caterer_contracts WHERE id = '00000000-0000-0000-0000-zk0000000003'::uuid),
  FALSE,
  'Stripe payment block is successfully cleared'
);

ROLLBACK;
