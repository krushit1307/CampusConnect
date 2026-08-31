-- supabase/tests/tarpit_security.test.sql
-- pgTAP test for tarpit security functionality (Issue #4995)
--
-- Run with: psql -f supabase/tests/tarpit_security.test.sql

\set ECHO none
BEGIN;
SELECT plan(10);

-- ── Test 1: Start tarpit session ───────────────────────────────────────
SELECT is(
    (SELECT public.start_tarpit_session(
        '192.168.1.1'::TEXT,
        'Mozilla/5.0'::TEXT,
        'fp-123'::TEXT,
        'default'::TEXT,
        'honey_pot'::TEXT
    ) IS NOT NULL),
    true,
    'Tarpit session should be started successfully'
);

-- ── Test 2: Check if IP is in tarpit ────────────────────────────────────
SELECT is(
    (SELECT in_tarpit FROM public.is_in_tarpit('192.168.1.1'::TEXT, NULL::TEXT)),
    true,
    'IP should be detected as in tarpit'
);

-- ── Test 3: Check if fingerprint is in tarpit ───────────────────────────
SELECT is(
    (SELECT in_tarpit FROM public.is_in_tarpit(NULL::TEXT, 'fp-123'::TEXT)),
    true,
    'Fingerprint should be detected as in tarpit'
);

-- ── Test 4: Get tarpit configuration ─────────────────────────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.get_tarpit_config('default'::TEXT)),
    1,
    'Should return tarpit configuration'
);

-- ── Test 5: Check configuration values ───────────────────────────────────
SELECT is(
    (SELECT bytes_per_second FROM public.get_tarpit_config('default'::TEXT)),
    0.1,
    'Default bytes per second should be 0.1'
);

SELECT is(
    (SELECT max_duration FROM public.get_tarpit_config('default'::TEXT)),
    300,
    'Default max duration should be 300 seconds'
);

-- ── Test 6: End tarpit session ─────────────────────────────────────────
DO $$
DECLARE
    v_session_id UUID;
BEGIN
    SELECT id INTO v_session_id
    FROM public.tarpit_sessions
    WHERE ip_address = '192.168.1.1'
    LIMIT 1;
    
    IF v_session_id IS NOT NULL THEN
        PERFORM public.end_tarpit_session(v_session_id, 1024);
    END IF;
END $$;

SELECT is(
    (SELECT is_active FROM public.tarpit_sessions WHERE ip_address = '192.168.1.1'),
    false,
    'Session should be marked as inactive after ending'
);

-- ── Test 7: Check session duration was recorded ─────────────────────────
SELECT is(
    (SELECT duration_seconds IS NOT NULL FROM public.tarpit_sessions WHERE ip_address = '192.168.1.1'),
    true,
    'Session duration should be recorded'
);

-- ── Test 8: Check bytes sent was recorded ───────────────────────────────
SELECT is(
    (SELECT bytes_sent FROM public.tarpit_sessions WHERE ip_address = '192.168.1.1'),
    1024,
    'Bytes sent should be recorded'
);

-- ── Test 9: Get tarpit statistics ───────────────────────────────────────
SELECT is(
    (SELECT total_sessions FROM public.get_tarpit_stats(7)),
    1,
    'Statistics should show 1 total session'
);

-- ── Test 10: Check unique IPs in statistics ───────────────────────────
SELECT is(
    (SELECT unique_ips FROM public.get_tarpit_stats(7)),
    1,
    'Statistics should show 1 unique IP'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.tarpit_events;
DELETE FROM public.tarpit_sessions WHERE ip_address = '192.168.1.1';

SELECT * FROM finish();
ROLLBACK;
