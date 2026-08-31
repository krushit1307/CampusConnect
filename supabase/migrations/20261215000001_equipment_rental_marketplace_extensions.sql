-- Migration: 20261215000001_equipment_rental_marketplace_extensions.sql
-- Description: Extensions for peer-to-peer equipment rentals including contract liability tracking, ledger transfers, and trigger-synced price fields.

-- 1. Add rental_price_per_day (in dollars) to inventory_items
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS rental_price_per_day NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- 2. Create trigger to sync daily_rental_rate (cents) and rental_price_per_day (dollars)
CREATE OR REPLACE FUNCTION public.sync_inventory_item_rental_rates()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If daily_rental_rate was updated, sync rental_price_per_day
        IF (TG_OP = 'INSERT') OR (NEW.daily_rental_rate IS DISTINCT FROM OLD.daily_rental_rate) THEN
            NEW.rental_price_per_day := (NEW.daily_rental_rate::numeric / 100.00);
        -- If rental_price_per_day was updated, sync daily_rental_rate
        ELSIF NEW.rental_price_per_day IS DISTINCT FROM OLD.rental_price_per_day THEN
            NEW.daily_rental_rate := (NEW.rental_price_per_day * 100)::integer;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_item_rental_rates ON public.inventory_items;
CREATE TRIGGER trg_sync_inventory_item_rental_rates
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_item_rental_rates();

-- Backfill existing rates
UPDATE public.inventory_items
SET rental_price_per_day = (daily_rental_rate::numeric / 100.00)
WHERE daily_rental_rate > 0;

-- 3. Create equipment_rental_contracts table for liability and damage tracking
CREATE TABLE IF NOT EXISTS public.equipment_rental_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES public.equipment_rentals(id) ON DELETE CASCADE,
    contract_text TEXT NOT NULL,
    renter_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    owner_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    liability_limit_cents INTEGER NOT NULL DEFAULT 50000, -- replacement / damage liability up to $500
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for contracts
ALTER TABLE public.equipment_rental_contracts ENABLE ROW LEVEL SECURITY;

-- Read policy: accessible by members of both renter and owner clubs
DROP POLICY IF EXISTS "Access contracts for renter or owner clubs" ON public.equipment_rental_contracts;
CREATE POLICY "Access contracts for renter or owner clubs" ON public.equipment_rental_contracts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE (cm.club_id = renter_club_id OR cm.club_id = owner_club_id)
              AND cm.user_id = auth.uid()
              AND cm.status = 'approved'
        )
    );

-- 4. Create RPC to approve equipment rental and perform ledger transfer
CREATE OR REPLACE FUNCTION public.approve_equipment_rental(
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
    v_renter_club RECORD;
    v_owner_club RECORD;
    v_renter_balance NUMERIC(10,2);
    v_fee_dollars NUMERIC(10,2);
    v_contract_text TEXT;
    v_reservation_id UUID;
BEGIN
    -- 1. Fetch rental details with lock
    SELECT * INTO v_rental FROM public.equipment_rentals WHERE id = p_rental_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rental request not found.';
    END IF;

    IF v_rental.status IS DISTINCT FROM 'requested' THEN
        RAISE EXCEPTION 'Rental request has already been processed.';
    END IF;

    -- 2. Fetch item and owner club details
    SELECT * INTO v_item FROM public.inventory_items WHERE id = v_rental.item_id;
    SELECT * INTO v_owner_club FROM public.clubs WHERE id = v_item.owner_club_id;
    SELECT * INTO v_renter_club FROM public.clubs WHERE id = v_rental.renter_club_id;

    -- 3. Verify caller is admin of the owner club
    IF NOT EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = v_item.owner_club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Not authorized: Only owner club admins can approve rentals.';
    END IF;

    -- 4. Verify renter club has sufficient balance
    SELECT COALESCE(net_balance, 0.00) INTO v_renter_balance 
    FROM public.club_financial_balances 
    WHERE club_id = v_rental.renter_club_id;

    v_fee_dollars := (v_rental.rental_fee_cents::numeric / 100.00);

    IF v_renter_balance < v_fee_dollars THEN
        RAISE EXCEPTION 'Sufficient club funds not available for rental fee.';
    END IF;

    -- 5. Perform the ledger transfer (Club B -> Club A)
    -- Deduct from renter club
    INSERT INTO public.club_transactions (
        club_id, amount, transaction_type, category, description
    ) VALUES (
        v_rental.renter_club_id,
        -v_fee_dollars,
        'EXPENSE',
        'Equipment Rental',
        'Rental of ' || v_item.name || ' from ' || v_owner_club.name
    );

    -- Credit owner club
    INSERT INTO public.club_transactions (
        club_id, amount, transaction_type, category, description
    ) VALUES (
        v_item.owner_club_id,
        v_fee_dollars,
        'INCOME',
        'Equipment Rental',
        'Rental of ' || v_item.name || ' to ' || v_renter_club.name
    );

    -- 6. Generate and insert immutable digital contract
    v_contract_text := 'DIGITAL LIABILITY CONTRACT: Renter Club "' || v_renter_club.name || 
                       '" agrees to rent "' || v_item.name || '" from Owner Club "' || v_owner_club.name || 
                       '" from ' || to_char(v_rental.start_date, 'YYYY-MM-DD') || ' to ' || to_char(v_rental.end_date, 'YYYY-MM-DD') || 
                       ' for $' || v_fee_dollars::text || '. Renter Club assumes full liability for any loss, theft, or physical damage up to the replacement limit of $' || 
                       (v_rental.security_deposit_cents::numeric / 100.00)::text || '. signed electronically on ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '.';

    INSERT INTO public.equipment_rental_contracts (
        rental_id, contract_text, renter_club_id, owner_club_id, item_id, liability_limit_cents
    ) VALUES (
        p_rental_id, v_contract_text, v_rental.renter_club_id, v_item.owner_club_id, v_rental.item_id, v_rental.security_deposit_cents
    );

    -- 7. Update rental status to authorized (approved & paid)
    UPDATE public.equipment_rentals
    SET status = 'authorized',
        updated_at = NOW()
    WHERE id = p_rental_id;

    -- 8. Create reservation automatically in approved status
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

GRANT EXECUTE ON FUNCTION public.approve_equipment_rental(UUID) TO authenticated;
