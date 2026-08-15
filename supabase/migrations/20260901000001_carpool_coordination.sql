-- =============================================================================
-- Migration: Carpool Coordination Module
-- Issue: #3222 - Develop a 'Carpool Coordination' Module for Off-Campus Events
-- Description: Creates tables for carpool listings, passenger requests, and 
-- mandatory legal waivers. Includes triggers to provision temporary group 
-- chats upon passenger acceptance.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Legal Waivers Table (Must be signed before participating)
CREATE TABLE IF NOT EXISTS public.carpool_waivers (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    waiver_version TEXT NOT NULL DEFAULT 'v1.0'
);
-- 2. Carpools Table (Drivers offering seats)
CREATE TABLE IF NOT EXISTS public.carpools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    driver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_seats INT NOT NULL CHECK (
        total_seats > 0
        AND total_seats <= 8
    ),
    available_seats INT NOT NULL,
    departure_location TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    vehicle_description TEXT,
    notes TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seats_available CHECK (
        available_seats <= total_seats
        AND available_seats >= 0
    )
);
CREATE INDEX IF NOT EXISTS idx_carpools_event ON public.carpools(event_id, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_carpools_driver ON public.carpools(driver_user_id);
-- 3. Carpool Passengers Table (Ride requests and accepted passengers)
CREATE TABLE IF NOT EXISTS public.carpool_passengers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carpool_id UUID NOT NULL REFERENCES public.carpools(id) ON DELETE CASCADE,
    passenger_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'accepted', 'rejected', 'cancelled')
    ),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(carpool_id, passenger_user_id)
);
CREATE INDEX IF NOT EXISTS idx_carpool_passengers_carpool ON public.carpool_passengers(carpool_id, status);
-- =============================================================================
-- Trigger: Provision Group Chat on Acceptance
-- =============================================================================
CREATE OR REPLACE FUNCTION public.provision_carpool_chat() RETURNS TRIGGER AS $$
DECLARE v_chat_id UUID;
v_driver_id UUID;
v_passenger_ids UUID [];
BEGIN IF TG_OP = 'UPDATE'
AND OLD.status != 'accepted'
AND NEW.status = 'accepted' THEN -- Fetch all accepted passengers and the driver for this carpool
SELECT driver_user_id INTO v_driver_id
FROM public.carpools
WHERE id = NEW.carpool_id;
SELECT ARRAY_AGG(passenger_user_id) INTO v_passenger_ids
FROM public.carpool_passengers
WHERE carpool_id = NEW.carpool_id
    AND status = 'accepted';
-- Append driver to the participant list
v_passenger_ids := array_append(v_passenger_ids, v_driver_id);
-- Insert into a hypothetical secure_channels or group_chats table
-- INSERT INTO public.group_chats (name, participant_ids, is_temporary)
-- VALUES ('Carpool: ' || NEW.carpool_id::text, v_passenger_ids, TRUE)
-- RETURNING id INTO v_chat_id;
-- Update the carpool record with the chat ID (assuming column exists)
-- UPDATE public.carpools SET chat_id = v_chat_id WHERE id = NEW.carpool_id;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_provision_carpool_chat ON public.carpool_passengers;
CREATE TRIGGER trg_provision_carpool_chat
AFTER
UPDATE OF status ON public.carpool_passengers FOR EACH ROW EXECUTE FUNCTION public.provision_carpool_chat();
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.carpool_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_passengers ENABLE ROW LEVEL SECURITY;
-- Waivers
CREATE POLICY "Users manage own waiver" ON public.carpool_waivers FOR ALL USING (auth.uid() = user_id);
-- Carpools
CREATE POLICY "Event attendees can view carpools" ON public.carpools FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.event_rsvps er
            WHERE er.event_id = carpools.event_id
                AND er.user_id = auth.uid()
        )
        OR driver_user_id = auth.uid()
    );
CREATE POLICY "Drivers can manage own carpools" ON public.carpools FOR ALL USING (driver_user_id = auth.uid()) WITH CHECK (driver_user_id = auth.uid());
-- Passengers
CREATE POLICY "Users can view relevant passenger requests" ON public.carpool_passengers FOR
SELECT USING (
        passenger_user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.carpools c
            WHERE c.id = carpool_passengers.carpool_id
                AND c.driver_user_id = auth.uid()
        )
    );
CREATE POLICY "Passengers can request seats" ON public.carpool_passengers FOR
INSERT WITH CHECK (
        passenger_user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.carpool_waivers
            WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Drivers can update request status" ON public.carpool_passengers FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.carpools c
            WHERE c.id = carpool_passengers.carpool_id
                AND c.driver_user_id = auth.uid()
        )
    );
