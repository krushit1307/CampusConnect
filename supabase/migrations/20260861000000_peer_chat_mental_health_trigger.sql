-- Migration: 20260861000000_peer_chat_mental_health_trigger.sql
-- Description: Subtle Peer Group Chat "Mental Health Support" Trigger with strict user-only privacy policies (#4503)

CREATE TABLE IF NOT EXISTS public.peer_chat_support_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_room_id TEXT NOT NULL,
  trigger_category TEXT NOT NULL, -- 'academic_stress', 'emotional_distress', 'isolation'
  detected_keywords TEXT[] DEFAULT '{}',
  support_resource_shown TEXT NOT NULL,
  banner_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user private support trigger lookup
CREATE INDEX IF NOT EXISTS idx_peer_chat_support_user ON public.peer_chat_support_triggers(user_id, created_at DESC);

-- Enable RLS with STRICT PRIVACY POLICIES (Only the specific user can read/write their support triggers; NO admins, NO other chat members)
ALTER TABLE public.peer_chat_support_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User strictly reads own support triggers"
ON public.peer_chat_support_triggers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "User strictly inserts own support triggers"
ON public.peer_chat_support_triggers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User strictly updates own support triggers"
ON public.peer_chat_support_triggers FOR UPDATE
USING (auth.uid() = user_id);

GRANT ALL ON public.peer_chat_support_triggers TO authenticated;
