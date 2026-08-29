CREATE OR REPLACE FUNCTION public.predict_waitlist_success(p_event_id UUID, p_user_waitlist_position INT)
RETURNS TABLE (
    expected_churn INT,
    probability_percentage FLOAT,
    message VARCHAR
) AS $$
DECLARE
    v_category_id UUID;
    v_max_attendees INT;
    v_total_rsvps INT := 0;
    v_total_cancelled INT := 0;
    v_churn_rate FLOAT := 0.0;
    v_expected_churn INT := 0;
    v_probability FLOAT := 0.0;
    v_message VARCHAR;
BEGIN
    -- 1. Retrieve the target event's category_id and max_attendees
    SELECT category_id, max_attendees
    INTO v_category_id, v_max_attendees
    FROM public.events
    WHERE id = p_event_id;

    -- If there is no capacity limit, then the waitlist position is effectively guaranteed if they open more spots, 
    -- but usually waitlists imply a capacity limit.
    IF v_max_attendees IS NULL OR v_max_attendees <= 0 THEN
        RETURN QUERY SELECT 
            0::INT, 
            99.0::FLOAT, 
            'High Chance (99%). No capacity limit detected.'::VARCHAR;
        RETURN;
    END IF;

    -- 2. Aggregate historical data over the last 12 months for events matching the category_id
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END)
    INTO v_total_rsvps, v_total_cancelled
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    WHERE e.category_id = v_category_id
      AND e.event_date >= NOW() - INTERVAL '12 months'
      AND e.event_date < NOW()
      AND r.status IN ('going', 'cancelled', 'attended', 'checked_in'); -- Consider those who had a ticket

    -- 3. Calculate historical churn rate
    IF v_total_rsvps > 0 THEN
        v_churn_rate := v_total_cancelled::FLOAT / v_total_rsvps::FLOAT;
    ELSE
        -- Default to a conservative 10% churn if no historical data exists
        v_churn_rate := 0.10;
    END IF;

    -- 4. Compute expected churn
    v_expected_churn := ROUND(v_churn_rate * v_max_attendees);

    -- 5. Calculate probability percentage based on position relative to expected churn
    IF v_expected_churn = 0 THEN
        v_probability := 5.0;
        v_message := 'Low Chance (5%). You may want to make other plans.';
    ELSIF p_user_waitlist_position <= v_expected_churn THEN
        -- High chance, scales from 99% down to ~75%
        v_probability := 100.0 - ((p_user_waitlist_position::FLOAT / v_expected_churn::FLOAT) * 25.0);
        v_message := 'High Chance (' || ROUND(v_probability) || '%) of getting a ticket!';
    ELSE
        -- Low chance, decays as position gets further from expected churn
        v_probability := (v_expected_churn::FLOAT / p_user_waitlist_position::FLOAT) * 35.0;
        IF v_probability < 1.0 THEN
            v_probability := 1.0;
        END IF;
        
        IF v_probability >= 20.0 THEN
            v_message := 'Moderate Chance (' || ROUND(v_probability) || '%). Keep an eye out.';
        ELSE
            v_message := 'Low Chance (' || ROUND(v_probability) || '%). You may want to make other plans.';
        END IF;
    END IF;

    -- 6. Return the structured object
    RETURN QUERY SELECT 
        v_expected_churn::INT, 
        ROUND(v_probability::NUMERIC, 1)::FLOAT, 
        v_message::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
