-- Add score_data JSONB column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS score_data JSONB DEFAULT NULL;

-- Create an RLS policy for updating score_data if needed, or rely on existing UPDATE policies.
-- We'll rely on the existing event UPDATE policies (which usually check if user is the creator or club admin).
-- But we can also add a specific "event_referees" table if it doesn't exist, let's see.

-- Enable real-time for events table to broadcast scoreboard updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;
