-- Migration: 20260872000000_smart_refrigerator_lock.sql
-- Description: Interactive Dietary Restriction Smart Refrigerator Lock with ESP32 IoT BLE relay & cryptographic access control (#4986)

CREATE TABLE IF NOT EXISTS public.smart_refrigerator_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fridge_location TEXT NOT NULL DEFAULT 'Student Union Room 102',
  esp32_device_id TEXT NOT NULL UNIQUE,
  dietary_type TEXT NOT NULL DEFAULT 'Halal/Kosher/Vegan Staging',
  assigned_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  caterer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  one_time_unlock_hash TEXT DEFAULT NULL,
  unlock_expires_at TIMESTAMPTZ DEFAULT NULL,
  lock_state TEXT NOT NULL DEFAULT 'locked', -- 'locked', 'caterer_unlocked', 'organizer_unlocked'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_fridge_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fridge_id UUID NOT NULL REFERENCES public.smart_refrigerator_locks(id) ON DELETE CASCADE,
  unlocked_by_role TEXT NOT NULL, -- 'caterer', 'organizer'
  unlock_hash_used TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for smart fridge lookups
CREATE INDEX IF NOT EXISTS idx_smart_fridge_device ON public.smart_refrigerator_locks(esp32_device_id);
CREATE INDEX IF NOT EXISTS idx_smart_fridge_event ON public.smart_refrigerator_locks(assigned_event_id);

-- Enable RLS
ALTER TABLE public.smart_refrigerator_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_fridge_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read smart refrigerator locks"
ON public.smart_refrigerator_locks FOR SELECT
USING (true);

CREATE POLICY "Public read smart fridge access logs"
ON public.smart_fridge_access_logs FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage smart refrigerator locks"
ON public.smart_refrigerator_locks FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated manage smart fridge access logs"
ON public.smart_fridge_access_logs FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.smart_refrigerator_locks TO authenticated, anon;
GRANT ALL ON public.smart_fridge_access_logs TO authenticated, anon;
