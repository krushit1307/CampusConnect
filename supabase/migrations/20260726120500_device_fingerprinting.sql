-- Migration: Add user_devices table and RLS policies
-- Description: Tracks recognized user device fingerprints to flag unrecognized logins.

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  browser TEXT NOT NULL,
  os TEXT NOT NULL,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

-- Enable Row-Level Security
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
CREATE POLICY "Users can view their own devices" ON public.user_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;
CREATE POLICY "Users can delete their own devices" ON public.user_devices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
