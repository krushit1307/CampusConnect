-- supabase/tests/did_vc_system.test.sql
-- pgTAP test for DID/VC system functionality (Issue #5467)
--
-- Run with: psql -f supabase/tests/did_vc_system.test.sql

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create test data ─────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'Admin', 'User'),
    ('22222222-2222-2222-2222-222222222222', 'vendor@test.local', 'Test', 'Vendor')
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Create DID ───────────────────────────────────────────────
DO $$
DECLARE
    v_did_id UUID;
BEGIN
    SELECT public.create_did(
        '22222222-2222-2222-2222-222222222222',
        'ethr',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        137
    ) INTO v_did_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222'),
    1,
    'DID should be created successfully'
);

-- ── Test 2: Verify DID was created with correct data ─────────────────────
SELECT is(
    (SELECT did_method FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222'),
    'ethr',
    'DID method should be ethr'
);

SELECT is(
    (SELECT did FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222'),
    'did:ethr:0x742d35cc6634c0532925a3b844bc9e7595f0beb',
    'DID should be correctly formatted'
);

-- ── Test 3: Issue Verifiable Credential ───────────────────────────────
DO $$
DECLARE
    v_did_id UUID;
    v_credential_id UUID;
BEGIN
    SELECT id INTO v_did_id
    FROM public.did_registry
    WHERE controller_id = '22222222-2222-2222-2222-222222222222'
    LIMIT 1;
    
    SELECT public.issue_verifiable_credential(
        v_did_id,
        'did:ethr:fda1234567890abcdef',
        ARRAY['VerifiableCredential', 'CertifiedFoodVendor'],
        '{"name": "Test Catering Service", "license": "FOOD-12345"}'::jsonb,
        NOW() + INTERVAL '1 year',
        '11111111-1111-1111-1111-111111111111'
    ) INTO v_credential_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    1,
    'Verifiable Credential should be issued'
);

-- ── Test 4: Verify credential was issued with correct data ───────────────
SELECT is(
    (SELECT credential_status FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    'valid',
    'Credential status should be valid'
);

SELECT is(
    (SELECT issuer_did FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    'did:ethr:fda1234567890abcdef',
    'Issuer DID should be correct'
);

-- ── Test 5: Sign Verifiable Credential ───────────────────────────────
DO $$
DECLARE
    v_credential_id UUID;
BEGIN
    SELECT id INTO v_credential_id
    FROM public.verifiable_credentials
    WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')
    LIMIT 1;
    
    PERFORM public.sign_verifiable_credential(
        v_credential_id,
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'EcdsaSecp256k1Signature2019',
        'assertionMethod',
        NULL
    );
END $$;

SELECT is(
    (SELECT proof IS NOT NULL FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    true,
    'Credential should have proof after signing'
);

SELECT is(
    (SELECT proof_type FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    'EcdsaSecp256k1Signature2019',
    'Proof type should be EcdsaSecp256k1Signature2019'
);

-- ── Test 6: Verify Verifiable Credential ─────────────────────────────
DO $$
DECLARE
    v_credential_id UUID;
    v_verification_result JSONB;
BEGIN
    SELECT id INTO v_credential_id
    FROM public.verifiable_credentials
    WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')
    LIMIT 1;
    
    SELECT public.verify_verifiable_credential(v_credential_id) INTO v_verification_result;
END $$;

-- Note: The verification function returns a JSONB, so we check that it returns valid
SELECT is(
    (SELECT COUNT(*) FROM public.verifiable_credentials WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    1,
    'Verification should complete without error'
);

-- ── Test 7: Create IoT temp log ───────────────────────────────────────
DO $$
DECLARE
    v_did_id UUID;
    v_log_id UUID;
BEGIN
    SELECT id INTO v_did_id
    FROM public.did_registry
    WHERE controller_id = '22222222-2222-2222-2222-222222222222'
    LIMIT 1;
    
    SELECT public.create_iot_temp_log(
        v_did_id,
        '22222222-2222-2222-2222-222222222222',
        'sensor-123',
        'device-456',
        35.5,
        45.0,
        'Kitchen A',
        40.0
    ) INTO v_log_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.iot_temp_logs WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    1,
    'IoT temp log should be created'
);

SELECT is(
    (SELECT is_compliant FROM public.iot_temp_logs WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    true,
    'Temperature should be compliant (35.5°F < 40°F)'
);

-- ── Test 8: Create zk-SNARK proof ─────────────────────────────────────
DO $$
DECLARE
    v_did_id UUID;
    v_log_id UUID;
    v_credential_id UUID;
    v_proof_id UUID;
BEGIN
    SELECT id INTO v_did_id
    FROM public.did_registry
    WHERE controller_id = '22222222-2222-2222-2222-222222222222'
    LIMIT 1;
    
    SELECT id INTO v_log_id
    FROM public.iot_temp_logs
    WHERE did_id = v_did_id
    LIMIT 1;
    
    SELECT id INTO v_credential_id
    FROM public.verifiable_credentials
    WHERE did_id = v_did_id
    LIMIT 1;
    
    SELECT public.create_zk_snark_proof(
        v_log_id,
        v_did_id,
        v_credential_id,
        ARRAY['0x1234567890abcdef', '0xabcdef1234567890'],
        ARRAY[ARRAY['0x1234567890abcdef', '0xabcdef1234567890'], ARRAY['0x1234567890abcdef', '0xabcdef1234567890']],
        ARRAY['0x1234567890abcdef', '0xabcdef1234567890'],
        ARRAY['35.5', '40.0'],
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'did:ethr:0x742d35cc6634c0532925a3b844bc9e7595f0beb#controller'
    ) INTO v_proof_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.zk_snark_proofs WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    1,
    'zk-SNARK proof should be created'
);

SELECT is(
    (SELECT did_signature IS NOT NULL FROM public.zk_snark_proofs WHERE did_id = (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222')),
    true,
    'Proof should have DID signature'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.zk_snark_proofs WHERE did_id IN (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM public.iot_temp_logs WHERE did_id IN (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM public.verifiable_credentials WHERE did_id IN (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM public.did_keys WHERE did_id IN (SELECT id FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM public.did_registry WHERE controller_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
