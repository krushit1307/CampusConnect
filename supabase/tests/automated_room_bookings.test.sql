-- ============================================================
-- Test Suite: automated_room_bookings.test.sql
-- Description: Verifies automated room booking request columns, triggers, and status constraints.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(12);

-- 1. Check Columns exist
SELECT has_column('public', 'venues', 'facility_manager_email', 'venues table should have facility_manager_email column');
SELECT has_column('public', 'venues', 'is_off_campus', 'venues table should have is_off_campus column');
SELECT has_column('public', 'events', 'av_requirements', 'events table should have av_requirements column');

SELECT has_table('public', 'room_booking_requests', 'room_booking_requests table should exist');
SELECT has_column('public', 'room_booking_requests', 'event_id', 'room_booking_requests should have event_id');
SELECT has_column('public', 'room_booking_requests', 'club_id', 'room_booking_requests should have club_id');
SELECT has_column('public', 'room_booking_requests', 'venue_id', 'room_booking_requests should have venue_id');
SELECT has_column('public', 'room_booking_requests', 'token', 'room_booking_requests should have token');
SELECT has_column('public', 'room_booking_requests', 'status', 'room_booking_requests should have status');

-- 2. Setup mock data
INSERT INTO public.profiles (id, full_name, role)
VALUES ('22222222-2222-2222-2222-2222222222aa', 'Room Request Organizer', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('22222222-2222-2222-2222-2222222222bb', 'Room Tech Club', 'room-tech-club')
ON CONFLICT (id) DO NOTHING;

-- Official Campus Venue
INSERT INTO public.venues (id, name, building, capacity, facility_manager_email, is_off_campus)
VALUES (
    '22222222-2222-2222-2222-2222222222cc', 
    'Campus Auditorium', 
    'Main Building', 
    500, 
    'manager@campus.edu', 
    false
)
ON CONFLICT (id) DO NOTHING;

-- External Venue
INSERT INTO public.venues (id, name, building, capacity, facility_manager_email, is_off_campus)
VALUES (
    '22222222-2222-2222-2222-2222222222dd', 
    'Off-Campus Restaurant', 
    'Downtown', 
    100, 
    'manager@restaurant.com', 
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Verify triggers and event status changes
-- Test A: Creating an event with a campus venue forces status to pending_facility_approval
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, venue_id, status)
VALUES (
    '22222222-2222-2222-2222-2222222222ee', 
    '22222222-2222-2222-2222-2222222222bb', 
    'Campus Event Needs Booking Approval', 
    100, 
    100, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    '22222222-2222-2222-2222-2222222222cc',
    'scheduled'
);

SELECT results_eq(
    $$ SELECT status FROM public.events WHERE id = '22222222-2222-2222-2222-2222222222ee' $$,
    $$ VALUES ('pending_facility_approval'::text) $$,
    'Trigger should force event status to pending_facility_approval for campus venue'
);

-- Test B: Creating an event with an off-campus venue leaves status unchanged
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, venue_id, status)
VALUES (
    '22222222-2222-2222-2222-2222222222ff', 
    '22222222-2222-2222-2222-2222222222bb', 
    'Off-Campus Dining Meetup', 
    50, 
    50, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    '22222222-2222-2222-2222-2222222222dd',
    'scheduled'
);

SELECT results_eq(
    $$ SELECT status FROM public.events WHERE id = '22222222-2222-2222-2222-2222222222ff' $$,
    $$ VALUES ('scheduled'::text) $$,
    'Trigger should NOT modify event status for off-campus venues'
);

-- Test C: Re-saving/updating status of campus venue event to published is NOT reset back to pending_facility_approval
UPDATE public.events
SET status = 'published'
WHERE id = '22222222-2222-2222-2222-2222222222ee';

SELECT results_eq(
    $$ SELECT status FROM public.events WHERE id = '22222222-2222-2222-2222-2222222222ee' $$,
    $$ VALUES ('published'::text) $$,
    'Trigger should allow changing status to published without overriding it back to pending if venue did not change'
);

ROLLBACK;
