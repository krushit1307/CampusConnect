-- Add public_key to profiles for decentralized ticketing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key TEXT;

-- Enhance event_rsvps with cryptographic fields for decentralized ticketing
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS owner_public_key TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS ticket_id UUID DEFAULT gen_random_uuid() UNIQUE;

-- Create table to track used nonces for replay protection during ticket transfers
CREATE TABLE IF NOT EXISTS public.ticket_nonces (
  nonce TEXT PRIMARY KEY,
  ticket_id UUID NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_ticket_nonces_ticket FOREIGN KEY (ticket_id) REFERENCES public.event_rsvps (ticket_id) ON DELETE CASCADE
);

-- Index on used_at to efficiently clean up old nonces via pg_cron if needed
CREATE INDEX IF NOT EXISTS idx_ticket_nonces_used_at ON public.ticket_nonces(used_at);

-- RLS for ticket_nonces
ALTER TABLE public.ticket_nonces ENABLE ROW LEVEL SECURITY;

-- Allow reading nonces for the same ticket (maybe only server needs to read/write this, but we'll allow auth users to insert)
-- Actually, only the server (edge functions) needs to access ticket_nonces, so no policies for public access needed.
