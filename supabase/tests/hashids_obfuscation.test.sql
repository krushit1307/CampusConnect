BEGIN;
SELECT plan(12);

-- 1. Verify extension pg_hashids is enabled
SELECT has_extension('pg_hashids', 'Extension pg_hashids should be enabled');

-- 2. Verify helper functions exist
SELECT has_function('public', 'obfuscate_id', ARRAY['bigint'], 'obfuscate_id(bigint) should exist');
SELECT has_function('public', 'deobfuscate_id', ARRAY['text'], 'deobfuscate_id(text) should exist');

-- 3. Verify optimized_posts table and columns
SELECT has_table('public', 'optimized_posts', 'optimized_posts table should exist');
SELECT col_type_is('public', 'optimized_posts', 'id', 'bigint', 'optimized_posts.id should be bigint');

-- 4. Verify v_optimized_posts view exists
SELECT has_view('public', 'v_optimized_posts', 'v_optimized_posts view should exist');

-- 5. Test basic encoding and decoding
SELECT is(
    public.obfuscate_id(9876543210::bigint),
    id_encode(9876543210::bigint, 'campus_connect_secret_salt_2026', 8),
    'obfuscate_id should match native pg_hashids encoding'
);

SELECT is(
    public.deobfuscate_id(public.obfuscate_id(12345::bigint)),
    12345::bigint,
    'deobfuscate_id(obfuscate_id(12345)) should return 12345'
);

SELECT is(
    public.deobfuscate_id('invalid_hash'),
    NULL,
    'deobfuscate_id with invalid hash should return NULL'
);

-- 6. Insert a test user for foreign key checks
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000001332', 'author@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000001332', 'Test Author', 'student')
ON CONFLICT (id) DO NOTHING;

-- Insert a baseline post into optimized_posts
INSERT INTO public.optimized_posts (title, content, author_id)
VALUES ('Optimized Performance', 'BigInt primary keys are much faster than UUIDs!', '00000000-0000-0000-0000-000000001332');

-- Get the ID generated for that post
-- Test: Assert the view returns a valid obfuscated ID matching the baseline post
SELECT matches(
    (SELECT id FROM public.v_optimized_posts WHERE title = 'Optimized Performance' LIMIT 1),
    '^[A-Za-z0-9]{8,}$',
    'Returned ID from view should be an obfuscated Hashid string of at least length 8'
);

-- Test INSERT through the view (which triggers INSTEAD OF INSERT to convert to BigInt)
INSERT INTO public.v_optimized_posts (title, content, author_id)
VALUES ('Inserted Through View', 'This post was inserted via the view using triggers', '00000000-0000-0000-0000-000000001332');

SELECT ok(
    exists(SELECT 1 FROM public.optimized_posts WHERE title = 'Inserted Through View'),
    'Inserting through the view should transparently insert into optimized_posts'
);

-- Test UPDATE through the view using the obfuscated ID
UPDATE public.v_optimized_posts
SET title = 'Updated Title Through View'
WHERE id = (
    SELECT id FROM public.v_optimized_posts WHERE title = 'Inserted Through View' LIMIT 1
);

SELECT ok(
    exists(SELECT 1 FROM public.optimized_posts WHERE title = 'Updated Title Through View'),
    'Updating through the view using the obfuscated ID should transparently update optimized_posts'
);

-- Test DELETE through the view using the obfuscated ID
DELETE FROM public.v_optimized_posts
WHERE id = (
    SELECT id FROM public.v_optimized_posts WHERE title = 'Updated Title Through View' LIMIT 1
);

SELECT ok(
    NOT exists(SELECT 1 FROM public.optimized_posts WHERE title = 'Updated Title Through View'),
    'Deleting through the view using the obfuscated ID should transparently delete from optimized_posts'
);

SELECT * FROM finish();
ROLLBACK;
