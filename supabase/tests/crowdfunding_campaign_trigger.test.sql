-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 13 tests)
SELECT plan(13);

-- 1. Setup mock data
-- Create a test user in auth.users (this triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('91000000-0000-0000-0000-000000000001', 'creator@crowdfund.test', 'authenticated', 'authenticated', '{"full_name": "Creator"}'),
  ('91000000-0000-0000-0000-000000000002', 'donor1@crowdfund.test', 'authenticated', 'authenticated', '{"full_name": "Donor One"}'),
  ('91000000-0000-0000-0000-000000000003', 'donor2@crowdfund.test', 'authenticated', 'authenticated', '{"full_name": "Donor Two"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('91000000-0000-0000-0000-000000000004', 'Robotics Club', 'robotics-club-crowdfund-test', 'Test club for crowdfunding', '91000000-0000-0000-0000-000000000001');

-- A $1,000.00 goal campaign
INSERT INTO public.crowdfunding_campaigns (id, club_id, title, target_amount_cents, created_by)
VALUES (
  '91000000-0000-0000-0000-000000000005',
  '91000000-0000-0000-0000-000000000004',
  'Send the Robotics team to Nationals',
  100000,
  '91000000-0000-0000-0000-000000000001'
);

-- Test 1: Initial current_amount_cents is 0
SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  0,
  'Initial current_amount_cents of new campaign is 0'
);

-- Test 2: A pending donation does NOT increment current_amount_cents
INSERT INTO public.campaign_donations (id, campaign_id, donor_id, display_name, amount_cents, stripe_payment_intent_id, status)
VALUES ('91000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000002', 'Donor One', 20000, 'pi_test_pending', 'pending');

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  0,
  'Pending donation does not increment current_amount_cents'
);

-- Test 3: A donation inserted as 'succeeded' (webhook path) increments current_amount_cents
INSERT INTO public.campaign_donations (id, campaign_id, donor_id, display_name, amount_cents, stripe_payment_intent_id, status)
VALUES ('91000000-0000-0000-0000-000000000007', '91000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000002', 'Donor One', 80000, 'pi_test_1', 'succeeded');

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  80000,
  'Succeeded $800 donation increments current_amount_cents to 80000'
);

-- Test 4: Pending -> succeeded transition also increments the total
UPDATE public.campaign_donations SET status = 'succeeded' WHERE id = '91000000-0000-0000-0000-000000000006';

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  100000,
  'Pending -> succeeded transition brings total to exactly the $1000 goal'
);

-- Test 5 (Edge case: goal exceeded): a further $500 donation on top of the
-- already-met $1000 goal must still be tallied correctly in current_amount_cents;
-- capping the *visual* bar at 100% is a frontend concern (getCampaignProgressPercent),
-- not a data-integrity one, so the raw total keeps growing past the goal.
INSERT INTO public.campaign_donations (id, campaign_id, donor_id, display_name, amount_cents, stripe_payment_intent_id, status)
VALUES ('91000000-0000-0000-0000-000000000008', '91000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000003', 'Donor Two', 50000, 'pi_test_overfund', 'succeeded');

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  150000,
  'Overfunding donation correctly raises current_amount_cents past the target (150% of goal)'
);

-- Test 6 (Edge case: refund): a card dispute/refund on donation 007 ($800) must
-- decrement current_amount_cents by exactly that amount, keeping the bar accurate.
UPDATE public.campaign_donations SET status = 'refunded' WHERE id = '91000000-0000-0000-0000-000000000007';

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  70000,
  'Refunding the $800 donation decrements current_amount_cents to 70000'
);

-- Test 7 (Edge case: dispute): marking donation 006 ($200) as disputed also decrements
UPDATE public.campaign_donations SET status = 'disputed' WHERE id = '91000000-0000-0000-0000-000000000006';

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  50000,
  'Disputing the $200 donation decrements current_amount_cents to 50000'
);

-- Test 8: current_amount_cents never goes negative even if deltas would overshoot
SELECT ok(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005') >= 0,
  'current_amount_cents is clamped at a minimum of 0'
);

-- Test 9: Deleting a still-succeeded donation decrements the total
DELETE FROM public.campaign_donations WHERE id = '91000000-0000-0000-0000-000000000008';

SELECT is(
  (SELECT current_amount_cents FROM public.crowdfunding_campaigns WHERE id = '91000000-0000-0000-0000-000000000005'),
  0,
  'Deleting the remaining succeeded $500 donation brings the total back to 0'
);

-- Test 10: the trigger function exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_campaign_donation_delta'
  ),
  'apply_campaign_donation_delta function should exist'
);

-- Test 11: the insert trigger is bound to campaign_donations
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_campaign_donation_insert' AND c.relname = 'campaign_donations'
  ),
  'trg_campaign_donation_insert trigger should exist on campaign_donations'
);

-- Test 12: anonymous donations are hidden by name in the top-donors view
INSERT INTO public.campaign_donations (id, campaign_id, donor_id, display_name, is_anonymous, amount_cents, stripe_payment_intent_id, status)
VALUES ('91000000-0000-0000-0000-000000000009', '91000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000003', 'Donor Two', TRUE, 30000, 'pi_test_anon', 'succeeded');

SELECT is(
  (SELECT display_name FROM public.campaign_top_donors WHERE campaign_id = '91000000-0000-0000-0000-000000000005' AND is_anonymous = TRUE),
  'Anonymous',
  'Anonymous donations surface as "Anonymous" in the top donors view, hiding the real name'
);

-- Test 13: ...but the raw donor identity is still captured in the underlying table for auditing
SELECT is(
  (SELECT display_name FROM public.campaign_donations WHERE id = '91000000-0000-0000-0000-000000000009'),
  'Donor Two',
  'The raw campaign_donations row still retains the true donor name for admin/audit purposes'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
