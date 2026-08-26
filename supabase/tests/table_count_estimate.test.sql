-- =============================================================================
-- Test: table_count_estimate.test.sql
-- Purpose: Verify pg_class statistics count extraction and fallback functionality.
-- =============================================================================

BEGIN;

SELECT plan(3);

-- Test 1: Verify get_table_row_count_estimate function exists
SELECT has_function(
    'public',
    'get_table_row_count_estimate',
    ARRAY['text'],
    'Function get_table_row_count_estimate(text) exists'
);

-- Test 2: Initial estimate of empty user_activity_logs (should fallback to exact count)
SELECT is(
    public.get_table_row_count_estimate('user_activity_logs'),
    0::bigint,
    'Empty table estimate returns 0 (exact count fallback)'
);

-- Test 3: Insert mock rows and check count estimate
INSERT INTO public.user_activity_logs (action) VALUES ('LOGIN'), ('LOGOUT'), ('UPDATE_PROFILE');

SELECT is(
    public.get_table_row_count_estimate('user_activity_logs'),
    3::bigint,
    'Inserting rows updates the estimated count returned by function'
);

SELECT * FROM finish();
ROLLBACK;
