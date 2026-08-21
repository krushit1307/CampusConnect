BEGIN;
SELECT plan(4);
-- 1. Ensure RLS is enabled on direct_messages
SELECT passes(
  $$ SELECT rowsecurity FROM pg_tables WHERE tablename = 'direct_messages' $$,
  'Row Level Security should be enabled on direct_messages'
);

-- 2. Verify SELECT policy exists
SELECT results_eq(
  $$ SELECT count(*)::integer FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Users can view their own messages' $$,
  ARRAY[1],
  'Policy "Users can view their own messages" should exist'
);

-- 3. Verify INSERT policy exists
SELECT results_eq(
  $$ SELECT count(*)::integer FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Users can insert messages as themselves' $$,
  ARRAY[1],
  'Policy "Users can insert messages as themselves" should exist'
);

-- 4. Verify Admin policy exists
SELECT results_eq(
  $$ SELECT count(*)::integer FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Admins bypass RLS' $$,
  ARRAY[1],
  'Policy "Admins bypass RLS" should exist'
);

SELECT * FROM finish();
ROLLBACK;