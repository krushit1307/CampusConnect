-- pgTAP Test Suite for chat_messages Partitioning
-- Run with: psql -U postgres -d postgres -f supabase/tests/chat_messages_partitioning.test.sql

BEGIN;
SELECT plan(5);

-- Test 1: Verify the main table is partitioned
SELECT has_partitioned_table(
    'public', 'chat_messages',
    'chat_messages table should be partitioned'
);

-- Test 2: Verify the default partition exists
SELECT has_table(
    'public', 'chat_messages_default',
    'Default partition chat_messages_default should exist'
);

-- Test 3: Verify the partition creation function exists
SELECT has_function(
    'public', 'create_next_chat_messages_partition', ARRAY[]::text[],
    'Function create_next_chat_messages_partition should exist'
);

-- Test 4: Test dynamic partition creation manually
SELECT public.create_next_chat_messages_partition();
SELECT has_table(
    'public', 'chat_messages_' || TO_CHAR(DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'), 'YYYY_MM'),
    'Next month partition should be created by the function'
);

-- Test 5: Verify data routes to the correct partition
INSERT INTO public.chat_messages (sender_id, receiver_id, content, created_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 
     '00000000-0000-0000-0000-000000000002', 
     'Test message for partition routing', 
     CURRENT_DATE);

SELECT table_has_row(
    'public', 'chat_messages',
    ROW('Test message for partition routing'::text),
    'Inserted message should be queryable from the parent table'
);

SELECT * FROM finish();
ROLLBACK;
