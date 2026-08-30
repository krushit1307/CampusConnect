-- =============================================================================
-- Test Suite: dutch_auction.test.sql
-- Description: Verifies "Dynamic Pricing" Dutch Auction Engine behavior,
--              including time-based price decay, transactional safety, and slippage.
-- =============================================================================

BEGIN;

SELECT plan(9);

-- 1. Verify schema tables and columns
SELECT has_table('public', 'dutch_auctions', 'dutch_auctions table exists');
SELECT has_column('public', 'dutch_auctions', 'start_price_cents', 'dutch_auctions has start_price_cents');
SELECT has_column('public', 'dutch_auctions', 'min_price_cents', 'dutch_auctions has min_price_cents');

-- Setup test seeds
-- Profiles
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('00000000-0000-0000-0000-da0000000001'::uuid, 'Dutch Organizer', 'student'),
  ('00000000-0000-0000-0000-da0000000002'::uuid, 'Dutch Customer 1', 'student'),
  ('00000000-0000-0000-0000-da0000000003'::uuid, 'Dutch Customer 2', 'student')
ON CONFLICT (id) DO NOTHING;

-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-da0000000004'::uuid, 'Dutch Club', 'dutch-club')
ON CONFLICT (id) DO NOTHING;

-- Event starting in 30 minutes
INSERT INTO public.events (id, club_id, title, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-da0000000005'::uuid, 
  '00000000-0000-0000-0000-da0000000004'::uuid, 
  'Dutch Auction Event', 
  NOW() + INTERVAL '30 minutes', 
  NOW() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Ticket tier
INSERT INTO public.ticket_tiers (id, event_id, name, price, capacity)
VALUES ('00000000-0000-0000-0000-da0000000006'::uuid, '00000000-0000-0000-0000-da0000000005'::uuid, 'Standard Tier', 5000, 2)
ON CONFLICT (id) DO NOTHING;

-- Dutch Auction (Starts now, ends in 30 minutes, starts at $50, drops $1 every 60s, min $10)
INSERT INTO public.dutch_auctions (id, event_id, ticket_tier_id, start_price_cents, min_price_cents, price_drop_interval_seconds, price_drop_amount_cents, starts_at, ends_at)
VALUES (
  '00000000-0000-0000-0000-da0000000007'::uuid, 
  '00000000-0000-0000-0000-da0000000005'::uuid, 
  '00000000-0000-0000-0000-da0000000006'::uuid,
  5000,
  1000,
  60,
  100,
  NOW(),
  NOW() + INTERVAL '30 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test price calculation at start (0 seconds elapsed) -> should be 5000 cents ($50)
SELECT is(
  public.get_dutch_auction_current_price('00000000-0000-0000-0000-da0000000007'::uuid, NOW()),
  5000,
  'get_dutch_auction_current_price returns start price at starts_at'
);

-- 3. Test price calculation after 65 seconds (1 interval elapsed) -> should be 4900 cents ($49)
SELECT is(
  public.get_dutch_auction_current_price('00000000-0000-0000-0000-da0000000007'::uuid, NOW() + INTERVAL '65 seconds'),
  4900,
  'get_dutch_auction_current_price drops price after 1 minute interval'
);

-- 4. Test price calculation after 45 minutes (exceeding end timeline) -> should hit min_price_cents ($10)
SELECT is(
  public.get_dutch_auction_current_price('00000000-0000-0000-0000-da0000000007'::uuid, NOW() + INTERVAL '45 minutes'),
  1000,
  'get_dutch_auction_current_price respects floor minimum price after timeline expiration'
);

-- 5. Test successful ticket purchase via Dutch Auction
SELECT is(
  (public.purchase_dutch_auction_ticket(
    '00000000-0000-0000-0000-da0000000007'::uuid,
    '00000000-0000-0000-0000-da0000000002'::uuid,
    5000,
    NOW() + INTERVAL '5 minutes'
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'purchase_dutch_auction_ticket succeeds under valid parameters'
);

-- 6. Test purchase rejection due to price slippage (asking price is $45 at 5 mins, user limit is $40)
SELECT is(
  (public.purchase_dutch_auction_ticket(
    '00000000-0000-0000-0000-da0000000007'::uuid,
    '00000000-0000-0000-0000-da0000000003'::uuid,
    4000, -- Max price user is willing to pay
    NOW() + INTERVAL '5 minutes'
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'purchase_dutch_auction_ticket blocks purchase if current price exceeds slippage max price'
);

-- 7. Purchase second ticket to fill capacity (capacity is 2, 1 already bought)
SELECT is(
  (public.purchase_dutch_auction_ticket(
    '00000000-0000-0000-0000-da0000000007'::uuid,
    '00000000-0000-0000-0000-da0000000003'::uuid,
    4600,
    NOW() + INTERVAL '5 minutes'
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'purchase_dutch_auction_ticket succeeds on second ticket purchase'
);

-- 8. Test purchase rejection when capacity is sold out (3rd ticket fails)
SELECT is(
  (public.purchase_dutch_auction_ticket(
    '00000000-0000-0000-0000-da0000000007'::uuid,
    '00000000-0000-0000-0000-da0000000001'::uuid,
    5000,
    NOW() + INTERVAL '6 minutes'
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'purchase_dutch_auction_ticket blocks purchase if ticket tier capacity is fully depleted'
);

ROLLBACK;
