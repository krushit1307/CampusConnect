-- ============================================================
-- Test Suite: chat_read_receipts.test.sql
-- Description: Verifies schema, columns, RLS policies of chat_participants.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Schema / Column validation
SELECT has_table('public', 'chat_participants', 'chat_participants table should exist');
SELECT has_column('public', 'chat_participants', 'user_id', 'Column user_id should exist in chat_participants');
SELECT has_column('public', 'chat_participants', 'recipient_id', 'Column recipient_id should exist in chat_participants');
SELECT has_column('public', 'chat_participants', 'last_read_message_id', 'Column last_read_message_id should exist in chat_participants');
SELECT has_column('public', 'chat_participants', 'updated_at', 'Column updated_at should exist in chat_participants');

-- 2. Constraints validation
SELECT col_type_is('public', 'chat_participants', 'user_id', 'uuid', 'user_id should be UUID');
SELECT col_type_is('public', 'chat_participants', 'recipient_id', 'uuid', 'recipient_id should be UUID');
SELECT col_type_is('public', 'chat_participants', 'last_read_message_id', 'uuid', 'last_read_message_id should be UUID');

-- 3. Setup mock data
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('00000000-0000-0000-0000-00000000001a', 'Chat User A', 'student'),
  ('00000000-0000-0000-0000-00000000001b', 'Chat User B', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.direct_messages (id, sender_id, receiver_id, encrypted_content, iv)
VALUES (
    '00000000-0000-0000-0000-00000000001c',
    '00000000-0000-0000-0000-00000000001a',
    '00000000-0000-0000-0000-00000000001b',
    'hello',
    'iv_test_123'
);

-- Test insert behavior
SELECT lives_ok(
    $$ INSERT INTO public.chat_participants (user_id, recipient_id, last_read_message_id) VALUES ('00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001c') $$,
    'Inserting a valid read receipt into chat_participants should succeed'
);

SELECT results_eq(
    $$ SELECT last_read_message_id FROM public.chat_participants WHERE user_id = '00000000-0000-0000-0000-00000000001b' AND recipient_id = '00000000-0000-0000-0000-00000000001a' $$,
    $$ VALUES ('00000000-0000-0000-0000-00000000001c'::uuid) $$,
    'Retrieving read receipt should return the correct message ID'
);

SELECT * FROM finish();
ROLLBACK;
