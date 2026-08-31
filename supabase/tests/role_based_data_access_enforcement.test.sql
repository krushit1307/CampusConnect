BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

SELECT has_function(
  'public',
  'authorize_resource_action',
  ARRAY['text', 'uuid', 'text', 'uuid'],
  'Central authorization function should exist'
);

-- Member must not be able to update another user's club.
SELECT is(
  public.authorize_resource_action(
    'club',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'update_club',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Ordinary member cannot update another club'
);

-- Member must not be able to delete a club.
SELECT is(
  public.authorize_resource_action(
    'club',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'delete_club',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Ordinary member cannot delete a club'
);

-- Event ownership must be checked.
SELECT is(
  public.authorize_resource_action(
    'event',
    '00000000-0000-0000-0000-000000000003'::uuid,
    'update_event',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Non-owner cannot update another users event'
);

-- Event administration must be checked against the event's club.
SELECT is(
  public.authorize_resource_action(
    'event',
    '00000000-0000-0000-0000-000000000003'::uuid,
    'cancel_event',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Non-admin cannot cancel another clubs event'
);

-- Missing users are always denied.
SELECT is(
  public.authorize_resource_action(
    'event',
    '00000000-0000-0000-0000-000000000003'::uuid,
    'update_event',
    NULL
  ),
  false,
  'Missing user is denied'
);

-- Invalid resources are denied.
SELECT is(
  public.authorize_resource_action(
    'event',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
    'update_event',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Unknown event is denied'
);

-- Unsupported operations are denied.
SELECT is(
  public.authorize_resource_action(
    'club',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'unsupported_operation',
    '00000000-0000-0000-0000-000000000002'::uuid
  ),
  false,
  'Unsupported operation is denied'
);

-- Verify the policy function is SECURITY DEFINER.
SELECT is(
  p.prosecdef,
  true,
  'Authorization function must run as SECURITY DEFINER'
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'authorize_resource_action';

-- Verify public cannot execute the policy function.
SELECT has_no_privilege(
  'public',
  'public.authorize_resource_action(text,uuid,text,uuid)',
  'EXECUTE',
  'Anonymous public role must not execute authorization policy'
);

-- Verify authenticated users can execute it.
SELECT has_privilege(
  'authenticated',
  'public.authorize_resource_action(text,uuid,text,uuid)',
  'EXECUTE',
  'Authenticated users can execute authorization policy'
);

-- Verify service-role workers can execute it.
SELECT has_privilege(
  'service_role',
  'public.authorize_resource_action(text,uuid,text,uuid)',
  'EXECUTE',
  'Service role can execute authorization policy'
);

SELECT * FROM finish();

ROLLBACK;