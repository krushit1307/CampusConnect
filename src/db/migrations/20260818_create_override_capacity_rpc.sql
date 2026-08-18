CREATE OR REPLACE FUNCTION override_event_capacity(
    p_event_id UUID,
    p_new_capacity INT
) RETURNS json AS $$
DECLARE
    v_current_attendance INT;
    v_max_capacity INT;
    v_old_capacity INT;
    v_added_seats INT;
BEGIN
    -- Retrieve current event and venue stats
    SELECT e.capacity,
           (SELECT count(*) FROM event_attendees WHERE event_id = p_event_id AND status = 'checked_in'),
           v.max_combined_capacity
    INTO v_old_capacity, v_current_attendance, v_max_capacity
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    WHERE e.id = p_event_id;

    -- Edge Case 1: Prevent downscaling below current check-ins
    IF p_new_capacity < v_current_attendance THEN
        RAISE EXCEPTION 'Cannot reduce capacity below current attendance (%).', v_current_attendance;
    END IF;

    -- Edge Case 2: Fire code compliance
    IF p_new_capacity > v_max_capacity THEN
        RAISE EXCEPTION 'Capacity exceeds maximum fire code compliance of %.', v_max_capacity;
    END IF;

    -- Execute capacity override
    UPDATE events SET capacity = p_new_capacity WHERE id = p_event_id;

    v_added_seats := p_new_capacity - v_old_capacity;

    -- Return payload so the backend knows how many waitlist people to process
    RETURN json_build_object(
        'success', true,
        'old_capacity', v_old_capacity,
        'new_capacity', p_new_capacity,
        'added_seats', GREATEST(0, v_added_seats)
    );
END;
$$ LANGUAGE plpgsql;
