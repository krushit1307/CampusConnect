-- Migration: chat_read_receipts
-- Description: Creates the chat_participants junction table to track direct message read receipt watermarks.

-- 1. Create chat_participants table
CREATE TABLE IF NOT EXISTS public.chat_participants (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, recipient_id)
);

-- 2. Create index to optimize lookup performance
CREATE INDEX IF NOT EXISTS idx_chat_participants_lookup 
ON public.chat_participants (user_id, recipient_id);

-- 3. Enable RLS
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Users can view own read receipts" ON public.chat_participants;
CREATE POLICY "Users can view own read receipts"
ON public.chat_participants FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update own read receipts" ON public.chat_participants;
CREATE POLICY "Users can update own read receipts"
ON public.chat_participants FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Add table to realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants'
    ) THEN
        NULL;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
    END IF;
END $$;
