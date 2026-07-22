-- Migration: 20260721210000_e2ee_direct_messages.sql
-- Description: Implement end-to-end encryption (E2EE) for direct messages and key exchange

-- 1. Create user_public_keys table
CREATE TABLE IF NOT EXISTS public.user_public_keys (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create direct_messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for user_public_keys
DROP POLICY IF EXISTS "Public keys are readable by authenticated users." ON public.user_public_keys;
CREATE POLICY "Public keys are readable by authenticated users." ON public.user_public_keys
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own public key." ON public.user_public_keys;
CREATE POLICY "Users can insert their own public key." ON public.user_public_keys
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own public key." ON public.user_public_keys;
CREATE POLICY "Users can update their own public key." ON public.user_public_keys
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. RLS Policies for direct_messages
DROP POLICY IF EXISTS "Users can view direct messages sent by or to them." ON public.direct_messages;
CREATE POLICY "Users can view direct messages sent by or to them." ON public.direct_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send direct messages." ON public.direct_messages;
CREATE POLICY "Users can send direct messages." ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at);

-- 6. Add direct_messages to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
