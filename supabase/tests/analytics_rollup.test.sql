BEGIN;
SELECT plan(6);

-- 1. Test table existence
SELECT has_table('analytics_cache', 'analytics_cache table should exist');

-- 2. Test expected columns
SELECT has_column('analytics_cache', 'month', 'analytics_cache should have month column');
SELECT has_column('analytics_cache', 'category', 'analytics_cache should have category column');
SELECT has_column('analytics_cache', 'rsvp_count', 'analytics_cache should have rsvp_count column');

-- 3. Execute RPC function
SELECT lives_ok(
    'SELECT refresh_analytics_cache()',
    'refresh_analytics_cache() should execute without throwing errors'
);

-- 4. Verify non-negative values
SELECT is_empty(
    'SELECT * FROM analytics_cache WHERE rsvp_count < 0',
    'rsvp_count should always be non-negative'
);

SELECT * FROM finish();
ROLLBACK;