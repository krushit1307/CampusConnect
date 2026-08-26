-- Test suite: Event RSVP Lottery Raffle Test
BEGIN;
SELECT plan(10);

-- 1. Setup mock events, clubs, users
INSERT INTO public.clubs (id, name, slug, description, visibility, is_private)
VALUES ('c_lottery_1', 'Lottery Club', 'lottery-club', 'desc', 'public', false);

INSERT INTO public.events (id, title, description, start_date, created_by, club_id, is_lottery, lottery_draw_time, max_attendees)
VALUES 
    ('e_lottery_ok', 'Concert Raffle', 'Mega Concert', NOW() + INTERVAL '2 days', '00000000-0000-0000-0000-000000000000', 'c_lottery_1', true, NOW() + INTERVAL '1 day', 2),
    ('e_lottery_past', 'Past Raffle', 'Mega Concert 2', NOW() - INTERVAL '2 days', '00000000-0000-0000-0000-000000000000', 'c_lottery_1', true, NOW() - INTERVAL '1 day', 5),
    ('e_lottery_normal', 'Normal Event', 'Simple Meetup', NOW() + INTERVAL '2 days', '00000000-0000-0000-0000-000000000000', 'c_lottery_1', false, NULL, 10);

-- Add active users
INSERT INTO auth.users (id, email)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'student1@connect.edu'),
    ('22222222-2222-2222-2222-222222222222', 'student2@connect.edu'),
    ('33333333-3333-3333-3333-333333333333', 'student3@connect.edu');

-- Verify columns exist
SELECT has_column('public', 'events', 'is_lottery', 'events table should have is_lottery column');
SELECT has_column('public', 'events', 'lottery_draw_time', 'events table should have lottery_draw_time column');

-- Test 1: Enter lottery successfully
SELECT results_eq(
    $$ SELECT public.enter_event_lottery('e_lottery_ok', '11111111-1111-1111-1111-111111111111')->>'success' $$,
    $$ VALUES ('true') $$,
    'Attendee should successfully enter the ticket lottery'
);

-- Test 2: Fail to enter if event is not a lottery
SELECT results_eq(
    $$ SELECT public.enter_event_lottery('e_lottery_normal', '11111111-1111-1111-1111-111111111111')->>'error' $$,
    $$ VALUES ('This event is not a lottery event') $$,
    'Should block entry if event is not designated as lottery'
);

-- Test 3: Fail to enter if lottery draw window closed
SELECT results_eq(
    $$ SELECT public.enter_event_lottery('e_lottery_past', '11111111-1111-1111-1111-111111111111')->>'error' $$,
    $$ VALUES ('The lottery entry window has closed') $$,
    'Should block entry if draw window has elapsed'
);

-- Register rest of users
SELECT public.enter_event_lottery('e_lottery_ok', '22222222-2222-2222-2222-222222222222');
SELECT public.enter_event_lottery('e_lottery_ok', '33333333-3333-3333-3333-333333333333');

-- Test 4: Verify entries count is registered
SELECT results_eq(
    $$ SELECT COUNT(*)::INT FROM public.ticket_lottery_entries WHERE event_id = 'e_lottery_ok' $$,
    $$ VALUES (3) $$,
    'All three users should have registered entries in the ticket_lottery_entries table'
);

-- Test 5: Execute random draw
SELECT results_eq(
    $$ SELECT public.draw_event_lottery_winners('e_lottery_ok')->>'success' $$,
    $$ VALUES ('true') $$,
    'Should execute draw successfully'
);

-- Test 6: Winners limit corresponds to max_attendees
SELECT results_eq(
    $$ SELECT COUNT(*)::INT FROM public.event_rsvps WHERE event_id = 'e_lottery_ok' AND status = 'attending' $$,
    $$ VALUES (2) $$,
    'Number of drawn winners should be capped at max_attendees (2)'
);

-- Test 7: Entry cleanup after draw
SELECT results_eq(
    $$ SELECT COUNT(*)::INT FROM public.ticket_lottery_entries WHERE event_id = 'e_lottery_ok' $$,
    $$ VALUES (0) $$,
    'Entries must be purged once drawing finishes'
);

SELECT * FROM finish();
ROLLBACK;
