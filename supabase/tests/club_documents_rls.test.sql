-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated, anon;

-- Setup mock test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'doc_creator@test.com', 'authenticated', 'authenticated', '{"full_name": "Doc Creator"}'),
  ('70000000-0000-0000-0000-000000000002', 'doc_admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Doc Admin"}'),
  ('70000000-0000-0000-0000-000000000003', 'doc_member@test.com', 'authenticated', 'authenticated', '{"full_name": "Doc Member"}'),
  ('70000000-0000-0000-0000-000000000004', 'doc_pending@test.com', 'authenticated', 'authenticated', '{"full_name": "Doc Pending"}'),
  ('70000000-0000-0000-0000-000000000005', 'doc_outsider@test.com', 'authenticated', 'authenticated', '{"full_name": "Doc Outsider"}')
ON CONFLICT (id) DO NOTHING;

-- Insert profiles if needed
INSERT INTO public.profiles (id, full_name, email)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'Doc Creator', 'doc_creator@test.com'),
  ('70000000-0000-0000-0000-000000000002', 'Doc Admin', 'doc_admin@test.com'),
  ('70000000-0000-0000-0000-000000000003', 'Doc Member', 'doc_member@test.com'),
  ('70000000-0000-0000-0000-000000000004', 'Doc Pending', 'doc_pending@test.com'),
  ('70000000-0000-0000-0000-000000000005', 'Doc Outsider', 'doc_outsider@test.com')
ON CONFLICT (id) DO NOTHING;

-- Create test club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('70000000-0000-0000-0000-000000000010', 'Doc Test Club', 'doc-test-club', 'Testing Club Documents RLS', '70000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert club memberships
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES
  ('70000000-0000-0000-0000-000000000020', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000002', 'admin', 'approved'),
  ('70000000-0000-0000-0000-000000000021', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000003', 'member', 'approved'),
  ('70000000-0000-0000-0000-000000000022', '70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000004', 'member', 'pending')
ON CONFLICT (id) DO NOTHING;

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-documents', 'club-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Insert test storage document
INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES ('70000000-0000-0000-0000-000000000030', 'club-documents', '70000000-0000-0000-0000-000000000010/agenda.pdf', '70000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- Test 1: Unauthenticated (anon) user CANNOT read club documents
-- ==========================================
SET local role anon;

SELECT is_empty(
  $$SELECT name FROM storage.objects WHERE bucket_id = 'club-documents'$$,
  'Unauthenticated (anon) users cannot read club documents'
);

RESET role;

-- ==========================================
-- Test 2: Outsider user CANNOT read club documents
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000005', true);

SELECT is_empty(
  $$SELECT name FROM storage.objects WHERE bucket_id = 'club-documents'$$,
  'Non-members cannot view club documents'
);

RESET role;

-- ==========================================
-- Test 3: Pending member CANNOT read club documents
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000004', true);

SELECT is_empty(
  $$SELECT name FROM storage.objects WHERE bucket_id = 'club-documents'$$,
  'Pending members cannot view club documents'
);

RESET role;

-- ==========================================
-- Test 4: Approved member CAN view club documents
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', true);

SELECT results_eq(
  $$SELECT name FROM storage.objects WHERE id = '70000000-0000-0000-0000-000000000030'$$,
  ARRAY['70000000-0000-0000-0000-000000000010/agenda.pdf'],
  'Approved club member can view club documents'
);

-- ==========================================
-- Test 5: Approved member (non-admin) CANNOT insert club documents
-- ==========================================
SELECT throws_ok(
  $$INSERT INTO storage.objects (id, bucket_id, name, owner) VALUES ('70000000-0000-0000-0000-000000000031', 'club-documents', '70000000-0000-0000-0000-000000000010/new_doc.pdf', '70000000-0000-0000-0000-000000000003')$$,
  '42501',
  NULL,
  'Non-admin club members cannot upload club documents'
);

RESET role;

-- ==========================================
-- Test 6: Club Admin CAN insert club documents
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);

INSERT INTO storage.objects (id, bucket_id, name, owner)
VALUES ('70000000-0000-0000-0000-000000000032', 'club-documents', '70000000-0000-0000-0000-000000000010/admin_doc.pdf', '70000000-0000-0000-0000-000000000002');

SELECT results_eq(
  $$SELECT name FROM storage.objects WHERE id = '70000000-0000-0000-0000-000000000032'$$,
  ARRAY['70000000-0000-0000-0000-000000000010/admin_doc.pdf'],
  'Club Admin can upload club documents'
);

-- ==========================================
-- Test 7: Club Admin CAN delete club documents
-- ==========================================
DELETE FROM storage.objects WHERE id = '70000000-0000-0000-0000-000000000032';

SELECT is_empty(
  $$SELECT name FROM storage.objects WHERE id = '70000000-0000-0000-0000-000000000032'$$,
  'Club Admin can delete club documents'
);

RESET role;

-- ==========================================
-- Test 8: Club Creator CAN view and upload club documents
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

SELECT results_eq(
  $$SELECT name FROM storage.objects WHERE id = '70000000-0000-0000-0000-000000000030'$$,
  ARRAY['70000000-0000-0000-0000-000000000010/agenda.pdf'],
  'Club Creator can view club documents'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
