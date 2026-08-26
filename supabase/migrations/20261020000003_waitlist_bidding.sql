-- =============================================================================
-- Migration: Interactive Event Waitlist Bidding System
-- Issue: #3544 - Build an 'Interactive Event Waitlist Bidding' System
-- Description: Adds bidding columns to the event_rsvps table to support 
-- charity auction waitlists. Integrates with Stripe SetupIntents to authorize 
-- cards without immediately capturing funds.
-- =============================================================================

-- 1. Add bidding columns to event_rsvps
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS bid_amount_cents INT DEFAULT 0 CHECK (bid_amount_cents >= 0),
ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT,
ADD COLUMN IF NOT EXISTS bid_status TEXT DEFAULT 'none' CHECK (bid_status IN ('none', 'authorized', 'captured', 'failed')),
ADD COLUMN IF NOT EXISTS bid_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_rsvps.bid_amount_cents IS 'The maximum donation bid the user is willing to make for a waitlist spot.';
COMMENT ON COLUMN public.event_rsvps.stripe_setup_intent_id IS 'Stripe SetupIntent ID used to authorize the card for future capture.';

-- 2. Add configuration flag to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_bidding_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.events.is_bidding_enabled IS 'If true, waitlisted users can bid donations to jump the queue.';

-- 3. Create index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_rsvps_waitlist_bids 
ON public.event_rsvps(event_id, bid_amount_cents DESC) 
WHERE status = 'waitlisted' AND bid_amount_cents > 0;

-- =============================================================================
-- Row Level Security (RLS) Updates
-- =============================================================================
-- Users can update their own bid amounts and setup intents
DROP POLICY IF EXISTS "Users can manage own rsvps" ON public.event_rsvps;
CREATE POLICY "Users can manage own rsvps"
ON public.event_rsvps FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Anyone can view the anonymized leaderboard (handled via RPC or specific select policy)
CREATE POLICY "Public can view waitlist bid counts"
ON public.event_rsvps FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_rsvps.event_id AND is_bidding_enabled = TRUE)
);
