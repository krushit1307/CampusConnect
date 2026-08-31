-- ============================================================
-- Test Suite: equipment_rental_approval.test.sql
-- Description: Verifies B2B ledger transfer and liability contracts logic.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schema components
SELECT has_column('public', 'inventory_items', 'rental_price_per_day', 'inventory_items should have rental_price_per_day column');
SELECT has_table('public', 'equipment_rental_contracts', 'equipment_rental_contracts table should exist');
SELECT has_function('public', 'approve_equipment_rental', 'approve_equipment_rental function should exist');

-- 2. Mock users, clubs and rentable inventory items
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000ad1', 'lender-admin@campus.edu'),
    ('00000000-0000-0000-0000-000000000ad2', 'renter-admin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000ad1', 'Alice', 'Lender', 'alice_lender', 'lender-admin@campus.edu'),
    ('00000000-0000-0000-0000-000000000ad2', 'Bob', 'Renter', 'bob_renter', 'renter-admin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES
    ('00000000-0000-0000-0000-000000000ad3', 'Lender Club', 'lender-club', '00000000-0000-0000-0000-000000000ad1'),
    ('00000000-0000-0000-0000-000000000ad4', 'Renter Club', 'renter-club', '00000000-0000-0000-0000-000000000ad2')
ON CONFLICT (id) DO NOTHING;

-- Make them approved members/admins
INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000ad3', '00000000-0000-0000-0000-000000000ad1', 'admin', 'approved'),
    ('00000000-0000-0000-0000-000000000ad4', '00000000-0000-0000-0000-000000000ad2', 'admin', 'approved')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Insert starting balances for Renter Club ($100.00)
INSERT INTO public.club_transactions (club_id, amount, transaction_type, category, description)
VALUES ('00000000-0000-0000-0000-000000000ad4', 100.00, 'INCOME', 'Grants', 'Starting Funding');

-- Insert rentable inventory item
INSERT INTO public.inventory_items (id, name, barcode, category, condition, owner_club_id, is_rentable, rental_price_per_day)
VALUES (
    '00000000-0000-0000-0000-000000000ai2',
    'DJ Speakers',
    'BAR-SPK-102',
    'Audio',
    'good',
    '00000000-0000-0000-0000-000000000ad3',
    true,
    50.00 -- $50.00 / day
)
ON CONFLICT (id) DO NOTHING;

-- Verify trigger synchronized daily_rental_rate to 5000 cents
SELECT results_eq(
    $$
    SELECT daily_rental_rate FROM public.inventory_items WHERE id = '00000000-0000-0000-0000-000000000ai2';
    $$,
    ARRAY[5000],
    'Inventory item trigger should synchronize daily_rental_rate in cents'
);

-- 3. Propose rental request as Renter Admin (requires $50 fee total for 1 day)
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000ad2';

SELECT lives_ok(
    $$
    SELECT public.request_equipment_rental(
        '00000000-0000-0000-0000-000000000ai2',
        '00000000-0000-0000-0000-000000000ad4',
        now() + INTERVAL '1 day',
        now() + INTERVAL '2 days'
    );
    $$,
    'Renter admin submits request for DJ Speakers'
);

-- 4. Approve rental request as Lender Admin (Alice)
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000ad1';

SELECT lives_ok(
    $$
    SELECT public.approve_equipment_rental(id) FROM public.equipment_rentals WHERE item_id = '00000000-0000-0000-0000-000000000ai2';
    $$,
    'Lender admin approves the rental request'
);

-- 5. Verify ledger transfer: renter balance should be $50 ($100 - $50), lender balance should be $50 ($0 + $50)
SELECT results_eq(
    $$
    SELECT SUM(amount) FROM public.club_transactions WHERE club_id = '00000000-0000-0000-0000-000000000ad4';
    $$,
    ARRAY[50.00],
    'Renter club balance should be reduced by $50.00'
);

SELECT results_eq(
    $$
    SELECT SUM(amount) FROM public.club_transactions WHERE club_id = '00000000-0000-0000-0000-000000000ad3';
    $$,
    ARRAY[50.00],
    'Lender club balance should be credited by $50.00'
);

-- 6. Verify immutable liability contract was generated and logged
SELECT results_eq(
    $$
    SELECT COUNT(*)::integer FROM public.equipment_rental_contracts WHERE item_id = '00000000-0000-0000-0000-000000000ai2';
    $$,
    ARRAY[1],
    'An immutable digital contract should be generated for the rental'
);

ROLLBACK;
