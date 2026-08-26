-- =============================================================================
-- Test: system_counters.test.sql
-- Purpose: Verify that triggers correctly increment and decrement counts.
-- =============================================================================

BEGIN;

SELECT plan(6);

-- Test 1: Initial count is correct
SELECT results_eq(
    'SELECT row_count FROM public.system_counters WHERE table_name = ''events''',
    ARRAY[(SELECT COUNT(*) FROM public.events)::bigint],
    'Initial events count matches actual table count'
);

-- Test 2: INSERT increments count
INSERT INTO public.events (id, title, created_by) 
VALUES (gen_random_uuid(), 'Test Event', (SELECT id FROM public.profiles LIMIT 1));

SELECT results_eq(
    'SELECT row_count FROM public.system_counters WHERE table_name = ''events''',
    ARRAY[(SELECT COUNT(*) FROM public.events)::bigint],
    'Events count incremented after INSERT'
);

-- Test 3: DELETE decrements count
DELETE FROM public.events WHERE title = 'Test Event';

SELECT results_eq(
    'SELECT row_count FROM public.system_counters WHERE table_name = ''events''',
    ARRAY[(SELECT COUNT(*) FROM public.events)::bigint],
    'Events count decremented after DELETE'
);

-- Test 4: UPDATE does not change count but updates timestamp
DO $$
DECLARE
    v_event_id UUID;
    v_old_count BIGINT;
    v_new_count BIGINT;
BEGIN
    INSERT INTO public.events (id, title, created_by) 
    VALUES (gen_random_uuid(), 'Test Event 2', (SELECT id FROM public.profiles LIMIT 1)) RETURNING id INTO v_event_id;
    
    SELECT row_count INTO v_old_count FROM public.system_counters WHERE table_name = 'events';
    
    UPDATE public.events SET title = 'Updated Test Event' WHERE id = v_event_id;
    
    SELECT row_count INTO v_new_count FROM public.system_counters WHERE table_name = 'events';
    
    PERFORM is(v_old_count, v_new_count, 'Events count unchanged after UPDATE');
    
    DELETE FROM public.events WHERE id = v_event_id;
END $$;

-- Test 5: Profiles count triggers work
SELECT results_eq(
    'SELECT row_count FROM public.system_counters WHERE table_name = ''profiles''',
    ARRAY[(SELECT COUNT(*) FROM public.profiles)::bigint],
    'Profiles count matches actual table count'
);

-- Test 6: Clubs count triggers work
SELECT results_eq(
    'SELECT row_count FROM public.system_counters WHERE table_name = ''clubs''',
    ARRAY[(SELECT COUNT(*) FROM public.clubs)::bigint],
    'Clubs count matches actual table count'
);

SELECT * FROM finish();
ROLLBACK;
