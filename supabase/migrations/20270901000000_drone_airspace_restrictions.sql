-- Migration: 20270901000000_drone_airspace_restrictions.sql
-- Description: Implement 'Dynamic "Hardware Resource" Drone Airspace Restriction Integration' (#4813)

-- 1. Create temporary_flight_restrictions table
CREATE TABLE IF NOT EXISTS public.temporary_flight_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restriction_date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.temporary_flight_restrictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Anyone can view airspace restrictions" ON public.temporary_flight_restrictions;
CREATE POLICY "Anyone can view airspace restrictions" 
ON public.temporary_flight_restrictions FOR SELECT TO authenticated, anon 
USING (true);

-- 2. Redefine request_equipment_rental function to enforce TFR airspace check
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

    -- 4a. If item is a Drone, perform airspace restriction check
    IF v_item.category = 'drone' OR v_item.category = 'drones' OR v_item.name ILIKE '%drone%' THEN
        IF EXISTS (
            SELECT 1 FROM public.temporary_flight_restrictions
            WHERE restriction_date >= p_start_date::date AND restriction_date <= p_end_date::date
        ) THEN
            RAISE EXCEPTION 'Airspace Restricted: A Temporary Flight Restriction is active on this date. Drones cannot be flown. Booking denied for legal compliance.';
        END IF;
    END IF;

    -- 4b. Check overlapping reservations/rentals
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
