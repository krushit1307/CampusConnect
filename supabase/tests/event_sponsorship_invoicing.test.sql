-- ============================================================
-- Test Suite: event_sponsorship_invoicing.test.sql
-- Description: Verifies the sponsor_invoices schema, status constraints, and outbox triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Verify schema elements exist on clubs table
SELECT has_column('public', 'clubs', 'tax_id', 'clubs table should have tax_id column');

-- 2. Verify schema elements exist on sponsor_invoices table
SELECT has_table('public', 'sponsor_invoices', 'sponsor_invoices table should exist');
SELECT has_column('public', 'sponsor_invoices', 'pitch_id', 'sponsor_invoices table should have pitch_id column');
SELECT has_column('public', 'sponsor_invoices', 'stripe_invoice_id', 'sponsor_invoices table should have stripe_invoice_id column');
SELECT has_column('public', 'sponsor_invoices', 'stripe_customer_id', 'sponsor_invoices table should have stripe_customer_id column');
SELECT has_column('public', 'sponsor_invoices', 'stripe_invoice_pdf_url', 'sponsor_invoices table should have stripe_invoice_pdf_url column');
SELECT has_column('public', 'sponsor_invoices', 'amount_cents', 'sponsor_invoices table should have amount_cents column');
SELECT has_column('public', 'sponsor_invoices', 'status', 'sponsor_invoices table should have status column');

-- 3. Set up mock users, profiles, club, request, campaign, and pitch
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-0000000001a1', 'club-admin@campus.edu'),
    ('00000000-0000-0000-0000-0000000001a2', 'corporate-sponsor@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-0000000001a1', 'Club Leader', 'club_leader', 'club-admin@campus.edu'),
    ('00000000-0000-0000-0000-0000000001a2', 'Sponsor Agent', 'sponsor_agent', 'corporate-sponsor@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by, tax_id)
VALUES (
    '00000000-0000-0000-0000-0000000001c1',
    'Finance Club',
    'finance-club',
    '00000000-0000-0000-0000-0000000001a1',
    '12-3456789'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.funding_requests (id, club_id, title, description, requested_amount, target_demographics, status)
VALUES (
    '00000000-0000-0000-0000-0000000001f1',
    '00000000-0000-0000-0000-0000000001c1',
    'Annual Summit Funding',
    'Seeking funding for our annual financial conference.',
    100000, -- $1000
    '{"finance_majors"}'::text[],
    'open'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sponsorship_campaigns (id, sponsor_id, company_name, campaign_title, total_budget, remaining_budget, target_demographics, is_active)
VALUES (
    '00000000-0000-0000-0000-0000000001c2',
    '00000000-0000-0000-0000-0000000001a2',
    'Big Tech Inc',
    'Undergrad Tech Outreach',
    500000,
    500000,
    '{"finance_majors"}'::text[],
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sponsor_pitches (id, request_id, campaign_id, pitch_message, requested_amount, status)
VALUES (
    '00000000-0000-0000-0000-0000000001p1',
    '00000000-0000-0000-0000-0000000001f1',
    '00000000-0000-0000-0000-000001c2', -- truncated to match the insert ID exactly
    'We would love to sponsor your summit!',
    100000,
    'pending'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Test pitch transition to 'approved' enqueues an outbox event
UPDATE public.sponsor_pitches
SET status = 'approved'
WHERE id = '00000000-0000-0000-0000-0000000001p1';

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.outbox_events
    WHERE payload->>'table' = 'sponsor_pitches'
      AND payload->>'action' = 'PITCH_APPROVED'
      AND (payload->'record'->>'id') = '00000000-0000-0000-0000-0000000001p1';
    $$,
    ARRAY[1],
    'Changing pitch status to approved should trigger a PITCH_APPROVED outbox event'
);

-- 5. Test pitch status constraint can accept 'Funds Received'
SELECT lives_ok(
    $$
    UPDATE public.sponsor_pitches
    SET status = 'Funds Received'
    WHERE id = '00000000-0000-0000-0000-0000000001p1';
    $$,
    'Updating pitch status to "Funds Received" should succeed and comply with the status check constraint'
);

ROLLBACK;
