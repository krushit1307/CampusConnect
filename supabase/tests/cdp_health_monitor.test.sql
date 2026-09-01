-- supabase/tests/cdp_health_monitor.test.sql
-- pgTAP test for CDP health monitoring functionality (Issue #5466)
--
-- Run with: psql -f supabase/tests/cdp_health_monitor.test.sql

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create test data ─────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'Admin', 'User'),
    ('22222222-2222-2222-2222-222222222222', 'user@test.local', 'Test', 'User')
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Record oracle price ───────────────────────────────────────────
SELECT is(
    (SELECT public.record_oracle_price('ETH', 3000.00, 'makerdao', 5.5, 1000000) IS NOT NULL),
    true,
    'Oracle price should be recorded successfully'
);

-- ── Test 2: Verify oracle price was recorded ─────────────────────────────
SELECT is(
    (SELECT price_usd FROM public.oracle_price_history WHERE asset_symbol = 'ETH' ORDER BY recorded_at DESC LIMIT 1),
    3000.00,
    'Oracle price should be correct'
);

-- ── Test 3: Create CDP position ─────────────────────────────────────────
DO $$
DECLARE
    v_position_id UUID;
BEGIN
    SELECT public.create_cdp_position(
        '22222222-2222-2222-2222-222222222222',
        'cdp-123',
        'ETH-A',
        10.0,
        5000.0,
        true
    ) INTO v_position_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.cdp_positions WHERE cdp_id = 'cdp-123'),
    1,
    'CDP position should be created'
);

-- ── Test 4: Verify CDP position was created with correct data ─────────────
SELECT is(
    (SELECT collateralization_ratio FROM public.cdp_positions WHERE cdp_id = 'cdp-123'),
    6.0,
    'Collateralization ratio should be 6.0 (30000/5000)'
);

SELECT is(
    (SELECT safety_threshold FROM public.cdp_positions WHERE cdp_id = 'cdp-123'),
    1.8,
    'Safety threshold should be 1.8'
);

-- ── Test 5: Update CDP health ───────────────────────────────────────────
DO $$
DECLARE
    v_position_id UUID;
    v_health_id UUID;
BEGIN
    SELECT id INTO v_position_id
    FROM public.cdp_positions
    WHERE cdp_id = 'cdp-123'
    LIMIT 1;
    
    SELECT public.update_cdp_health(v_position_id) INTO v_health_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.cdp_health_monitor WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123')),
    1,
    'CDP health monitor record should be created'
);

-- ── Test 6: Simulate price drop to critical level ───────────────────────
DO $$
BEGIN
    -- Drop ETH price to $1000 (collateralization ratio becomes 2.0, still above 1.8)
    PERFORM public.record_oracle_price('ETH', 1000.00, 'makerdao', -66.67, 500000);
END $$;

SELECT is(
    (SELECT health_status FROM public.cdp_health_monitor WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123') ORDER BY monitored_at DESC LIMIT 1),
    'healthy',
    'Health status should be healthy at 2.0 ratio'
);

-- ── Test 7: Simulate price drop to critical level (below safety threshold) ──
DO $$
BEGIN
    -- Drop ETH price to $800 (collateralization ratio becomes 1.6, below 1.8)
    PERFORM public.record_oracle_price('ETH', 800.00, 'makerdao', -73.33, 400000);
END $$;

SELECT is(
    (SELECT health_status FROM public.cdp_health_monitor WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123') ORDER BY monitored_at DESC LIMIT 1),
    'critical',
    'Health status should be critical at 1.6 ratio'
);

SELECT is(
    (SELECT alert_triggered FROM public.cdp_health_monitor WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123') ORDER BY monitored_at DESC LIMIT 1),
    true,
    'Alert should be triggered when below safety threshold'
);

-- ── Test 8: Trigger deleveraging ───────────────────────────────────────
DO $$
DECLARE
    v_position_id UUID;
    v_flashbot_id UUID;
BEGIN
    SELECT id INTO v_position_id
    FROM public.cdp_positions
    WHERE cdp_id = 'cdp-123'
    LIMIT 1;
    
    SELECT public.trigger_deleveraging(v_position_id, 1000.0) INTO v_flashbot_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.flashbot_transactions WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123')),
    1,
    'Flashbot transaction should be created for deleveraging'
);

SELECT is(
    (SELECT transaction_type FROM public.flashbot_transactions WHERE cdp_position_id = (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123')),
    'deleveraging',
    'Transaction type should be deleveraging'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.flashbot_transactions WHERE cdp_position_id IN (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123');
DELETE FROM public.cdp_health_monitor WHERE cdp_position_id IN (SELECT id FROM public.cdp_positions WHERE cdp_id = 'cdp-123');
DELETE FROM public.cdp_positions WHERE cdp_id = 'cdp-123';
DELETE FROM public.oracle_price_history WHERE asset_symbol = 'ETH';
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
