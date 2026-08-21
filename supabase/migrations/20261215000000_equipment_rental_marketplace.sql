-- Migration: 20261215000000_equipment_rental_marketplace.sql
-- Description: Implement B2B (Club-to-Club) Peer-to-Peer Equipment Rental Marketplace (#3549).

-- 1. Extend inventory_items with rental fields and owner club relation
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS owner_club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_rentable BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS daily_rental_rate INTEGER NOT NULL DEFAULT 0; -- in cents

-- Create index for quick rentable search query lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_rental
ON public.inventory_items (is_rentable, owner_club_id)
WHERE is_rentable = TRUE;

-- 2. Create equipment_rentals table
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    renter_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'authorized', 'captured', 'released', 'rejected', 'cancelled')),
    stripe_charge_id TEXT, -- PaymentIntent ID
    rental_fee_cents INTEGER NOT NULL,
    security_deposit_cents INTEGER NOT NULL DEFAULT 50000, -- $500 deposit in cents
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_item ON public.equipment_rentals(item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_renter ON public.equipment_rentals(renter_club_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_status ON public.equipment_rentals(status);

-- Enable RLS
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view rentals for their own club" ON public.equipment_rentals;
CREATE POLICY "Users can view rentals for their own club" ON public.equipment_rentals
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE (cm.club_id = renter_club_id OR cm.club_id = (SELECT owner_club_id FROM public.inventory_items WHERE id = item_id))
              AND cm.user_id = auth.uid()
              AND cm.status = 'approved'
        )
    );

DROP POLICY IF EXISTS "Club members can request rentals" ON public.equipment_rentals;
CREATE POLICY "Club members can request rentals" ON public.equipment_rentals
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = renter_club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'admin'
              AND cm.status = 'approved'
        )
    );

-- 3. RPC to request an equipment rental
CREATE OR REPLACE FUNCTION public.request_equipment_rental(
    p_item_id UUID,
    p_renter_club_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_days INTEGER;
    v_fee INTEGER;
    v_rental_id UUID;
    v_owner_club_name TEXT;
    v_renter_club_name TEXT;
    v_owner_admin UUID;
BEGIN
    -- 1. Verify item is rentable and exists
    SELECT * INTO v_item FROM public.inventory_items WHERE id = p_item_id AND is_rentable = TRUE AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or not available for rent.';
    END IF;

    -- 2. Verify renter is admin of the renter club
    IF NOT EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = p_renter_club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Not authorized: Only club admins can request rentals.';
    END IF;

    -- 3. Check dates logic
    IF p_start_date >= p_end_date THEN
        RAISE EXCEPTION 'Start date must be before end date.';
    END IF;

    IF p_start_date < NOW() THEN
        RAISE EXCEPTION 'Start date cannot be in the past.';
    END IF;

    -- 4. Check overlapping reservations/rentals
    IF NOT public.check_equipment_availability(p_item_id, p_start_date, p_end_date) THEN
        RAISE EXCEPTION 'Equipment is not available during selected dates.';
    END IF;

    -- 5. Calculate daily fee
    v_days := EXTRACT(DAY FROM (p_end_date - p_start_date));
    IF v_days <= 0 THEN
        v_days := 1;
    END IF;
    v_fee := v_days * v_item.daily_rental_rate;

    -- 6. Insert rental record
    INSERT INTO public.equipment_rentals (
        item_id, renter_club_id, requester_id, start_date, end_date, status, rental_fee_cents, security_deposit_cents
    ) VALUES (
        p_item_id, p_renter_club_id, auth.uid(), p_start_date, p_end_date, 'requested', v_fee, 50000
    )
    RETURNING id INTO v_rental_id;

    -- 7. Notify owner club admins
    SELECT name INTO v_owner_club_name FROM public.clubs WHERE id = v_item.owner_club_id;
    SELECT name INTO v_renter_club_name FROM public.clubs WHERE id = p_renter_club_id;

    FOR v_owner_admin IN
        SELECT user_id FROM public.club_members
        WHERE club_id = v_item.owner_club_id AND role = 'admin' AND status = 'approved'
    LOOP
        PERFORM public.queue_or_send_notification(
            p_user_id => v_owner_admin,
            p_notification_type => 'equipment_rental_request',
            p_title => 'Equipment Rental Request',
            p_message => v_renter_club_name || ' wants to rent your ' || v_item.name || '.',
            p_link => '/clubs/' || v_item.owner_club_id || '/rentals',
            p_entity_id => v_rental_id,
            p_entity_type => 'equipment_rental',
            p_actor_id => auth.uid()
        );
    END LOOP;

    RETURN v_rental_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_equipment_rental(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 4. RPC to authorize equipment rental
CREATE OR REPLACE FUNCTION public.authorize_equipment_rental(
    p_rental_id UUID,
    p_charge_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rental RECORD;
    v_reservation_id UUID;
BEGIN
    SELECT * INTO v_rental FROM public.equipment_rentals WHERE id = p_rental_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental request not found.';
    END IF;

    -- Update rental status
    UPDATE public.equipment_rentals
    SET status = 'authorized',
        stripe_charge_id = p_charge_id,
        updated_at = NOW()
    WHERE id = p_rental_id;

    -- Create reservation automatically in approved status
    INSERT INTO public.equipment_reservations (
        item_id, club_id, reserved_by, start_date, end_date, status, notes
    ) VALUES (
        v_rental.item_id,
        v_rental.renter_club_id,
        v_rental.requester_id,
        v_rental.start_date,
        v_rental.end_date,
        'approved',
        'B2B Club rental transaction: ' || p_rental_id::text
    )
    RETURNING id INTO v_reservation_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authorize_equipment_rental(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_equipment_rental(UUID, TEXT) TO service_role;

-- 5. RPC to return equipment (capturing payment)
CREATE OR REPLACE FUNCTION public.return_equipment_rental(
    p_rental_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rental RECORD;
    v_item RECORD;
BEGIN
    -- Lock rental record
    SELECT * INTO v_rental FROM public.equipment_rentals WHERE id = p_rental_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental request not found.';
    END IF;

    -- Lock item record
    SELECT * INTO v_item FROM public.inventory_items WHERE id = v_rental.item_id FOR UPDATE;

    -- Verify caller is admin of owner club
    IF NOT EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = v_item.owner_club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Not authorized: Only owner club admins can mark items as returned.';
    END IF;

    -- Update rental status
    UPDATE public.equipment_rentals
    SET status = 'captured',
        updated_at = NOW()
    WHERE id = p_rental_id;

    -- Update reservation status to returned
    UPDATE public.equipment_reservations
    SET status = 'returned',
        returned_at = NOW()
    WHERE notes LIKE '%' || p_rental_id::text || '%';

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.return_equipment_rental(UUID) TO authenticated;
