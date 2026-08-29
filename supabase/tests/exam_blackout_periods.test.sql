BEGIN;
SELECT plan(6);

-- Setup: Create admin and student users
INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.com'),
    ('22222222-2222-2222-2222-222222222222', 'student@test.com');

INSERT INTO public.profiles (id, full_name, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Admin User', 'system_admin'),
    ('22222222-2222-2222-2222-222222222222', 'Student User', 'student');

-- Create a test club
INSERT INTO public.clubs (id, name, slug, created_by) VALUES
    ('33333333-3333-3333-3333-333333333333', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111');

-- Create a blackout period (e.g. tomorrow until next week)
INSERT INTO public.exam_blackout_periods (start_time, end_time, reason)
VALUES (NOW() + interval '1 day', NOW() + interval '7 days', 'Final Exams');

-- Test 1: Outside blackout period (allowed)
SELECT lives_ok(
    $$ INSERT INTO public.events (title, club_id, created_by, event_date) 
       VALUES ('Normal Event', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', NOW() + interval '10 days') $$,
    'Should allow event outside blackout period'
);

-- Test 2: Inside blackout period, non-admin (blocked)
SELECT throws_ok(
    $$ INSERT INTO public.events (title, club_id, created_by, event_date) 
       VALUES ('Party', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', NOW() + interval '2 days') $$,
    'Cannot create social events during exam blackout periods.',
    'Should block student creating event in blackout period'
);

-- Test 3: Inside blackout period, admin but not study break (blocked)
SELECT throws_ok(
    $$ INSERT INTO public.events (title, club_id, created_by, event_date) 
       VALUES ('Admin Party', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', NOW() + interval '2 days') $$,
    'Cannot create social events during exam blackout periods.',
    'Should block admin creating social event in blackout period'
);

-- Test 4: Inside blackout period, admin AND study break (allowed)
SELECT lives_ok(
    $$ INSERT INTO public.events (title, club_id, created_by, event_date) 
       VALUES ('CS101 Study Break', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', NOW() + interval '2 days') $$,
    'Should allow admin creating study break in blackout period'
);

-- Test 5: Update event to be inside blackout period, non-admin (blocked)
SELECT throws_ok(
    $$ UPDATE public.events SET event_date = NOW() + interval '2 days' WHERE title = 'Normal Event' AND created_by = '22222222-2222-2222-2222-222222222222' $$,
    'Cannot create social events during exam blackout periods.',
    'Should block updating event to fall in blackout period'
);

-- Test 6: Student creating Study Break (blocked)
SELECT throws_ok(
    $$ INSERT INTO public.events (title, club_id, created_by, event_date) 
       VALUES ('Student Study Break', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', NOW() + interval '2 days') $$,
    'Cannot create social events during exam blackout periods.',
    'Should block student creating study break in blackout period'
);

SELECT * FROM finish();
ROLLBACK;

