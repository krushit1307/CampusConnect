-- Migration: 20260802100000_create_dead_letter_queue.sql
-- Description: Create dead_letter_queue table to store failed email payloads, with auto-purging policy.

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    error_message TEXT,
    attempt_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to view/manage DLQ rows
CREATE POLICY "Admins can manage dead_letter_queue"
    ON public.dead_letter_queue FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'system_admin'
        )
    );

-- Trigger function to automatically purge rows older than 7 days on every new insert
CREATE OR REPLACE FUNCTION public.purge_old_dead_letter_queue_rows()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.dead_letter_queue
    WHERE created_at < NOW() - INTERVAL '7 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_purge_old_dead_letter_queue
AFTER INSERT ON public.dead_letter_queue
FOR EACH STATEMENT
EXECUTE FUNCTION public.purge_old_dead_letter_queue_rows();

-- Index for faster administration queries
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_created_at ON public.dead_letter_queue(created_at DESC);
