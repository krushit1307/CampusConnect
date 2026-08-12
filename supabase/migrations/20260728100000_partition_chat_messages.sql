-- Migration: Partition chat_messages table by month
-- Description: Converts the existing chat_messages table into a range-partitioned 
-- table based on the created_at timestamp to maintain query performance for recent messages.

-- Step 1: Ensure pg_cron is available (required for Step 2, but good to note here)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Rename the existing table to preserve data temporarily
ALTER TABLE IF EXISTS public.chat_messages RENAME TO chat_messages_old;

-- Step 3: Create the new partitioned table
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Step 4: Create a default partition to catch any out-of-bounds data
CREATE TABLE public.chat_messages_default PARTITION OF public.chat_messages DEFAULT;

-- Step 5: Recreate indexes on the partitioned table
CREATE INDEX idx_chat_messages_sender ON public.chat_messages (sender_id);
CREATE INDEX idx_chat_messages_receiver ON public.chat_messages (receiver_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages (created_at);

-- Step 6: Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Step 7: Recreate RLS Policies
CREATE POLICY "Users can view their own sent messages"
    ON public.chat_messages FOR SELECT
    USING (auth.uid() = sender_id);

CREATE POLICY "Users can view their own received messages"
    ON public.chat_messages FOR SELECT
    USING (auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own sent messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own sent messages"
    ON public.chat_messages FOR UPDATE
    USING (auth.uid() = sender_id);

-- Step 8: Migrate existing data from the old table to the new partitioned table
-- We do this in batches conceptually, but for the migration script, a direct insert is standard.
INSERT INTO public.chat_messages (id, sender_id, receiver_id, content, is_read, created_at, updated_at)
SELECT id, sender_id, receiver_id, content, is_read, created_at, updated_at
FROM public.chat_messages_old;

-- Step 9: Drop the old table after successful migration
DROP TABLE public.chat_messages_old CASCADE;

-- Step 10: Add to realtime publication if it was previously there
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

COMMENT ON TABLE public.chat_messages IS 'Partitioned table for direct messages, partitioned by month on created_at.';
