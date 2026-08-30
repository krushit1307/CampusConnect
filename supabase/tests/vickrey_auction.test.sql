-- supabase/tests/vickrey_auction.test.sql
-- pgTAP test for Vickrey auction functionality (Issue #5056)
--
-- Run with: psql -f supabase/tests/vickrey_auction.test.sql

\set ECHO none
BEGIN;
SELECT plan(10);

-- ── Setup: create test data ─────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'Admin', 'User'),
    ('22222222-2222-2222-2222-222222222222', 'club1@test.local', 'Club', 'One'),
    ('33333333-3333-3333-3333-333333333333', 'club2@test.local', 'Club', 'Two')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club 1', 'test-club-1', '22222222-2222-2222-2222-222222222222'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Club 2', 'test-club-2', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory_items (id, name, barcode, category, condition)
VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test Projector', 'PROJ001', 'electronics', 'good')
ON CONFLICT (barcode) DO NOTHING;

-- ── Test 1: Create resource auction ─────────────────────────────────────
SELECT is(
    (SELECT public.create_resource_auction('cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), 24, 100) IS NOT NULL),
    true,
    'Resource auction should be created successfully'
);

-- ── Test 2: Verify auction was created with correct parameters ───────────
SELECT is(
    (SELECT minimum_bid FROM public.resource_auctions WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    100,
    'Auction should have minimum bid of 100'
);

SELECT is(
    (SELECT status FROM public.resource_auctions WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    'active',
    'Auction should be in active status'
);

-- ── Test 3: Submit sealed bid from Club 1 ───────────────────────────────
DO $$
DECLARE
    v_auction_id UUID;
BEGIN
    SELECT id INTO v_auction_id
    FROM public.resource_auctions
    WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    LIMIT 1;
    
    -- Simulate auth.uid() by setting the bidder_id directly
    INSERT INTO public.auction_bids (auction_id, club_id, bidder_id, maximum_bid)
    VALUES (v_auction_id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 5000);
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.auction_bids WHERE club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    1,
    'Club 1 should have submitted a bid'
);

SELECT is(
    (SELECT maximum_bid FROM public.auction_bids WHERE club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    5000,
    'Bid should be 5000'
);

-- ── Test 4: Submit sealed bid from Club 2 ───────────────────────────────
DO $$
DECLARE
    v_auction_id UUID;
BEGIN
    SELECT id INTO v_auction_id
    FROM public.resource_auctions
    WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    LIMIT 1;
    
    INSERT INTO public.auction_bids (auction_id, club_id, bidder_id, maximum_bid)
    VALUES (v_auction_id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 3000);
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.auction_bids),
    2,
    'Should have 2 total bids'
);

-- ── Test 5: Update auction end time to past for testing settlement ───────
DO $$
DECLARE
    v_auction_id UUID;
BEGIN
    SELECT id INTO v_auction_id
    FROM public.resource_auctions
    WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    LIMIT 1;
    
    UPDATE public.resource_auctions
    SET end_time = NOW() - INTERVAL '1 hour'
    WHERE id = v_auction_id;
END $$;

-- ── Test 6: Settle auction with Vickrey pricing ───────────────────────────
DO $$
DECLARE
    v_auction_id UUID;
    v_result JSONB;
BEGIN
    SELECT id INTO v_auction_id
    FROM public.resource_auctions
    WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    LIMIT 1;
    
    SELECT public.settle_auction(v_auction_id) INTO v_result;
    
    RAISE NOTICE 'Settlement result: %', v_result;
END $$;

-- ── Test 7: Verify Vickrey pricing (second-highest + 1) ───────────────────
SELECT is(
    (SELECT final_price FROM public.resource_auctions WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    3001,
    'Final price should be second-highest bid (3000) + 1 = 3001'
);

-- ── Test 8: Verify winner is Club 1 (highest bidder) ─────────────────────
SELECT is(
    (SELECT winner_club_id FROM public.resource_auctions WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Winner should be Club 1 (highest bidder with 5000)'
);

-- ── Test 9: Verify winning bid is marked ─────────────────────────────────
SELECT is(
    (SELECT is_winning_bid FROM public.auction_bids WHERE club_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    true,
    'Club 1 bid should be marked as winning bid'
);

-- ── Test 10: Verify bids are revealed after settlement ───────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.auction_bids WHERE is_revealed = true),
    2,
    'All bids should be revealed after settlement'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.auction_bids;
DELETE FROM public.resource_auctions WHERE item_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
DELETE FROM public.inventory_items WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
DELETE FROM public.clubs WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

SELECT * FROM finish();
ROLLBACK;
