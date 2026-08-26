-- =============================================================================
-- Migration: Club Resource Booking Calendar
-- Issue: #3340 - Develop a 'Club Resource Booking Calendar'
-- Description: Links inventory_items (Issue #2901) to a new item_reservations
-- table so club members can book club-owned equipment (e.g. cameras) for a
-- specific time window. A GIST exclusion constraint enforces at the database
-- level that the same item cannot be double-booked for overlapping times.
-- Approval is restricted to club executives (treasurer/president/admin),
-- matching the role convention already used by the reimbursement pipeline
-- and honorarium ledger features.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Step 1: item_reservations table ──────────────────────────
-- inventory_items already has an `owner_club_id` column (added by the
-- Issue #3549 equipment marketplace migration), which is what scopes an
-- item to the club that owns it (e.g. the Photography Club's cameras).
CREATE TABLE IF NOT EXISTS public.item_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_reservations_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_item_reservations_item_id ON public.item_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_user_id ON public.item_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_status ON public.item_reservations(status);

-- ── Step 2: strict double-booking prevention ─────────────────
-- Any two reservations for the same item that are still "live" (pending or
-- approved) cannot overlap in time. This is enforced at the database level,
-- not just in the UI, so it holds even under concurrent requests.
ALTER TABLE public.item_reservations
    ADD CONSTRAINT exclude_overlapping_item_reservations
    EXCLUDE USING gist (
        item_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status IN ('pending', 'approved'));

-- ── Step 3: RLS ────────────────────────────────────────────────
ALTER TABLE public.item_reservations ENABLE ROW LEVEL SECURITY;

-- Members of the owning club (and the requester themself) can view reservations.
DROP POLICY IF EXISTS "Club members can view item reservations." ON public.item_reservations;
CREATE POLICY "Club members can view item reservations."
ON public.item_reservations FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.inventory_items i
        JOIN public.club_members cm ON cm.club_id = i.owner_club_id
        WHERE i.id = item_reservations.item_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
    )
);

-- Any approved member of the owning club can propose a reservation for themself.
DROP POLICY IF EXISTS "Club members can request item reservations." ON public.item_reservations;
CREATE POLICY "Club members can request item reservations."
ON public.item_reservations FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM public.inventory_items i
        JOIN public.club_members cm ON cm.club_id = i.owner_club_id
        WHERE i.id = item_reservations.item_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
    )
);

-- Requesters can cancel their own still-pending reservation.
DROP POLICY IF EXISTS "Requesters can cancel their own pending reservation." ON public.item_reservations;
CREATE POLICY "Requesters can cancel their own pending reservation."
ON public.item_reservations FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Club executives (treasurer/president/admin) approve or reject requests.
DROP POLICY IF EXISTS "Club executives can approve or reject reservations." ON public.item_reservations;
CREATE POLICY "Club executives can approve or reject reservations."
ON public.item_reservations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.inventory_items i
        JOIN public.club_members cm ON cm.club_id = i.owner_club_id
        WHERE i.id = item_reservations.item_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('treasurer', 'president', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.inventory_items i
        JOIN public.club_members cm ON cm.club_id = i.owner_club_id
        WHERE i.id = item_reservations.item_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('treasurer', 'president', 'admin')
    )
);

-- ── Step 4: availability RPC (pre-check before insert) ────────
CREATE OR REPLACE FUNCTION public.check_item_availability(
    p_item_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conflict_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.item_reservations
    WHERE item_id = p_item_id
      AND status IN ('pending', 'approved')
      AND tstzrange(start_time, end_time) && tstzrange(p_start_time, p_end_time);

    RETURN v_conflict_count = 0;
END;
$$;

-- ── Step 5: notify the treasurer(s) when a booking is requested ──
CREATE OR REPLACE FUNCTION public.handle_item_reservation_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT
        cm.user_id,
        'item_reservation',
        'New Equipment Booking Request',
        'A member requested to book "' || i.name || '" from ' ||
            to_char(NEW.start_time, 'Mon DD, HH24:MI') || ' to ' ||
            to_char(NEW.end_time, 'Mon DD, HH24:MI') || '.',
        '/clubs/' || c.slug || '/resources'
    FROM public.inventory_items i
    JOIN public.clubs c ON c.id = i.owner_club_id
    JOIN public.club_members cm ON cm.club_id = i.owner_club_id
    WHERE i.id = NEW.item_id
      AND cm.role IN ('treasurer', 'president', 'admin')
      AND cm.status = 'approved';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_item_reservation_requested ON public.item_reservations;
CREATE TRIGGER on_item_reservation_requested
    AFTER INSERT ON public.item_reservations
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.handle_item_reservation_request();

-- ── Step 6: Realtime, so the calendar updates live ────────────
ALTER PUBLICATION supabase_realtime ADD TABLE item_reservations;

COMMENT ON TABLE public.item_reservations IS
'Booking requests for club-owned inventory items, with a GIST exclusion constraint preventing overlapping pending/approved bookings for the same item. Issue #3340.';
COMMENT ON CONSTRAINT exclude_overlapping_item_reservations ON public.item_reservations IS
'Prevents double-booking the same item for overlapping time windows. Issue #3340.';

-- =============================================================================
-- End of migration
-- =============================================================================