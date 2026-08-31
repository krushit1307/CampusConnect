-- pgTAP tests for Tag Trend Forecasting Dashboard (#4825)
BEGIN;
SELECT plan(10);

-- 1. Verify table presence
SELECT has_table('tag_weekly_stats');

-- 2. Verify table columns
SELECT has_column('tag_weekly_stats', 'id');
SELECT has_column('tag_weekly_stats', 'tag');
SELECT has_column('tag_weekly_stats', 'week_start');
SELECT has_column('tag_weekly_stats', 'count');

-- 3. Verify functions exist
SELECT has_function('get_canonical_tag');
SELECT has_function('refresh_tag_weekly_stats');
SELECT has_function('get_trend_forecasting_dashboard');

-- Seed a temporary canonical tag mapping for testing get_canonical_tag
INSERT INTO public.canonical_tags (tag_name, aliases)
VALUES ('Quantum Computing', ARRAY['qc', 'quantumcomputing'])
ON CONFLICT (tag_name) DO UPDATE SET aliases = EXCLUDED.aliases;

-- 4. Test public.get_canonical_tag lookup mapping
SELECT results_eq(
    $$SELECT public.get_canonical_tag('quantumcomputing')$$,
    $$VALUES ('#Quantum Computing'::text)$$,
    'get_canonical_tag maps alias to canonical prefixed name'
);

SELECT results_eq(
    $$SELECT public.get_canonical_tag('UnknownUniqueTag')$$,
    $$VALUES ('#UnknownUniqueTag'::text)$$,
    'get_canonical_tag falls back to original tag if no mapping exists'
);

-- 5. Test trend forecasting dashboard function (using seeds already inserted in migration)
SELECT results_eq(
    $$SELECT tag, current_count, alert_triggered, underfunded_club_name, reallocation_source_club_name 
      FROM public.get_trend_forecasting_dashboard() 
      WHERE tag = '#QuantumComputing'$$,
    $$VALUES ('#QuantumComputing'::text, 125::int, true::boolean, 'Physics Club'::text, 'Blockchain Club'::text)$$,
    'Quantum Computing detects rising trend alert, sustained > 200% growth, and correct mock club fallbacks'
);

SELECT finish();
ROLLBACK;
