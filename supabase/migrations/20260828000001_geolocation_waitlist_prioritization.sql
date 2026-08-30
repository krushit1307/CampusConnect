-- ============================================================
-- Migration: 20260828000001_geolocation_waitlist_prioritization.sql
-- Issue: #4679 - Automated "Waitlist Promotion" Geographic Prioritization
-- Description: 
--   1. Adds location tracking fields to profiles table
--   2. Adds location fields to event_venues table
--   3. Creates geolocation-based waitlist promotion function
--   4. Updates promotion trigger to use spatial sorting for imminent events (< 60 minutes)
-- ============================================================

SET lock_timeout = '3s';

-- 1. Add location tracking fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_location_updated_at IS 
'Timestamp of when user''s GPS location was last updated';

-- 2. Add location fields to event_venues table
ALTER TABLE public.event_venues
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add constraints for venue coordinates
ALTER TABLE public.event_venues
ADD CONSTRAINT event_venues_latitude_valid
CHECK (
    latitude IS NULL OR
    (latitude >= -90 AND latitude <= 90)
);

ALTER TABLE public.event_venues
ADD CONSTRAINT event_venues_longitude_valid
CHECK (
    longitude IS NULL OR
    (longitude >= -180 AND longitude <= 180)
);

COMMENT ON COLUMN public.event_venues.latitude IS 'Venue latitude coordinate';
COMMENT ON COLUMN public.event_venues.longitude IS 'Venue longitude coordinate';

-- 3. Create function to get event venue coordinates
CREATE OR REPLACE FUNCTION public.get_event_coordinates(p_event_id UUID)
RETURNS TABLE(latitude DOUBLE PRECISION, longitude DOUBLE PRECISION)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Try to get coordinates from event_venues first
    RETURN QUERY
    SELECT ev.latitude, ev.longitude
    FROM public.event_venues ev
    WHERE ev.event_id = p_event_id
    LIMIT 1;
    
    -- If no venue coordinates, fall back to events table
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT e.latitude, e.longitude
        FROM public.events e
        WHERE e.id = p_event_id
        LIMIT 1;
    END IF;
END;
$$;

-- 4. Create geolocation-based waitlist promotion function
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee_geographic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
    event_start_time TIMESTAMPTZ;
    venue_coords RECORD;
    time_until_event INTERVAL;
    use_geographic_sorting BOOLEAN := FALSE;
    top_candidates RECORD[];
    i INTEGER;
BEGIN
    -- Get event start time
    SELECT start_date INTO event_start_time
    FROM public.events
    WHERE id = OLD.event_id;
    
    -- Calculate time until event
    time_until_event := event_start_time - NOW();
    
    -- Activate spatial sorting if event is less than 60 minutes away
    IF time_until_event < INTERVAL '60 minutes' AND time_until_event > INTERVAL '0 minutes' THEN
        use_geographic_sorting := TRUE;
    END IF;
    
    IF use_geographic_sorting THEN
        -- Get venue coordinates
        SELECT * INTO venue_coords
        FROM public.get_event_coordinates(OLD.event_id)
        LIMIT 1;
        
        IF venue_coords.latitude IS NOT NULL AND venue_coords.longitude IS NOT NULL THEN
            -- Get top 10 waitlisted users with recent location data
            FOR i IN 1..10 LOOP
                SELECT id, event_id, user_id INTO next_waitlist_record
                FROM (
                    SELECT 
                        ew.id,
                        ew.event_id,
                        ew.user_id,
                        public.haversine_distance(
                            p.latitude,
                            p.longitude,
                            venue_coords.latitude,
                            venue_coords.longitude
                        ) AS distance_km
                    FROM public.event_waitlist ew
                    JOIN public.profiles p ON ew.user_id = p.id
                    WHERE ew.event_id = OLD.event_id
                      AND p.latitude IS NOT NULL
                      AND p.longitude IS NOT NULL
                      AND p.last_location_updated_at > NOW() - INTERVAL '24 hours'
                    ORDER BY distance_km ASC, ew.created_at ASC
                    LIMIT 10
                ) ranked_waitlist
                ORDER BY distance_km ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED;
                
                EXIT WHEN FOUND;
            END LOOP;
        END IF;
    END IF;
    
    -- Fall back to temporal sorting if geographic sorting not used or no candidates found
    IF NOT FOUND THEN
        SELECT id, event_id, user_id INTO next_waitlist_record
        FROM public.event_waitlist
        WHERE event_id = OLD.event_id
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;
    
    -- If a waitlisted student exists, promote them to active RSVP and remove from waitlist
    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

-- 5. Update trigger to use new geolocation-based function
DROP TRIGGER IF EXISTS tr_promote_waitlist_on_rsvp_cancel ON public.event_rsvps;

CREATE TRIGGER tr_promote_waitlist_on_rsvp_cancel
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_attendee_geographic();

-- 6. Create RPC to request GPS ping from mobile apps (for top waitlisted users)
CREATE OR REPLACE FUNCTION public.request_gps_ping_for_waitlist(p_event_id UUID)
RETURNS TABLE(user_id UUID, needs_location_update BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_start_time TIMESTAMPTZ;
    time_until_event INTERVAL;
BEGIN
    -- Get event start time
    SELECT start_date INTO event_start_time
    FROM public.events
    WHERE id = p_event_id;
    
    -- Calculate time until event
    time_until_event := event_start_time - NOW();
    
    -- Only request GPS pings if event is less than 60 minutes away
    IF time_until_event >= INTERVAL '60 minutes' OR time_until_event <= INTERVAL '0 minutes' THEN
        RETURN QUERY
        SELECT ew.user_id::UUID, FALSE::BOOLEAN
        FROM public.event_waitlist ew
        WHERE ew.event_id = p_event_id
        LIMIT 0;
        RETURN;
    END IF;
    
    -- Return top 10 waitlisted users who need location updates
    -- (location not set or not updated in last 24 hours)
    RETURN QUERY
    SELECT 
        ew.user_id::UUID,
        (p.latitude IS NULL OR 
         p.longitude IS NULL OR 
         p.last_location_updated_at IS NULL OR
         p.last_location_updated_at < NOW() - INTERVAL '24 hours')::BOOLEAN AS needs_location_update
    FROM public.event_waitlist ew
    JOIN public.profiles p ON ew.user_id = p.id
    WHERE ew.event_id = p_event_id
    ORDER BY ew.created_at ASC
    LIMIT 10;
END;
$$;

-- 7. Create RPC for users to update their location
CREATE OR REPLACE FUNCTION public.update_user_location(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate coordinates
    IF p_latitude < -90 OR p_latitude > 90 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid latitude. Must be between -90 and 90.'
        );
    END IF;
    
    IF p_longitude < -180 OR p_longitude > 180 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid longitude. Must be between -180 and 180.'
        );
    END IF;
    
    -- Update user's location
    UPDATE public.profiles
    SET 
        latitude = p_latitude,
        longitude = p_longitude,
        last_location_updated_at = NOW()
    WHERE id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User profile not found.'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Location updated successfully.'
    );
END;
$$;

-- 8. Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.get_event_coordinates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_gps_ping_for_waitlist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_location(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
