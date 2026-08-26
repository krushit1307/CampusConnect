-- ============================================================
-- Test Suite: rbac_hierarchical.test.sql
-- Description: Verifies the hierarchical RBAC permission system,
--              recursive CTE search queries, and inheritance.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (10 tests)
SELECT plan(10);

-- Test 1: Verify tables exist in public schema
SELECT has_table('public', 'roles', 'Table public.roles should exist');
SELECT has_table('public', 'role_permissions', 'Table public.role_permissions should exist');
SELECT has_table('public', 'user_roles', 'Table public.user_roles should exist');

-- Test 2: Verify has_permission function exists
SELECT has_function(
  'public',
  'has_permission',
  ARRAY['uuid', 'text'],
  'Function public.has_permission(uuid, text) should exist'
);

-- Setup test users
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'member@cc.edu', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000002', 'manager@cc.edu', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000003', 'president@cc.edu', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000004', 'admin@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Map roles to test users
INSERT INTO public.user_roles (user_id, role_id)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 1), -- Member
  ('c0000000-0000-0000-0000-000000000002', 2), -- Event Manager
  ('c0000000-0000-0000-0000-000000000003', 3), -- Club President
  ('c0000000-0000-0000-0000-000000000004', 4)  -- University Admin
ON CONFLICT DO NOTHING;

-- Test 3: Member permissions check (Member has 'events.view' but not 'events.create')
SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000001'::uuid, 'events.view'),
  true,
  'Member should have events.view permission'
);

SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000001'::uuid, 'events.create'),
  false,
  'Member should not have events.create permission'
);

-- Test 4: Event Manager permissions check (Manager has 'events.create' and inherits 'events.view')
SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000002'::uuid, 'events.view'),
  true,
  'Event Manager inherits events.view from Member'
);

SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000002'::uuid, 'events.create'),
  true,
  'Event Manager has events.create permission'
);

SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000002'::uuid, 'clubs.update'),
  false,
  'Event Manager should not have clubs.update permission'
);

-- Test 5: Club President permissions check (President has 'clubs.update' and inherits 'events.create')
SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000003'::uuid, 'events.create'),
  true,
  'Club President inherits events.create from Event Manager'
);

SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000003'::uuid, 'clubs.update'),
  true,
  'Club President has clubs.update permission'
);

-- Test 6: University Admin permissions check (Admin inherits everything)
SELECT is(
  public.has_permission('c0000000-0000-0000-0000-000000000004'::uuid, 'clubs.delete'),
  true,
  'University Admin inherits clubs.delete from Admin permissions'
);

SELECT * FROM finish();
ROLLBACK;
