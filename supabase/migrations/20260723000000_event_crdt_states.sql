-- Migration: 20260723000000_event_crdt_states.sql
-- Description: Create event_crdt_states table to store CRDT document updates for events

CREATE TABLE IF NOT EXISTS public.event_crdt_states (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_crdt_states ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read event_crdt_states" ON public.event_crdt_states;
DROP POLICY IF EXISTS "Allow authenticated insert/update event_crdt_states" ON public.event_crdt_states;

-- Policy 1: Authenticated users can view CRDT states
CREATE POLICY "Allow authenticated read event_crdt_states"
  ON public.event_crdt_states FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Authenticated users can insert/update CRDT states
CREATE POLICY "Allow authenticated insert/update event_crdt_states"
  ON public.event_crdt_states FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
