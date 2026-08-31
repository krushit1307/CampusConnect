-- supabase/tests/ubo_screening.test.sql
-- pgTAP test for UBO screening functionality (Issue #5364)
--
-- Run with: psql -f supabase/tests/ubo_screening.test.sql

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create test data ─────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name, role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'Admin', 'User', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Create vendor ───────────────────────────────────────────────
SELECT is(
    (SELECT public.create_vendor('Test Catering Co', '12-3456789', 'corporation', 'de', '123 Main St', 'contact@test.local') IS NOT NULL),
    true,
    'Vendor should be created successfully'
);

-- ── Test 2: Verify vendor was created with correct data ───────────────────
SELECT is(
    (SELECT name FROM public.vendors WHERE name = 'Test Catering Co'),
    'Test Catering Co',
    'Vendor name should be correct'
);

SELECT is(
    (SELECT tax_id FROM public.vendors WHERE name = 'Test Catering Co'),
    '12-3456789',
    'Vendor tax ID should be correct'
);

-- ── Test 3: Add corporate ownership (UBO) ───────────────────────────────
DO $$
DECLARE
    v_vendor_id UUID;
BEGIN
    SELECT id INTO v_vendor_id
    FROM public.vendors
    WHERE name = 'Test Catering Co'
    LIMIT 1;
    
    PERFORM public.add_corporate_ownership(
        v_vendor_id,
        'individual',
        'John Doe',
        30.5,
        '98-7654321',
        'us',
        '456 Oak Ave',
        '1970-01-01'::,
        'US',
        'PASS12345',
        'manual'
    );
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.corporate_ownership WHERE owner_name = 'John Doe'),
    1,
    'Corporate ownership should be added'
);

-- ── Test 4: Verify UBO is marked correctly (>25% ownership) ───────────────
SELECT is(
    (SELECT is_ultimate_beneficial_owner FROM public.corporate_ownership WHERE owner_name = 'John Doe'),
    true,
    'Owner with >25% ownership should be marked as UBO'
);

-- ── Test 5: Add non-UBO ownership (<25%) ───────────────────────────────
DO $$
DECLARE
    v_vendor_id UUID;
BEGIN
    SELECT id INTO v_vendor_id
    FROM public.vendors
    WHERE name = 'Test Catering Co'
    LIMIT 1;
    
    PERFORM public.add_corporate_ownership(
        v_vendor_id,
        'individual',
        'Jane Smith',
        15.0,
        NULL,
        'us',
        NULL,
        NULL,
        NULL,
        NULL,
        'manual'
    );
END $$;

SELECT is(
    (SELECT is_ultimate_beneficial_owner FROM public.corporate_ownership WHERE owner_name = 'Jane Smith'),
    false,
    'Owner with <25% ownership should not be marked as UBO'
);

-- ── Test 6: Screen vendor for sanctions ───────────────────────────────────
DO $$
DECLARE
    v_vendor_id UUID;
    v_result JSONB;
BEGIN
    SELECT id INTO v_vendor_id
    FROM public.vendors
    WHERE name = 'Test Catering Co'
    LIMIT 1;
    
    SELECT public.screen_vendor_sanctions(v_vendor_id) INTO v_result;
    
    RAISE NOTICE 'Screening result: %', v_result;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.sanctions_screenings WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co')),
    1,
    'Sanctions screening should be created for entity'
);

-- ── Test 7: Block vendor escrow ─────────────────────────────────────────
DO $$
DECLARE
    v_vendor_id UUID;
BEGIN
    SELECT id INTO v_vendor_id
    FROM public.vendors
    WHERE name = 'Test Catering Co'
    LIMIT 1;
    
    PERFORM public.block_vendor_escrow(v_vendor_id, 'Test sanctions match');
END $$;

SELECT is(
    (SELECT is_sanctioned FROM public.vendors WHERE name = 'Test Catering Co'),
    true,
    'Vendor should be marked as sanctioned after escrow block'
);

-- ── Test 8: Verify legal alert was created ───────────────────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.legal_alerts WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co')),
    1,
    'Legal alert should be created when escrow is blocked'
);

SELECT is(
    (SELECT alert_type FROM public.legal_alerts WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co')),
    'sanctions_match',
    'Alert type should be sanctions_match'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.legal_alerts WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co');
DELETE FROM public.sanctions_screenings WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co');
DELETE FROM public.corporate_ownership WHERE vendor_id = (SELECT id FROM public.vendors WHERE name = 'Test Catering Co');
DELETE FROM public.vendors WHERE name = 'Test Catering Co';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT * FROM finish();
ROLLBACK;
