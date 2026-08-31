-- =============================================================================
-- Test Suite: poap_minting.test.sql
-- Purpose: Verify automated POAP trigger logic, queue dispatches, and
--          warning notification creation when user Web3 wallet is missing.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- 1. Schema structure checks
SELECT has_column('public', 'profiles', 'wallet_address', 'profiles has wallet_address');
SELECT has_table('public', 'poap_events', 'poap_events table exists');
SELECT has_table('public', 'poap_claims', 'poap_claims table exists');
SELECT has_table('public', 'poap_mint_jobs', 'poap_mint_jobs table exists');

-- Setup seeds
-- Profiles (User 1: Mapped Wallet, User 2: Missing Wallet)
INSERT INTO public.profiles (id, full_name, handle, role, wallet_address)
VALUES 
  ('00000000-0000-0000-0000-po0000000001'::uuid, 'Web3 Student 1', 'web3stud1', 'student', '0x1234567890123456789012345678901234567890'),
  ('00000000-0000-0000-0000-po0000000002'::uuid, 'Web3 Student 2', 'web3stud2', 'student', NULL)
ON CONFLICT (id) DO NOTHING;

-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-po0000000003'::uuid, 'Web3 Club', 'web3-club')
ON CONFLICT (id) DO NOTHING;

-- Event
INSERT INTO public.events (id, club_id, title)
VALUES ('00000000-0000-0000-0000-po0000000004'::uuid, '00000000-0000-0000-0000-po0000000003'::uuid, 'Solidity Lecture')
ON CONFLICT (id) DO NOTHING;

-- POAP Event
INSERT INTO public.poap_events (id, event_id, poap_id, badge_title, badge_image_url, secret_code)
VALUES (
  '00000000-0000-0000-0000-po0000000005'::uuid,
  '00000000-0000-0000-0000-po0000000004'::uuid,
  8899,
  'Prestige Solidity Graduate',
  'https://poap.gallery/solidity.png',
  'supersecret'
)
ON CONFLICT (id) DO NOTHING;

-- RSVPs (checked_in = false initially)
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in, status)
VALUES 
  ('00000000-0000-0000-0000-po0000000006'::uuid, '00000000-0000-0000-0000-po0000000004'::uuid, '00000000-0000-0000-0000-po0000000001'::uuid, FALSE, 'going'),
  ('00000000-0000-0000-0000-po0000000007'::uuid, '00000000-0000-0000-0000-po0000000004'::uuid, '00000000-0000-0000-0000-po0000000002'::uuid, FALSE, 'going')
ON CONFLICT (id) DO NOTHING;

-- 2. Trigger check-in update on Student 1 (Wallet exists) -> Should create a PENDING job
UPDATE public.event_rsvps 
SET checked_in = TRUE 
WHERE id = '00000000-0000-0000-0000-po0000000006'::uuid;

SELECT is(
  (SELECT COUNT(*)::INT FROM public.poap_mint_jobs 
   WHERE rsvp_id = '00000000-0000-0000-0000-po0000000006'::uuid AND status = 'PENDING'),
  1,
  'RSVP check-in trigger correctly creates PENDING mint job when wallet is mapped'
);

-- 3. Trigger check-in update on Student 2 (Wallet missing) -> Should NOT create a job
UPDATE public.event_rsvps 
SET checked_in = TRUE 
WHERE id = '00000000-0000-0000-0000-po0000000007'::uuid;

SELECT is(
  (SELECT COUNT(*)::INT FROM public.poap_mint_jobs 
   WHERE rsvp_id = '00000000-0000-0000-0000-po0000000007'::uuid),
  0,
  'RSVP check-in trigger does not queue mint jobs when wallet is missing'
);

-- 4. Verify that a warning notification is created instead for Student 2
SELECT is(
  (SELECT COUNT(*)::INT FROM public.notifications 
   WHERE user_id = '00000000-0000-0000-0000-po0000000002'::uuid AND type = 'poap_pending_wallet'),
  1,
  'Dispatches warning notification to prompt user to link Web3 wallet address'
);

ROLLBACK;
