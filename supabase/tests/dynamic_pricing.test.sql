-- =============================================================================
-- Test: dynamic_pricing.test.sql
-- Purpose: Verify dynamic price calculations, surge multiplier thresholds,
--          and ticket capacity fallbacks.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- Test 1: Check new columns on events table
SELECT has_column('public', 'events', 'base_price', 'events table has base_price column');
SELECT has_column('public', 'events', 'surge_multiplier', 'events table has surge_multiplier column');

-- Setup test data
-- 1. Profile
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Test Organizer', 'student')
ON CONFLICT (id) DO NOTHING;

-- 2. Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 'Test Club', 'test-club')
ON CONFLICT (id) DO NOTHING;

-- 3. Event with dynamic pricing
-- Base Price = $10 (1000 cents), Surge Multiplier = 0.5 (50%), Capacity = 10
INSERT INTO public.events (id, club_id, title, base_price, surge_multiplier, max_attendees)
VALUES ('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Surge Event', 1000, 0.5, 10)
ON CONFLICT (id) DO NOTHING;

-- Test 2: calculate_current_price with 0 sold tickets should be base_price ($10)
SELECT is(
  public.calculate_current_price('00000000-0000-0000-0000-000000000003'::uuid),
  1000,
  'calculate_current_price returns base_price when 0 tickets sold'
);

-- Test 3: tickets_until_price_increase at 0 sold tickets
-- Current Price = 1000 cents. Next dollar target is 1100 cents.
-- Price at x tickets: 1000 * (1 + x/10 * 0.5) = 1000 + 50 * x.
-- We want 1000 + 50 * x >= 1100 -> 50 * x >= 100 -> x >= 2.
-- So tickets_until_price_increase should return 2!
SELECT is(
  public.tickets_until_price_increase('00000000-0000-0000-0000-000000000003'::uuid),
  2,
  'tickets_until_price_increase returns 2 when 2 tickets needed for next dollar increase'
);

-- 4. Insert 2 RSVPs (sold tickets)
INSERT INTO public.event_rsvps (id, event_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid);

INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000004'::uuid, 'Normal User', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid);

-- Test 4: calculate_current_price with 2 sold tickets
-- Current Price: 1000 * (1 + 2/10 * 0.5) = 1000 * 1.1 = 1100 cents ($11)
SELECT is(
  public.calculate_current_price('00000000-0000-0000-0000-000000000003'::uuid),
  1100,
  'calculate_current_price returns 1100 when 2 tickets sold'
);

-- Test 5: tickets_until_price_increase with 2 sold tickets
-- Current Price = 1100 cents. Next dollar target is 1200 cents.
-- Price at (2 + x) tickets: 1000 + 50 * (2 + x) = 1100 + 50 * x.
-- We want 1100 + 50 * x >= 1200 -> 50 * x >= 100 -> x >= 2.
-- So tickets_until_price_increase should return 2!
SELECT is(
  public.tickets_until_price_increase('00000000-0000-0000-0000-000000000003'::uuid),
  2,
  'tickets_until_price_increase returns 2 when 2 more tickets needed for next dollar increase'
);

-- Test 6: Fallback when base_price is null
-- Reset base_price to null
UPDATE public.events
SET base_price = NULL
WHERE id = '00000000-0000-0000-0000-000000000003'::uuid;

-- Add a ticket tier for fallback testing
INSERT INTO public.ticket_tiers (id, event_id, name, price, capacity)
VALUES ('00000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Early Bird', 800, 5)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  public.calculate_current_price('00000000-0000-0000-0000-000000000003'::uuid),
  800,
  'calculate_current_price falls back to active ticket tier price if base_price is NULL'
);

-- Test 7: tickets_until_price_increase returns null when dynamic pricing is not active
SELECT is(
  public.tickets_until_price_increase('00000000-0000-0000-0000-000000000003'::uuid),
  NULL,
  'tickets_until_price_increase returns NULL when base_price is NULL'
);

SELECT * FROM finish();
ROLLBACK;
