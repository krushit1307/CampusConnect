BEGIN;
SELECT plan(4);

-- 1. Create dummy users for testing
SELECT * FROM tests.create_supabase_user('user1');
SELECT * FROM tests.create_supabase_user('user2');

-- 2. Test user can insert their own export job
SELECT tests.authenticate_as('user1');

INSERT INTO public.data_export_jobs (user_id) 
VALUES (tests.get_supabase_uid('user1'));

SELECT results_eq(
    'SELECT count(*)::int FROM public.data_export_jobs WHERE user_id = tests.get_supabase_uid(''user1'')',
    ARRAY[1],
    'User 1 can create their own export job and view it'
);

-- 3. Test user cannot view other's export jobs
SELECT tests.authenticate_as('user2');

SELECT results_eq(
    'SELECT count(*)::int FROM public.data_export_jobs',
    ARRAY[0],
    'User 2 should not see User 1 export jobs due to RLS'
);

-- 4. Test user cannot insert an export job for someone else
SELECT throws_ok(
    $$INSERT INTO public.data_export_jobs (user_id) VALUES (tests.get_supabase_uid('user1'))$$,
    'new row violates row-level security policy for table "data_export_jobs"',
    'User 2 cannot create an export job for User 1'
);

-- 5. Test service role can view all
SELECT tests.authenticate_as('service_role');
SELECT results_eq(
    'SELECT count(*)::int FROM public.data_export_jobs',
    ARRAY[1],
    'Service role can see all export jobs'
);

SELECT * FROM finish();
ROLLBACK;
