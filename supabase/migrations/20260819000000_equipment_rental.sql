-- ============================================================
-- Migration: Equipment Rental Inventory System (Issue #2901)
--
-- Creates tables for inventory items and reservations, with:
--   1. Exclusion constraint to prevent double-booking (with a 2-hour buffer).
--   2. Damage reporting columns (`condition`, `damage_notes`, `damage_photo_url`).
--   3. RLS policies for club members and Student Union admins.
--   4. RPC to check item availability before reserving.
--   5. RPC to check-out and check-in items via barcode.
-- ============================================================

-- ── Step 1: Create inventory_items table ─────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'general',
    condition TEXT NOT NULL DEFAULT 'good'
        CHECK (condition IN ('good', 'damaged', 'maintenance')),
    damage_notes TEXT,
    damage_photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory_items (barcode);

-- ── Step 2: Create equipment_reservations table ──────────────
CREATE TABLE IF NOT EXISTS public.equipment_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    reserved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'checked_out', 'returned', 'overdue', 'cancelled')),
    checked_out_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 3: Double-booking prevention ────────────────────────
-- Requires the btree_gist extension for EXCLUDE constraints
-- on UUID + daterange.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclude overlapping reservations for the same item, with a 2-hour buffer.
-- Only applies to non-cancelled reservations.
ALTER TABLE public.equipment_reservations
    ADD CONSTRAINT exclude_overlapping_reservations
    EXCLUDE USING gist (
        item_id WITH =,
        tstzrange(
            start_date - INTERVAL '2 hours',
            end_date + INTERVAL '2 hours'
        ) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'returned'));

-- ── Step 4: RLS Policies ─────────────────────────────────────
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;

-- Inventory items: readable by all authenticated users.
DROP POLICY IF EXISTS "Authenticated users can view inventory." ON public.inventory_items;
CREATE POLICY "Authenticated users can view inventory."
ON public.inventory_items FOR SELECT
USING (auth.role() = 'authenticated');

-- Only Student Union admins can modify inventory.
DROP POLICY IF EXISTS "Admins can manage inventory." ON public.inventory_items;
CREATE POLICY "Admins can manage inventory."
ON public.inventory_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Reservations: clubs can view their own, admins can view all.
DROP POLICY IF EXISTS "Clubs can view their reservations." ON public.equipment_reservations;
CREATE POLICY "Clubs can view their reservations."
ON public.equipment_reservations FOR SELECT
USING (
    auth.uid() = reserved_by
    OR EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = equipment_reservations.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Clubs can create reservations.
DROP POLICY IF EXISTS "Clubs can create reservations." ON public.equipment_reservations;
CREATE POLICY "Clubs can create reservations."
ON public.equipment_reservations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = equipment_reservations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    )
);

-- Only admins can update reservation status (check-out, check-in).
DROP POLICY IF EXISTS "Admins can update reservations." ON public.equipment_reservations;
CREATE POLICY "Admins can update reservations."
ON public.equipment_reservations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ── Step 5: check_equipment_availability RPC ─────────────────
CREATE OR REPLACE FUNCTION public.check_equipment_availability(
    p_item_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_conflict_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.equipment_reservations
    WHERE item_id = p_item_id
      AND status NOT IN ('cancelled', 'returned')
      AND tstzrange(start_date - INTERVAL '2 hours', end_date + INTERVAL '2 hours')
          && tstzrange(p_start_date, p_end_date);

    RETURN v_conflict_count = 0;
END;
 $$;

-- ── Step 6: check_out_equipment RPC ──────────────────────────
CREATE OR REPLACE FUNCTION public.check_out_equipment(
    p_barcode TEXT,
    p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_item RECORD;
    v_reservation RECORD;
BEGIN
    SELECT * INTO v_item FROM public.inventory_items WHERE barcode = p_barcode;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item not found for barcode.');
    END IF;

    IF v_item.condition = 'damaged' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is damaged and cannot be checked out.');
    END IF;

    SELECT * INTO v_reservation FROM public.equipment_reservations WHERE id = p_reservation_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation not found.');
    END IF;

    IF v_reservation.item_id != v_item.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Barcode does not match the reserved item.');
    END IF;

    IF v_reservation.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation is not in approved state.');
    END IF;

    UPDATE public.equipment_reservations
    SET status = 'checked_out', checked_out_at = NOW()
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object('success', true, 'message', 'Item checked out successfully.');
END;
 $$;

-- ── Step 7: check_in_equipment RPC ───────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_equipment(
    p_barcode TEXT,
    p_condition TEXT DEFAULT 'good',
    p_damage_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_item RECORD;
    v_reservation RECORD;
BEGIN
    SELECT * INTO v_item FROM public.inventory_items WHERE barcode = p_barcode;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item not found for barcode.');
    END IF;

    SELECT * INTO v_reservation
    FROM public.equipment_reservations
    WHERE item_id = v_item.id AND status = 'checked_out'
    ORDER BY checked_out_at DESC LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active checkout found for this item.');
    END IF;

    -- Mark reservation returned.
    UPDATE public.equipment_reservations
    SET status = 'returned', returned_at = NOW()
    WHERE id = v_reservation.id;

    -- Update item condition if damaged.
    IF p_condition = 'damaged' THEN
        UPDATE public.inventory_items
        SET condition = 'damaged', damage_notes = p_damage_notes, is_active = FALSE
        WHERE id = v_item.id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Item checked in successfully.');
END;
 $$;

-- ── Step 8: Overdue cron (pg_cron) ──────────────────────────
-- Marks reservations as overdue if end_date has passed.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron not installed; skipping overdue schedule.';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        jobname := 'equipment-overdue-check',
        schedule := '0 * * * *',  -- Every hour
        command := $cmd$             UPDATE public.equipment_reservations
            SET status = 'overdue'
            WHERE status = 'checked_out'
              AND end_date < NOW();
        $cmd$     );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule overdue check: %', SQLERRM;
END $$;

COMMENT ON TABLE public.inventory_items IS
'Equipment owned by the Student Union, available for club rental. Issue #2901.';
COMMENT ON TABLE public.equipment_reservations IS
'Reservations for equipment rentals, with double-booking prevention and 2-hour buffer. Issue #2901.';
COMMENT ON CONSTRAINT exclude_overlapping_reservations ON public.equipment_reservations IS
'Prevents double-booking the same item for overlapping dates, with a 2-hour buffer for logistics. Issue #2901.';

-- ============================================================
-- End of migration
-- ============================================================
