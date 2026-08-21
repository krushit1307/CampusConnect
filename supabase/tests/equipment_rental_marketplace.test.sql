-- ============================================================
-- Test Suite: equipment_rental_marketplace.test.sql
-- Description: Verifies peer-to-peer equipment rentals, dates checks, and Stripe triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Check schema components
SELECT has_column('public', 'inventory_items', 'owner_club_id', 'inventory_items should have owner_club_id column');
SELECT has_column('public', 'inventory_items', 'is_rentable', 'inventory_items should have is_rentable column');
SELECT has_column('public', 'inventory_items', 'daily_rental_rate', 'inventory_items should have daily_rental_rate column');
SELECT has_table('public', 'equipment_rentals', 'equipment_rentals table should exist');
SELECT has_function('public', 'request_equipment_rental', 'request_equipment_rental function should exist');
SELECT has_function('public', 'authorize_equipment_rental', 'authorize_equipment_rental function should exist');
SELECT has_function('public', 'return_equipment_rental', 'return_equipment_rental function should exist');

-- 2. Mock users, clubs and rentable inventory items
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000cc1', 'owner-admin@campus.edu'),
    ('00000000-0000-0000-0000-000000000cc2', 'renter-admin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000cc1', 'Alice', 'Owner', 'alice_owner', 'owner-admin@campus.edu'),
    ('00000000-0000-0000-0000-000000000cc2', 'Bob', 'Renter', 'bob_renter', 'renter-admin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES
    ('00000000-0000-0000-0000-000000000cc3', 'Lending Club', 'lending-club', '00000000-0000-0000-0000-000000000cc1'),
    ('00000000-0000-0000-0000-000000000cc4', 'Borrowing Club', 'borrowing-club', '00000000-0000-0000-0000-000000000cc2')
ON CONFLICT (id) DO NOTHING;

-- Make them approved members/admins
INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000cc3', '00000000-0000-0000-0000-000000000cc1', 'admin', 'approved'),
    ('00000000-0000-0000-0000-000000000cc4', '00000000-0000-0000-0000-000000000cc2', 'admin', 'approved')
ON CONFLICT (club_id, user_id) DO NOTHING;

INSERT INTO public.inventory_items (id, name, barcode, category, condition, owner_club_id, is_rentable, daily_rental_rate)
VALUES (
    '00000000-0000-0000-0000-000000000ci1',
    'Stage Mic',
    'BAR-MIC-101',
    'Audio',
    'good',
    '00000000-0000-0000-0000-000000000cc3',
    true,
    2500 -- $25.00
)
ON CONFLICT (id) DO NOTHING;

-- 3. Propose rental request as Renter Admin
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000cc2';

DECLARE
  v_rent_id UUID;
BEGIN
  v_rent_id := public.request_equipment_rental(
    '00000000-0000-0000-0000-000000000ci1',
    '00000000-0000-0000-0000-000000000cc4',
    now() + INTERVAL '1 day',
    now() + INTERVAL '3 days'
  );
END;

SELECT results_eq(
    $$
    SELECT status FROM public.equipment_rentals WHERE item_id = '00000000-0000-0000-0000-000000000ci1';
    $$,
    ARRAY['requested'],
    'Equipment rental status should start at requested'
);

-- 4. Authorize rental (Stripe confirmation simulation)
SET local role service_role;

SELECT lives_ok(
    $$
    SELECT public.authorize_equipment_rental(id, 'ch_test_123') FROM public.equipment_rentals WHERE item_id = '00000000-0000-0000-0000-000000000ci1';
    $$,
    'Authorize equipment rental transition completes successfully'
);

-- 5. Return gear safely as Owner Admin
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000cc1';

SELECT lives_ok(
    $$
    SELECT public.return_equipment_rental(id) FROM public.equipment_rentals WHERE item_id = '00000000-0000-0000-0000-000000000ci1';
    $$,
    'Lender accepts return of the equipment'
);

ROLLBACK;
