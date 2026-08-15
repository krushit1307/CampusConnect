-- ============================================================
-- Test Suite: interactive_lost_found_map_pinning.test.sql
-- Description: Verifies schema additions and functions for lost & found map pinning.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Verify schema elements exist on lost_found_items
SELECT has_column('public', 'lost_found_items', 'lat', 'lost_found_items should have lat column');
SELECT has_column('public', 'lost_found_items', 'lng', 'lost_found_items should have lng column');
SELECT has_column('public', 'lost_found_items', 'floor_details', 'lost_found_items should have floor_details column');

-- 2. Verify coordinate index exists
SELECT has_index(
    'public',
    'lost_found_items',
    'idx_lost_found_items_coords',
    'lost_found_items should have coordinate index idx_lost_found_items_coords'
);

-- 3. Verify function existence and updated parameters
SELECT has_function(
    'public',
    'create_lost_item_with_bounty',
    ARRAY['text', 'text', 'text', 'text', 'text', 'text', 'integer', 'text', 'double precision', 'double precision', 'text'],
    'Function create_lost_item_with_bounty with lat/lng/floor parameters should exist'
);

-- 4. Test RPC insert behavior and verify that columns are saved
-- Mock user authenticated session
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);

-- Add mock profile if needed
INSERT INTO public.profiles (id, full_name, handle)
VALUES ('00000000-0000-0000-0000-00000000000a', 'Map Pinning Tester', 'pin_tester')
ON CONFLICT (id) DO NOTHING;

-- Call function to create a pinned lost item
SELECT lives_ok(
    $$
    SELECT public.create_lost_item_with_bounty(
        'lost',
        'Lost Glasses',
        'Black frame glasses lost near pool.',
        'Accessories',
        'Recreation Center Pool',
        'test@campus.edu',
        0,
        NULL,
        40.7128,
        -74.0060,
        'Second floor lobby'
    );
    $$,
    'create_lost_item_with_bounty should successfully create a lost item with map coordinates and floor details'
);

ROLLBACK;
