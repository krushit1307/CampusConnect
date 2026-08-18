BEGIN;
SELECT plan(4);

-- 1. Create test users
SELECT * FROM tests.create_supabase_user('user_lead', 'lead@cc.com');
SELECT * FROM tests.create_supabase_user('user_member', 'member@cc.com');
SELECT * FROM tests.create_supabase_user('user_unrelated', 'unrelated@cc.com');

-- Setup a test club
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Robotics Club',
    'robotics-club',
    tests.get_supabase_uid('user_lead')
);

-- Fetch the President role created automatically via trigger
DECLARE
    v_role_id UUID;
BEGIN
    SELECT id INTO v_role_id FROM public.club_roles 
    WHERE club_id = '10000000-0000-0000-0000-000000000001' AND name = 'President';

    -- Put user_lead into the President role
    INSERT INTO public.club_members (club_id, user_id, role_id, status)
    VALUES (
        '10000000-0000-0000-0000-000000000001',
        tests.get_supabase_uid('user_lead'),
        v_role_id,
        'approved'
    );
END;
$$;

-- 2. Test sole President ownership constraint throws error
SELECT throws_ok(
    $$SELECT public.delete_user_data(tests.get_supabase_uid('user_lead'))$$,
    'Cannot delete account. You are the sole President of club: Robotics Club. Please transition leadership first.',
    'delete_user_data throws if user is sole President'
);

-- 3. Transition leadership (add another president so lead is not sole president)
DECLARE
    v_role_id UUID;
    v_member_role_id UUID;
BEGIN
    SELECT id INTO v_role_id FROM public.club_roles 
    WHERE club_id = '10000000-0000-0000-0000-000000000001' AND name = 'President';

    SELECT id INTO v_member_role_id FROM public.club_roles 
    WHERE club_id = '10000000-0000-0000-0000-000000000001' AND name = 'Member';

    -- Make user_member a President too
    INSERT INTO public.club_members (club_id, user_id, role_id, status)
    VALUES (
        '10000000-0000-0000-0000-000000000001',
        tests.get_supabase_uid('user_member'),
        v_role_id,
        'approved'
    );

    -- Make user_unrelated a member
    INSERT INTO public.club_members (club_id, user_id, role_id, status)
    VALUES (
        '10000000-0000-0000-0000-000000000001',
        tests.get_supabase_uid('user_unrelated'),
        v_member_role_id,
        'approved'
    );
END;
$$;

-- Setup posts and transactions for user_lead
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    tests.get_supabase_uid('user_lead'),
    'Hello World!'
);

INSERT INTO public.transactions (id, club_id, type, amount, description, created_by)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'expense',
    100.00,
    'Supplies for Robotics',
    tests.get_supabase_uid('user_lead')
);

-- 4. Test delete_user_data success when leadership is not sole
SELECT lives_ok(
    $$SELECT public.delete_user_data(tests.get_supabase_uid('user_lead'))$$,
    'delete_user_data runs successfully when leadership is transitioned'
);

-- 5. Verify post is anonymized (not deleted)
SELECT results_eq(
    $$SELECT author_id, content FROM public.posts WHERE id = '20000000-0000-0000-0000-000000000001'$$,
    $$SELECT NULL::uuid, '[Deleted User]: Hello World!'::text$$,
    'Post is anonymized and content is prefixed'
);

-- 6. Verify transaction is scrubbed but preserved
SELECT results_eq(
    $$SELECT created_by, amount, description FROM public.transactions WHERE id = '30000000-0000-0000-0000-000000000001'$$,
    $$SELECT NULL::uuid, 100.00::numeric, 'PII Scrubbed (GDPR Deletion Request)'::text$$,
    'Transaction ledger remains intact but created_by and description are scrubbed'
);

SELECT * FROM finish();
ROLLBACK;
