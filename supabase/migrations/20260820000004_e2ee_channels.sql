-- =============================================================================
-- Migration: End-to-End Encryption (E2EE) for Secure Channels
-- Issue: #2905 - Implement 'End-to-End Encryption' for Sensitive Club Direct Messages
-- Description: Creates tables for secure chat channels and the storage of 
-- encrypted symmetric keys. Messages themselves remain in the standard 
-- messages table but are stored entirely as ciphertext.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Secure Channels Table
CREATE TABLE IF NOT EXISTS public.secure_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Channel Participants & Encrypted Symmetric Keys
-- Each participant stores their own copy of the AES key, encrypted with their RSA public key
CREATE TABLE IF NOT EXISTS public.secure_channel_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES public.secure_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_aes_key TEXT NOT NULL, -- Base64 encoded ciphertext
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_secure_channel_keys_user 
ON public.secure_channel_keys(user_id);

-- 3. Add is_secure flag to the main messages table (Assuming it exists)
-- If the messages table doesn't exist, we assume it's defined elsewhere.
-- ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_secure BOOLEAN DEFAULT FALSE;
-- ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.secure_channels(id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.secure_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_channel_keys ENABLE ROW LEVEL SECURITY;

-- Participants can view the channel metadata
CREATE POLICY "Participants can view secure channels"
ON public.secure_channels FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.secure_channel_keys k
        WHERE k.channel_id = secure_channels.id AND k.user_id = auth.uid()
    )
);

-- Users can only view and manage their own encrypted keys
CREATE POLICY "Users can manage own encrypted keys"
ON public.secure_channel_keys FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: The actual message content is encrypted on the client.
-- The server has ZERO knowledge of the plaintext. RLS on the messages table 
-- should just verify the user is a participant in the channel.
