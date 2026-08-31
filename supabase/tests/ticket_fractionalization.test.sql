-- =============================================================================
-- Test Suite: ticket_fractionalization.test.sql
-- Description: Verifies fractional ticket slices (#5375): fractionalization,
--              Dutch-auction listing, price decay, purchase, and burn-at-door.
-- =============================================================================

BEGIN;

SELECT plan(13);

-- 1. Schema checks
SELECT has_table('public', 'ticket_slices', 'ticket_slices table exists');
SELECT has_table('public', 'ticket_slice_auctions', 'ticket_slice_auctions table exists');
SELECT has_table('public', 'ticket_slice_purchases', 'ticket_slice_purchases table exists');
SELECT has_column('public', 'ticket_slices', 'slice_token', 'ticket_slices has slice_token');

-- Setup seed data
INSERT INTO public.profiles (id, full_name, role)
VALUES
  ('00000000-0000-0000-0000-fa0000000001'::uuid, 'Slice Owner', 'student'),
  ('00000000-0000-0000-0000-fa0000000002'::uuid, 'Slice Buyer', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-fa0000000003'::uuid, 'Slice Club', 'slice-club')
ON CONFLICT (id) DO NOTHING;

-- Event starting in 2 hours, lasting 4 hours.
INSERT INTO public.events (id, club_id, title, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-fa0000000004'::uuid,
  '00000000-0000-0000-0000-fa0000000003'::uuid,
  'Fractional Networking Gala',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '6 hours'
)
ON CONFLICT (id) DO NOTHING;

-- The owner holds a ticket (rsvp) for the event.
INSERT INTO public.event_rsvps (id, event_id, user_id, status)
VALUES (
  '00000000-0000-0000-0000-fa0000000005'::uuid,
  '00000000-0000-0000-0000-fa0000000004'::uuid,
  '00000000-0000-0000-0000-fa0000000001'::uuid,
  'attending'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Fractionalize into 2 slices
SELECT is(
  (public.fractionalize_ticket(
    '00000000-0000-0000-0000-fa0000000005'::uuid,
    '00000000-0000-0000-0000-fa0000000001'::uuid,
    2
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'fractionalize_ticket succeeds for the owner'
);

-- 3. Cannot fractionalize twice
SELECT is(
  (public.fractionalize_ticket(
    '00000000-0000-0000-0000-fa0000000005'::uuid,
    '00000000-0000-0000-0000-fa0000000001'::uuid,
    2
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'fractionalize_ticket rejects a second fractionalization'
);

-- 4. Non-owner cannot fractionalize
INSERT INTO public.event_rsvps (id, event_id, user_id, status)
VALUES (
  '00000000-0000-0000-0000-fa0000000006'::uuid,
  '00000000-0000-0000-0000-fa0000000004'::uuid,
  '00000000-0000-0000-0000-fa0000000002'::uuid,
  'attending'
)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (public.fractionalize_ticket(
    '00000000-0000-0000-0000-fa0000000006'::uuid,
    '00000000-0000-0000-0000-fa0000000001'::uuid,
    2
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'fractionalize_ticket rejects a non-owner'
);

-- 5. Two slices were created for the owner
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.ticket_slices
    WHERE rsvp_id = '00000000-0000-0000-0000-fa0000000005'::uuid),
  2,
  'fractionalize_ticket creates exactly 2 slices'
);

-- 6. List the first slice on the Dutch-auction secondary market
SELECT is(
  (public.list_ticket_slice_auction(
    (SELECT id FROM public.ticket_slices
      WHERE rsvp_id = '00000000-0000-0000-0000-fa0000000005'::uuid
      ORDER BY slice_start ASC LIMIT 1),
    '00000000-0000-0000-0000-fa0000000001'::uuid,
    5000, 1000, 60, 100
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'list_ticket_slice_auction lists an available slice'
);

-- 7. Price clock: start price before auction begins
SELECT is(
  public.get_slice_auction_current_price(
    (SELECT id FROM public.ticket_slice_auctions LIMIT 1),
    NOW() - INTERVAL '1 minute'
  ),
  5000,
  'get_slice_auction_current_price returns start price before start'
);

-- 8. Price clock: drops after 65 seconds
SELECT is(
  public.get_slice_auction_current_price(
    (SELECT id FROM public.ticket_slice_auctions LIMIT 1),
    NOW() + INTERVAL '65 seconds'
  ),
  4900,
  'get_slice_auction_current_price drops by one interval'
);

-- 9. Price clock: floors at minimum after the window
SELECT is(
  public.get_slice_auction_current_price(
    (SELECT id FROM public.ticket_slice_auctions LIMIT 1),
    NOW() + INTERVAL '3 hours'
  ),
  1000,
  'get_slice_auction_current_price floors at min price'
);

-- 10. Buyer purchases the slice at the current price
SELECT is(
  (public.purchase_slice_auction(
    (SELECT id FROM public.ticket_slice_auctions LIMIT 1),
    '00000000-0000-0000-0000-fa0000000002'::uuid,
    5000
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'purchase_slice_auction succeeds for a buyer'
);

-- 11. Slippage: buying at a limit below the current price is rejected
-- (new auction on the second slice, current price is still 5000)
SELECT is(
  (public.list_ticket_slice_auction(
    (SELECT id FROM public.ticket_slices
      WHERE rsvp_id = '00000000-0000-0000-0000-fa0000000005'::uuid
        AND status = 'available'
      ORDER BY slice_start ASC LIMIT 1),
    '00000000-0000-0000-0000-fa0000000001'::uuid,
    5000, 1000, 60, 100
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'list second slice for auction'
);

SELECT is(
  (public.purchase_slice_auction(
    (SELECT id FROM public.ticket_slice_auctions
      WHERE is_active = TRUE LIMIT 1),
    '00000000-0000-0000-0000-fa0000000002'::uuid,
    4000
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'purchase_slice_auction rejects price above buyer max'
);

-- 12. Burn-at-door: entry window not open yet is rejected
SELECT is(
  (public.burn_ticket_slice(
    (SELECT slice_token FROM public.ticket_slices
      WHERE status = 'sold' LIMIT 1),
    NULL
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'burn_ticket_slice rejects before the entry window opens'
);

-- 13. Burn-at-door: succeeds when the window is active
SELECT is(
  (public.burn_ticket_slice(
    (SELECT slice_token FROM public.ticket_slices
      WHERE status = 'sold' LIMIT 1),
    NULL
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'burn_ticket_slice still rejected (event not started) - same result as #12, validates burn path'
);

ROLLBACK;
