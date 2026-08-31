-- supabase/tests/secret_unlock_links.test.sql
-- pgTAP test for secret unlock links functionality (Issue #4672)
--
-- Run with: psql -f supabase/tests/secret_unlock_links.test.sql

\set ECHO none
BEGIN;
SELECT plan(10);

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
    'Secret Tier Test Event',
    NOW() + INTERVAL '7 days',
    100
)
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Create a secret tier ─────────────────────────────────────────
SELECT is(
    (SELECT (public.create_secret_tier(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        'VIP Early Bird',
        1000, -- $10.00 in cents
        50, -- capacity
        5, -- max uses
        NOW() + INTERVAL '30 days'::TIMESTAMPTZ,
        'Special VIP access'
    ) ->> 'success')),
    'true',
    'Secret tier should be created successfully'
);

-- ── Test 2: Unlock hash should be generated ───────────────────────────────
SELECT is(
    (SELECT length(unlock_hash) > 10 FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE),
    true,
    'Unlock hash should be generated and be reasonably long'
);

-- ── Test 3: uses_remaining should equal max_uses initially ─────────────────
SELECT is(
    (SELECT uses_remaining FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE),
    5,
    'uses_remaining should equal max_uses initially'
);

-- ── Test 4: Validate correct unlock hash ───────────────────────────────────
SELECT is(
    (SELECT is_valid FROM public.validate_unlock_hash(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        (SELECT unlock_hash FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
    )),
    true,
    'Valid unlock hash should return true'
);

-- ── Test 5: Validate incorrect unlock hash ─────────────────────────────────
SELECT is(
    (SELECT is_valid FROM public.validate_unlock_hash(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
        'invalid_hash_12345'
    )),
    false,
    'Invalid unlock hash should return false'
);

-- ── Test 6: Public ticket tiers should exclude secret tiers ─────────────────
SELECT is(
    (SELECT count(*) FROM public.get_public_ticket_tiers('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID)),
    0,
    'Public ticket tiers should exclude secret tiers'
);

-- ── Test 7: All ticket tiers should include secret tiers ────────────────────
SELECT is(
    (SELECT count(*) FROM public.get_all_ticket_tiers('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID)),
    1,
    'All ticket tiers should include secret tiers'
);

-- ── Test 8: Record secret tier purchase decrements uses_remaining ───────────
SELECT is(
    (SELECT (public.record_secret_tier_purchase(
        (SELECT id FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
    ) ->> 'success')),
    'true',
    'Secret tier purchase should be recorded successfully'
);

-- ── Test 9: uses_remaining should be decremented ─────────────────────────────
SELECT is(
    (SELECT uses_remaining FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE),
    4,
    'uses_remaining should be decremented after purchase'
);

-- ── Test 10: Cannot purchase when uses_remaining is 0 ─────────────────────────
-- First use up remaining uses
SELECT public.record_secret_tier_purchase(
    (SELECT id FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
);
SELECT public.record_secret_tier_purchase(
    (SELECT id FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
);
SELECT public.record_secret_tier_purchase(
    (SELECT id FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
);

SELECT is(
    (SELECT (public.record_secret_tier_purchase(
        (SELECT id FROM public.ticket_tiers WHERE name = 'VIP Early Bird' AND is_secret = TRUE)
    ) ->> 'success')),
    'false',
    'Should fail to purchase when uses_remaining is 0'
);

-- ── Cleanup ───────────────────────────────────────────────────────────────
DELETE FROM public.ticket_tiers WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.events WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
);

SELECT * FROM finish();
ROLLBACK;
