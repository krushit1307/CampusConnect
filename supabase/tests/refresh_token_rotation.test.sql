-- ============================================================
-- pgTAP tests for Refresh Token Rotation & Theft Detection
-- ============================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- 1. Setup mock user
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('91000000-0000-0000-0000-000000000901', 'rotation_test@example.com', 'authenticated', 'authenticated', '{"full_name": "Rotation Tester"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'member', full_name = 'Rotation Tester'
WHERE id = '91000000-0000-0000-0000-000000000901';

-- 2. Table structure checks
SELECT has_table('public', 'refresh_tokens', 'public.refresh_tokens table should exist');

SELECT col_is_fk('public', 'refresh_tokens', 'user_id', 'user_id should reference profiles');

SELECT has_unique(
  'public', 'refresh_tokens', ARRAY['token_hash'],
  'token_hash should be unique'
);

-- 3. Seed initial valid token
INSERT INTO public.refresh_tokens (id, user_id, token_hash, is_revoked, created_at)
VALUES (
  '81000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000901',
  'initial_hash_123',
  FALSE,
  NOW()
);

-- 4. Test 1: Valid Rotation
SELECT results_eq(
  $$ SELECT (public.rotate_refresh_token('initial_hash_123', 'new_hash_456', 5))->>'status' $$,
  $$ VALUES ('success') $$,
  'Rotating valid token returns success status'
);

SELECT results_eq(
  $$ SELECT is_revoked FROM public.refresh_tokens WHERE token_hash = 'initial_hash_123' $$,
  $$ VALUES (true) $$,
  'Original token should now be marked is_revoked = true'
);

SELECT results_eq(
  $$ SELECT is_revoked FROM public.refresh_tokens WHERE token_hash = 'new_hash_456' $$,
  $$ VALUES (false) $$,
  'Newly rotated token should be created with is_revoked = false'
);

-- 5. Test 2: Grace period (Immediate reuse within 5 seconds)
SELECT results_eq(
  $$ SELECT (public.rotate_refresh_token('initial_hash_123', 'another_hash_789', 5))->>'status' $$,
  $$ VALUES ('grace_period') $$,
  'Reusing revoked token within 5s grace period returns grace_period status without revoking all tokens'
);

SELECT results_eq(
  $$ SELECT is_revoked FROM public.refresh_tokens WHERE token_hash = 'new_hash_456' $$,
  $$ VALUES (false) $$,
  'Grace period request must NOT revoke active tokens'
);

-- 6. Test 3: Theft Detection (Reuse after grace period expires)
-- Simulate passage of time by setting revoked_at to 10 seconds ago
UPDATE public.refresh_tokens
SET revoked_at = NOW() - INTERVAL '10 seconds'
WHERE token_hash = 'initial_hash_123';

SELECT results_eq(
  $$ SELECT (public.rotate_refresh_token('initial_hash_123', 'stolen_attempt_hash', 5))->>'status' $$,
  $$ VALUES ('revoked_all') $$,
  'Reusing revoked token after grace period triggers theft detection protocol (revoked_all)'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.refresh_tokens WHERE user_id = '91000000-0000-0000-0000-000000000901' AND is_revoked = false $$,
  $$ VALUES (0) $$,
  'All refresh tokens for user should now be revoked (0 active tokens remaining)'
);

-- 7. Test 4: Invalid token
SELECT results_eq(
  $$ SELECT (public.rotate_refresh_token('non_existent_hash', 'some_new_hash', 5))->>'status' $$,
  $$ VALUES ('invalid') $$,
  'Rotating non-existent token returns invalid status'
);

SELECT * FROM finish();
ROLLBACK;
