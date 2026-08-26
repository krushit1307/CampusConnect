BEGIN;

-- We can use pgTAP for SQL testing if available, or just assert manually.
-- For simplicity, we just run the queries to ensure they compile and work.

CREATE OR REPLACE FUNCTION test_search_ranking() RETURNS void AS $$
DECLARE
    event_a_id uuid;
    event_b_id uuid;
    result_id uuid;
BEGIN
    -- Insert mock data
    INSERT INTO public.events (title, description, event_date)
    VALUES ('React Workshop', 'Learn code', NOW()) RETURNING id INTO event_a_id;

    INSERT INTO public.events (title, description, event_date)
    VALUES ('Tech Meeting', 'We will discuss the React Workshop and other things.', NOW()) RETURNING id INTO event_b_id;

    -- Test 1: Title match should rank higher than description match
    -- Searching for "React Workshop"
    -- Event A has it in the title (Weight A), Event B has it in the description (Weight C).
    
    SELECT id INTO result_id
    FROM public.search_events('React Workshop')
    LIMIT 1;

    IF result_id != event_a_id THEN
        RAISE EXCEPTION 'Search ranking failed: Event A (title match) should be ranked higher than Event B (description match).';
    END IF;

    -- Clean up
    DELETE FROM public.events WHERE id IN (event_a_id, event_b_id);
END;
$$ LANGUAGE plpgsql;

SELECT test_search_ranking();
DROP FUNCTION test_search_ranking();

ROLLBACK;
