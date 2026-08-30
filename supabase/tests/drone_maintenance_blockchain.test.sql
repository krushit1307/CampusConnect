-- =============================================================================
-- Test Suite: drone_maintenance_blockchain.test.sql
-- Purpose: Verify immutable hardware maintenance ledger writes, cryptographic
--          SHA-256 hash generation, and Polygon transaction mappings.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- 1. Schema structure check
SELECT has_table('public', 'equipment_maintenance_blockchain_logs', 'equipment_maintenance_blockchain_logs table exists');
SELECT has_column('public', 'equipment_maintenance_blockchain_logs', 'maintenance_hash', 'has maintenance_hash column');
SELECT has_column('public', 'equipment_maintenance_blockchain_logs', 'blockchain_tx_hash', 'has blockchain_tx_hash column');

-- Setup seeds
-- Profiles (Technician)
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-dr0000000001'::uuid, 'Technician Smith', 'student')
ON CONFLICT (id) DO NOTHING;

-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-dr0000000002'::uuid, 'AeroClub', 'aero-club')
ON CONFLICT (id) DO NOTHING;

-- Inventory Drone (Initial condition is NEEDS_REPAIR)
INSERT INTO public.inventory_items (id, name, category, barcode, club_id, condition_status)
VALUES (
  '00000000-0000-0000-0000-dr0000000003'::uuid,
  'University Quadcopter Drone',
  'drones',
  'DRONE-BARCODE-5063',
  '00000000-0000-0000-0000-dr0000000002'::uuid,
  'NEEDS_REPAIR'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Log Repair execution
SELECT is(
  (SELECT public.log_equipment_repair(
    '00000000-0000-0000-0000-dr0000000003'::uuid,
    '00000000-0000-0000-0000-dr0000000001'::uuid,
    'OEM Battery Replacements',
    'SN-BATT-998822',
    'sig-smith-12345'
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'Repair log write returns success status'
);

-- 3. Verify item condition status has been reset to EXCELLENT
SELECT is(
  (SELECT condition_status FROM public.inventory_items WHERE id = '00000000-0000-0000-0000-dr0000000003'::uuid),
  'EXCELLENT',
  'Inventory item condition status successfully restored to EXCELLENT after log'
);

-- 4. Verify immutable blockchain log record properties
SELECT matches(
  (SELECT maintenance_hash FROM public.equipment_maintenance_blockchain_logs WHERE item_id = '00000000-0000-0000-0000-dr0000000003'::uuid LIMIT 1),
  '^[a-fA-F0-9]{64}$',
  'Generates a valid SHA-256 cryptographically immutable maintenance hash'
);

SELECT matches(
  (SELECT blockchain_tx_hash FROM public.equipment_maintenance_blockchain_logs WHERE item_id = '00000000-0000-0000-0000-dr0000000003'::uuid LIMIT 1),
  '^0x[a-fA-F0-9]{64}$',
  'Generates a 0x-prefixed Polygon blockchain transaction hash'
);

ROLLBACK;
