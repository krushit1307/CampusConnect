-- supabase/tests/keystroke_dynamics_coercion_detection.test.sql
-- pgTAP test for keystroke dynamics coercion detection (Issue #5008)
--
-- Run with: psql -f supabase/tests/keystroke_dynamics_coercion_detection.test.sql

\set ECHO none
BEGIN;
SELECT plan(12);

-- ── Setup: create test club, event, and users ─────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'u1@test.local', 'User', 'One'),
    ('22222222-2222-2222-2222-222222222222', 'u2@test.local', 'User', 'Two')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, start_date, max_attendees)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Coercion Test Event',
    NOW() + INTERVAL '7 days',
    100
)
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Keystroke anomaly score calculation with normal typing ─────────
SELECT is(
    (SELECT public.calculate_keystroke_anomaly(
        '[{"key":"a","timestamp":100,"dwellTime":120,"flightTime":0},{"key":"b","timestamp":220,"dwellTime":100,"flightTime":100}]'::JSONB,
        5000,
        1,
        2
    ) < 30),
    true,
    'Normal typing should have low anomaly score'
);

-- ── Test 2: Keystroke anomaly score calculation with erratic typing ─────────
SELECT is(
    (SELECT public.calculate_keystroke_anomaly(
        '[{"key":"a","timestamp":100,"dwellTime":120,"flightTime":0},{"key":"b","timestamp":500,"dwellTime":50,"flightTime":400},{"key":"c","timestamp":550,"dwellTime":600,"flightTime":50}]'::JSONB,
        3000,
        5,
        3
    ) > 50),
    true,
    'Erratic typing should have high anomaly score'
);

-- ── Test 3: Keystroke anomaly score with high correction rate ───────────────
SELECT is(
    (SELECT public.calculate_keystroke_anomaly(
        '[{"key":"a","timestamp":100,"dwellTime":120,"flightTime":0},{"key":"Backspace","timestamp":200,"dwellTime":100,"flightTime":100},{"key":"b","timestamp":300,"dwellTime":100,"flightTime":100},{"key":"Backspace","timestamp":400,"dwellTime":100,"flightTime":100},{"key":"c","timestamp":500,"dwellTime":100,"flightTime":100}]'::JSONB,
        5000,
        2,
        5
    ) > 40),
    true,
    'High correction rate should increase anomaly score'
);

-- ── Test 4: Coercion detection with high anomaly + positive sentiment ─────────
SELECT is(
    (SELECT public.detect_coercion(70, 0.8, 5)),
    true,
    'High anomaly + positive sentiment + high rating should be flagged as coerced'
);

-- ── Test 5: Coercion detection with low anomaly ─────────────────────────────
SELECT is(
    (SELECT public.detect_coercion(30, 0.8, 5)),
    false,
    'Low anomaly should not be flagged as coerced'
);

-- ── Test 6: Coercion detection with negative sentiment ───────────────────────
SELECT is(
    (SELECT public.detect_coercion(70, -0.5, 5)),
    false,
    'High anomaly + negative sentiment should not be flagged as coerced'
);

-- ── Test 7: Coercion detection with low rating ───────────────────────────────
SELECT is(
    (SELECT public.detect_coercion(70, 0.8, 2)),
    false,
    'High anomaly + positive sentiment + low rating should not be flagged as coerced'
);

-- ── Test 8: Weight multiplier calculation for suspicious review ─────────────
SELECT is(
    (SELECT public.calculate_weight_multiplier(true, 85)),
    0.0,
    'Very high anomaly should have zero weight'
);

-- ── Test 9: Weight multiplier calculation for genuine review ────────────────
SELECT is(
    (SELECT public.calculate_weight_multiplier(false, 30)),
    1.0,
    'Genuine review should have full weight'
);

-- ── Test 10: Weight multiplier calculation for moderately suspicious ──────────
SELECT is(
    (SELECT public.calculate_weight_multiplier(true, 65)),
    0.3,
    'Moderately suspicious review should have reduced weight'
);

-- ── Test 11: Insert feedback with keystroke data ────────────────────────────
INSERT INTO public.event_feedbacks (
    event_id,
    user_id,
    rating,
    comment,
    keystroke_data,
    avg_dwell_time_ms,
    avg_flight_time_ms,
    backspace_count,
    correction_rate,
    typing_duration_ms,
    sentiment_score
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    5,
    'This was an amazing event!',
    '[{"key":"a","timestamp":100,"dwellTime":120,"flightTime":0}]'::JSONB,
    120.0,
    0.0,
    0,
    0.0,
    5000,
    0.8
);

SELECT is(
    (SELECT COUNT(*) FROM public.event_feedbacks WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    1,
    'Feedback with keystroke data should be inserted successfully'
);

-- ── Test 12: Analyze feedback coercion RPC ───────────────────────────────────
SELECT is(
    (SELECT (public.analyze_feedback_coercion(
        (SELECT id FROM public.event_feedbacks WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' LIMIT 1)
    ) ->> 'success')),
    'true',
    'Feedback coercion analysis should succeed'
);

-- ── Cleanup ───────────────────────────────────────────────────────────────
DELETE FROM public.event_feedbacks WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.events WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
);

SELECT * FROM finish();
ROLLBACK;
