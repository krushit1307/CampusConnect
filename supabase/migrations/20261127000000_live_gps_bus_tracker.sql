-- Migration: 20261127000000_live_gps_bus_tracker.sql
-- Description: Issue #3437 - Live GPS Bus Tracker for Multi-Campus Events
-- Adds bus_tracker_active, bus_latitude, bus_longitude, bus_captain_id, and bus_last_updated to events.

-- 1. Add Bus Tracker columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS bus_tracker_active BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS bus_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS bus_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS bus_captain_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bus_last_updated TIMESTAMPTZ;

-- 2. Create RPC function to update/broadcast bus location
CREATE OR REPLACE FUNCTION public.update_bus_location(
    p_event_id UUID,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
BEGIN
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Event not found');
    END IF;

    -- Verify caller is the designated captain or creator of the event
    IF v_event.bus_captain_id IS NULL THEN
        -- If no captain is designated, let the first location broadcast claim captaincy
        UPDATE public.events
        SET bus_captain_id = auth.uid()
        WHERE id = p_event_id;
    ELSIF v_event.bus_captain_id != auth.uid() AND v_event.created_by != auth.uid() THEN
        RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Only the designated Bus Captain can broadcast coordinates');
    END IF;

    UPDATE public.events
    SET 
        bus_latitude = p_latitude,
        bus_longitude = p_longitude,
        bus_last_updated = NOW(),
        bus_tracker_active = TRUE
    WHERE id = p_event_id;

    RETURN JSONB_BUILD_OBJECT('success', TRUE);
END;
$$;

-- 3. Create RPC function to terminate bus tracker broadcast
CREATE OR REPLACE FUNCTION public.terminate_bus_tracker(
    p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
BEGIN
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Event not found');
    END IF;

    IF v_event.bus_captain_id != auth.uid() AND v_event.created_by != auth.uid() THEN
        RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Unauthorized to terminate bus tracking');
    END IF;

    UPDATE public.events
    SET 
        bus_tracker_active = FALSE,
        bus_latitude = NULL,
        bus_longitude = NULL,
        bus_last_updated = NOW()
    WHERE id = p_event_id;

    RETURN JSONB_BUILD_OBJECT('success', TRUE);
END;
$$;
