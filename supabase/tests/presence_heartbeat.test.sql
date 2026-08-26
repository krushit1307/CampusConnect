BEGIN;
SELECT plan(8);

-- 1. Check table presence_heartbeats exists and columns are correct
SELECT has_table('public', 'presence_heartbeats', 'presence_heartbeats table should exist');
SELECT col_type_is('public', 'presence_heartbeats', 'user_id', 'uuid', 'user_id should be UUID');
SELECT col_type_is('public', 'presence_heartbeats', 'last_pinged_at', 'timestamp with time zone', 'last_pinged_at should be TIMESTAMPTZ');

-- 2. Verify RLS policies are active on presence_heartbeats
SELECT table_is_allowed('public', 'presence_heartbeats', 'service_role', 'ALL', 'Service role should be allowed to perform any action on presence_heartbeats');

-- 3. Create mock users to test RLS
INSERT INTO auth.users (id, email)
VALUES 
    ('00000000-0000-0000-0000-000000001333', 'user1@test.com'),
    ('00000000-0000-0000-0000-000000001334', 'user2@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, role)
VALUES 
    ('00000000-0000-0000-0000-000000001333', 'User One', 'student'),
    ('00000000-0000-0000-0000-000000001334', 'User Two', 'student')
ON CONFLICT (id) DO NOTHING;

-- 4. Test authenticated users can insert their own heartbeat
SET local role authenticated;
SET local "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000001333"}';

SELECT lives_ok(
    $$ INSERT INTO public.presence_heartbeats (user_id, last_pinged_at) VALUES ('00000000-0000-0000-0000-000000001333', now()) $$,
    'Authenticated users should be allowed to insert their own heartbeat'
);

-- Test authenticated users can update/upsert their own heartbeat
SELECT lives_ok(
    $$ INSERT INTO public.presence_heartbeats (user_id, last_pinged_at) VALUES ('00000000-0000-0000-0000-000000001333', now() - interval '1 minute') ON CONFLICT (user_id) DO UPDATE SET last_pinged_at = EXCLUDED.last_pinged_at $$,
    'Authenticated users should be allowed to upsert/update their own heartbeat'
);

-- Test authenticated users CANNOT insert another user's heartbeat
SELECT throws_ok(
    $$ INSERT INTO public.presence_heartbeats (user_id, last_pinged_at) VALUES ('00000000-0000-0000-0000-000000001334', now()) $$,
    'new row violates row-level security policy for table "presence_heartbeats"',
    'Authenticated users should be blocked from inserting heartbeats for other users'
);

-- Test authenticated users CAN read all heartbeats
SELECT is(
    (SELECT count(*)::integer FROM public.presence_heartbeats),
    1,
    'Authenticated users should be allowed to read active presence heartbeats'
);

SELECT * FROM finish();
ROLLBACK;
