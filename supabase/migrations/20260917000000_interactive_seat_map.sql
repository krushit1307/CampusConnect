-- Migration: 20260917000000_interactive_seat_map.sql
-- Description: Issue #3873 - Build an 'Interactive Seat Map' for Large Auditoriums

-- 1. Add seat_map JSONB to public.events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS seat_map JSONB DEFAULT '{
  "rows": 8,
  "cols": 12,
  "vip_rows": ["A", "B"],
  "aisle_cols": [4, 8]
}'::jsonb;

-- 2. Add seat_id and seat_label to public.event_rsvps
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS seat_id TEXT,
ADD COLUMN IF NOT EXISTS seat_label TEXT;

-- 3. Create public.event_seats table for seat locking & reservation tracking
CREATE TABLE IF NOT EXISTS public.event_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    seat_id TEXT NOT NULL, -- e.g. 'Row-B-Seat-14'
    seat_label TEXT NOT NULL, -- e.g. 'Row B, Seat 14'
    section TEXT NOT NULL DEFAULT 'General', -- 'VIP' | 'Balcony' | 'General'
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE' | 'LOCKED' | 'RESERVED'
    reserved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE SET NULL,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_event_seat UNIQUE (event_id, seat_id)
);

-- Index for querying seat statuses by event
CREATE INDEX IF NOT EXISTS idx_event_seats_event ON public.event_seats (event_id, status);

-- Enable RLS
ALTER TABLE public.event_seats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Event seats readable by authenticated users" ON public.event_seats;
CREATE POLICY "Event seats readable by authenticated users"
    ON public.event_seats FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Event seats manageable by authenticated users" ON public.event_seats;
CREATE POLICY "Event seats manageable by authenticated users"
    ON public.event_seats FOR ALL TO authenticated USING (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_seats;

-- 4. Create lock_event_seat RPC function to prevent double-booking
CREATE OR REPLACE FUNCTION public.lock_event_seat(
    p_event_id UUID,
    p_seat_id TEXT,
    p_seat_label TEXT,
    p_section TEXT,
    p_user_id UUID,
    p_lock_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_seat RECORD;
    v_lock_until TIMESTAMPTZ;
BEGIN
    v_lock_until := NOW() + (p_lock_minutes || ' minutes')::INTERVAL;

    -- Query existing seat reservation
    SELECT * INTO v_existing_seat
    FROM public.event_seats
    WHERE event_id = p_event_id AND seat_id = p_seat_id;

    IF v_existing_seat.id IS NOT NULL THEN
        -- Check if seat is reserved or locked by another user
        IF v_existing_seat.status = 'RESERVED' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Seat is already reserved');
        END IF;

        IF v_existing_seat.status = 'LOCKED' AND v_existing_seat.reserved_by_user_id != p_user_id AND v_existing_seat.locked_until > NOW() THEN
            RETURN jsonb_build_object('success', false, 'error', 'Seat is currently locked by another attendee during checkout');
        END IF;

        -- Update lock state
        UPDATE public.event_seats
        SET status = 'LOCKED',
            reserved_by_user_id = p_user_id,
            locked_until = v_lock_until,
            updated_at = NOW()
        WHERE id = v_existing_seat.id;
    ELSE
        -- Insert new lock record
        INSERT INTO public.event_seats (
            event_id,
            seat_id,
            seat_label,
            section,
            status,
            reserved_by_user_id,
            locked_until,
            created_at
        ) VALUES (
            p_event_id,
            p_seat_id,
            p_seat_label,
            p_section,
            'LOCKED',
            p_user_id,
            v_lock_until,
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'seat_id', p_seat_id,
        'seat_label', p_seat_label,
        'status', 'LOCKED',
        'locked_until', v_lock_until
    );
END;
$$;

-- 5. Create confirm_seat_reservation RPC function
CREATE OR REPLACE FUNCTION public.confirm_seat_reservation(
    p_event_id UUID,
    p_seat_id TEXT,
    p_seat_label TEXT,
    p_user_id UUID,
    p_rsvp_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update event_seats record to RESERVED
    UPDATE public.event_seats
    SET status = 'RESERVED',
        rsvp_id = p_rsvp_id,
        reserved_by_user_id = p_user_id,
        locked_until = NULL,
        updated_at = NOW()
    WHERE event_id = p_event_id AND seat_id = p_seat_id;

    -- Update event_rsvps record with seat details
    UPDATE public.event_rsvps
    SET seat_id = p_seat_id,
        seat_label = p_seat_label,
        updated_at = NOW()
    WHERE id = p_rsvp_id;

    RETURN jsonb_build_object(
        'success', true,
        'rsvp_id', p_rsvp_id,
        'seat_id', p_seat_id,
        'seat_label', p_seat_label,
        'status', 'RESERVED'
    );
END;
$$;
