-- 1. Add overflow_venues configuration JSONB array to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS overflow_venues JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Add venue tier tracking fields to rsvps table
ALTER TABLE rsvps
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'MAIN' NOT NULL CHECK (tier IN ('MAIN', 'OVERFLOW')),
ADD COLUMN IF NOT EXISTS assigned_venue_name TEXT DEFAULT 'Main Auditorium' NOT NULL;

-- 3. Create atomic RSVP function that cascades into overflow tiers when main capacity is full
CREATE OR REPLACE FUNCTION reserve_event_ticket_with_overflow(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_primary_capacity INT;
    v_primary_venue_name TEXT;
    v_overflow_venues JSONB;
    v_main_count INT;
    v_overflow_item JSONB;
    v_overflow_venue_name TEXT;
    v_overflow_capacity INT;
    v_overflow_count INT;
    v_new_rsvp_id UUID;
    v_assigned_tier TEXT := 'MAIN';
    v_assigned_venue TEXT;
BEGIN
    -- Lock event row for atomic capacity evaluation
    SELECT capacity, venue_name, overflow_venues 
    INTO v_primary_capacity, v_primary_venue_name, v_overflow_venues
    FROM events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found.';
    END IF;

    -- Count active RSVPs in MAIN tier
    SELECT COUNT(*) INTO v_main_count
    FROM rsvps
    WHERE event_id = p_event_id AND tier = 'MAIN' AND status != 'declined';

    -- Check if Main Venue has space
    IF v_main_count < v_primary_capacity THEN
        v_assigned_tier := 'MAIN';
        v_assigned_venue := v_primary_venue_name;
    ELSE
        -- Main venue is full; check overflow venues array
        IF jsonb_array_length(v_overflow_venues) = 0 THEN
            RAISE EXCEPTION 'Event is completely sold out.';
        END IF;

        -- Iterate through overflow venues
        FOR v_overflow_item IN SELECT * FROM jsonb_array_elements(v_overflow_venues)
        LOOP
            v_overflow_venue_name := v_overflow_item->>'venueName';
            v_overflow_capacity := (v_overflow_item->>'capacity')::INT;

            SELECT COUNT(*) INTO v_overflow_count
            FROM rsvps
            WHERE event_id = p_event_id 
              AND tier = 'OVERFLOW' 
              AND assigned_venue_name = v_overflow_venue_name
              AND status != 'declined';

            IF v_overflow_count < v_overflow_capacity THEN
                v_assigned_tier := 'OVERFLOW';
                v_assigned_venue := v_overflow_venue_name;
                EXIT;
            END IF;
        END LOOP;

        IF v_assigned_venue IS NULL THEN
            RAISE EXCEPTION 'Main room and all overflow rooms are at maximum capacity.';
        END IF;
    END IF;

    -- Insert RSVP record
    INSERT INTO rsvps (event_id, user_id, tier, assigned_venue_name, status)
    VALUES (p_event_id, p_user_id, v_assigned_tier, v_assigned_venue, 'attending')
    RETURNING id INTO v_new_rsvp_id;

    RETURN jsonb_build_object(
        'rsvpId', v_new_rsvp_id,
        'eventId', p_event_id,
        'userId', p_user_id,
        'tier', v_assigned_tier,
        'assignedVenueName', v_assigned_venue
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;