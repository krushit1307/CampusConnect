-- supabase/tests/early_bird_discount.test.sql
-- pgTAP tests for Dynamic "Early Bird" Discount System & Transactional Gating

BEGIN;
SELECT plan(10);

-- 1. Verify schema columns exist
SELECT has_column('events', 'ticket_tiers', 'events table has ticket_tiers JSONB column');
SELECT col_type_is('events', 'ticket_tiers', 'jsonb', 'events.ticket_tiers is jsonb');

SELECT has_column('event_rsvps', 'ticket_tier_name', 'event_rsvps table has ticket_tier_name column');
SELECT col_type_is('event_rsvps', 'ticket_tier_name', 'text', 'event_rsvps.ticket_tier_name is text');

-- 2. Setup mock data
INSERT INTO public.profiles (id, username, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'test_donor_1', 'donor1@test.com'),
       ('00000000-0000-0000-0000-000000000002', 'test_donor_2', 'donor2@test.com'),
       ('00000000-0000-0000-0000-000000000003', 'test_donor_3', 'donor3@test.com');

INSERT INTO public.events (id, title, start_date, end_date, ticket_tiers)
VALUES ('00000000-0000-0000-0000-000000000009', 
        'Early Bird Hackathon', 
        now() + interval '1 day', 
        now() + interval '2 days',
        '[{"name": "Early Bird", "price": 5, "quantity": 2}, {"name": "General", "price": 10, "quantity": 5}]'::jsonb);

-- 3. Test first reservation of Early Bird (Capacity is 2)
SELECT lives_ok(
    $$ SELECT public.check_and_reserve_ticket_tier(
        '00000000-0000-0000-0000-000000000009',
        'Early Bird',
        1,
        '00000000-0000-0000-0000-000000000001'
    ) $$,
    'First Early Bird reservation should succeed'
);

-- 4. Test second reservation of Early Bird (Capacity is 2)
SELECT lives_ok(
    $$ SELECT public.check_and_reserve_ticket_tier(
        '00000000-0000-0000-0000-000000000009',
        'Early Bird',
        1,
        '00000000-0000-0000-0000-000000000002'
    ) $$,
    'Second Early Bird reservation should succeed'
);

-- 5. Test third reservation of Early Bird (Should fail - capacity exceeded)
SELECT throws_ok(
    $$ SELECT public.check_and_reserve_ticket_tier(
        '00000000-0000-0000-0000-000000000009',
        'Early Bird',
        1,
        '00000000-0000-0000-0000-000000000003'
    ) $$,
    'P3D01', -- Custom error or general SQL exception code
    NULL,
    'Third Early Bird reservation should fail due to sold out status'
);

-- 6. Verify reserved RSVPs are PENDING and hold correct tier names
SELECT results_eq(
    $$ SELECT status, ticket_tier_name FROM public.event_rsvps WHERE event_id = '00000000-0000-0000-0000-000000000009' ORDER BY user_id $$,
    $$ VALUES ('PENDING'::text, 'Early Bird'::text), ('PENDING'::text, 'Early Bird'::text) $$,
    'RSVP status should be PENDING and mapped to Early Bird'
);

-- 7. Test reserving General tier (Capacity is 5)
SELECT lives_ok(
    $$ SELECT public.check_and_reserve_ticket_tier(
        '00000000-0000-0000-0000-000000000009',
        'General',
        1,
        '00000000-0000-0000-0000-000000000003'
    ) $$,
    'General tier reservation should succeed when Early Bird is sold out'
);

SELECT * FROM finish();
ROLLBACK;
