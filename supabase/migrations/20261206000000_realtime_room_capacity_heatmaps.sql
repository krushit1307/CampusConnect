-- ============================================================
-- Migration: Real-Time Capacity Heatmaps for Multi-Room Events (Issue #3239)
--
-- Tracks localized room occupancy for multi-room events (e.g. Career Fairs),
-- streams realtime occupancy updates to organizer heatmap UI, and enables
-- door volunteers to toggle Check-In/Check-Out or manually calibrate headcount.
-- ============================================================

-- ── Step 1: Create event_rooms table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 100 CHECK (max_capacity > 0),
    current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
    svg_polygon_coords TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast room lookups by event
CREATE INDEX IF NOT EXISTS idx_event_rooms_event_id
    ON public.event_rooms (event_id);

-- Enable RLS
ALTER TABLE public.event_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public can view event room occupancy." ON public.event_rooms;
CREATE POLICY "Public can view event room occupancy."
ON public.event_rooms FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can update room occupancy." ON public.event_rooms;
CREATE POLICY "Authenticated users can update room occupancy."
ON public.event_rooms FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full control on event_rooms." ON public.event_rooms;
CREATE POLICY "Service role has full control on event_rooms."
ON public.event_rooms FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ── Step 2: Enable Supabase Realtime for event_rooms ──────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rooms;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add event_rooms to supabase_realtime publication: %', SQLERRM;
END $$;

-- ── Step 3: RPC to update room occupancy (Check-In +1 / Check-Out -1) ──
CREATE OR REPLACE FUNCTION public.update_room_occupancy(
    p_room_id UUID,
    p_delta INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room RECORD;
    v_new_occupancy INTEGER;
    v_warning BOOLEAN := FALSE;
BEGIN
    -- 1. Lock room record for transaction safety
    SELECT * INTO v_room
    FROM public.event_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Room not found.');
    END IF;

    -- 2. Calculate new occupancy (floor at 0)
    v_new_occupancy := GREATEST(0, v_room.current_occupancy + p_delta);

    -- 3. Check if room crossed 95% capacity warning threshold
    IF (v_new_occupancy::FLOAT / v_room.max_capacity::FLOAT) >= 0.95 THEN
        v_warning := TRUE;
    END IF;

    -- 4. Update room record
    UPDATE public.event_rooms
    SET current_occupancy = v_new_occupancy,
        updated_at = NOW()
    WHERE id = p_room_id;

    RETURN jsonb_build_object(
        'success', true,
        'room_id', p_room_id,
        'room_name', v_room.room_name,
        'current_occupancy', v_new_occupancy,
        'max_capacity', v_room.max_capacity,
        'capacity_warning', v_warning
    );
END;
$$;

-- ── Step 4: RPC to manually reset/calibrate room headcount ───
CREATE OR REPLACE FUNCTION public.calibrate_room_occupancy(
    p_room_id UUID,
    p_manual_count INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room RECORD;
    v_calibrated INTEGER;
    v_warning BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_room
    FROM public.event_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Room not found.');
    END IF;

    v_calibrated := GREATEST(0, p_manual_count);

    IF (v_calibrated::FLOAT / v_room.max_capacity::FLOAT) >= 0.95 THEN
        v_warning := TRUE;
    END IF;

    UPDATE public.event_rooms
    SET current_occupancy = v_calibrated,
        updated_at = NOW()
    WHERE id = p_room_id;

    RETURN jsonb_build_object(
        'success', true,
        'room_id', p_room_id,
        'room_name', v_room.room_name,
        'current_occupancy', v_calibrated,
        'max_capacity', v_room.max_capacity,
        'calibrated', true,
        'capacity_warning', v_warning
    );
END;
$$;

COMMENT ON TABLE public.event_rooms IS
'Stores room-level capacity, real-time occupancy, and SVG polygon coordinates for multi-room event heatmaps.';

COMMENT ON FUNCTION public.update_room_occupancy(UUID, INTEGER) IS
'Increments (+1 check-in) or decrements (-1 check-out) room occupancy atomically.';

COMMENT ON FUNCTION public.calibrate_room_occupancy(UUID, INTEGER) IS
'Manually resets/calibrates actual room headcount to fix drift when attendees leave without checking out.';
