-- ============================================================
-- pgTAP tests for `public.device_sessions` (remote device logout)
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(13);

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000801', 'alice@test.com', 'authenticated', 'authenticated', '{"full_name": "Alice"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'member', full_name = 'Alice'
WHERE id = '90000000-0000-0000-0000-000000000801';

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000802', 'bob@test.com', 'authenticated', 'authenticated', '{"full_name": "Bob"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'member', full_name = 'Bob'
WHERE id = '90000000-0000-0000-0000-000000000802';

-- Seed two auth sessions + refresh tokens for Alice (the underlying
-- Supabase auth state that a device session maps to).
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, aal)
VALUES
  ('70000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-000000000801', NOW(), NOW(), 'aal1'),
  ('70000000-0000-0000-0000-0000000000a2', '90000000-0000-0000-0000-000000000801', NOW(), NOW(), 'aal1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.refresh_tokens (token, user_id, revoked, session_id)
VALUES
  ('devtok_alice_1', '90000000-0000-0000-0000-000000000801', false, '70000000-0000-0000-0000-0000000000a1'),
  ('devtok_alice_2', '90000000-0000-0000-0000-000000000801', false, '70000000-0000-0000-0000-0000000000a2')
ON CONFLICT (token) DO NOTHING;

-- Seed device session rows for Alice
INSERT INTO public.device_sessions (id, user_id, auth_session_id, browser, os, ip_address)
VALUES
  ('60000000-0000-0000-0000-0000000000b1', '90000000-0000-0000-0000-000000000801', '70000000-0000-0000-0000-0000000000a1', 'Chrome', 'Windows', '10.0.0.1'),
  ('60000000-0000-0000-0000-0000000000b2', '90000000-0000-0000-0000-000000000801', '70000000-0000-0000-0000-0000000000a2', 'Safari', 'iOS', '10.0.0.2');

-- 1. Table exists
SELECT has_table('public', 'device_sessions', 'device_sessions table should exist');

-- 2. auth_session_id is unique (upsert key used by the edge function)
SELECT has_unique(
  'public', 'device_sessions', ARRAY['auth_session_id'],
  'auth_session_id should be unique'
);

-- 3. user_id is a foreign key to profiles
SELECT col_is_fk('public', 'device_sessions', 'user_id', 'user_id should reference profiles');

-- 4. RLS is enabled
SELECT results_eq(
  $$SELECT relrowsecurity::int FROM pg_class WHERE oid = 'public.device_sessions'::regclass$$,
  $$VALUES (1)$$,
  'row level security should be enabled on device_sessions'
);

-- 5. revoke_auth_session RPC exists
SELECT has_function(
  'public', 'revoke_auth_session', ARRAY['uuid'],
  'revoke_auth_session(uuid) should exist'
);

-- 6. Authenticated users cannot INSERT directly (writes only via edge function)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "90000000-0000-0000-0000-000000000801"}';

SELECT throws_ok(
  $$INSERT INTO public.device_sessions (user_id, auth_session_id)
    VALUES ('90000000-0000-0000-0000-000000000801', '70000000-0000-0000-0000-0000000000a3')$$,
  'new row violates row-level security policy.*',
  'authenticated users should not be able to insert device sessions directly'
);

-- 7. Authenticated users can SELECT their own sessions
SELECT results_eq(
  $$SELECT count(*)::int FROM public.device_sessions$$,
  $$VALUES (2)$$,
  'authenticated user should see their own device sessions'
);

-- 8. Authenticated users cannot see other users'' sessions
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "90000000-0000-0000-0000-000000000802"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM public.device_sessions WHERE user_id = '90000000-0000-0000-0000-000000000801'$$,
  $$VALUES (0)$$,
  'authenticated user should not see another users device sessions'
);

-- 9. revoke_auth_session is not executable by authenticated
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "90000000-0000-0000-0000-000000000802"}';

SELECT throws_ok(
  $$SELECT public.revoke_auth_session('70000000-0000-0000-0000-0000000000a2')$$,
  'permission denied for function revoke_auth_session',
  'authenticated users should not be able to revoke auth sessions'
);

-- 10. revoke_auth_session is not executable by anon
SET LOCAL role TO anon;
SET LOCAL request.jwt.claims TO '{}';

SELECT throws_ok(
  $$SELECT public.revoke_auth_session('70000000-0000-0000-0000-0000000000a2')$$,
  'permission denied for function revoke_auth_session',
  'anonymous requests should not be able to revoke auth sessions'
);

-- 11. service_role can revoke (used by the revoke-device edge function)
SET LOCAL role TO service_role;
SELECT lives_ok(
  $$SELECT public.revoke_auth_session('70000000-0000-0000-0000-0000000000a1')$$,
  'service_role should be able to revoke an auth session'
);

-- 12. Revoking removes the underlying auth.sessions row
SELECT results_eq(
  $$SELECT count(*)::int FROM auth.sessions WHERE id = '70000000-0000-0000-0000-0000000000a1'$$,
  $$VALUES (0)$$,
  'revoking a device session should delete the underlying auth.sessions row'
);

-- 13. Revoking removes the linked auth.refresh_tokens rows
SELECT results_eq(
  $$SELECT count(*)::int FROM auth.refresh_tokens WHERE session_id = '70000000-0000-0000-0000-0000000000a1'$$,
  $$VALUES (0)$$,
  'revoking a device session should delete the linked refresh tokens'
);

SELECT * FROM finish();
ROLLBACK;
