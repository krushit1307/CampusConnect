-- Migration: 20260801000000_refactor_notification_preferences.sql
-- Description: Refactor JSONB notification_preferences column to strict relational table

-- 1. Create the new user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email_alerts BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  digest BOOLEAN NOT NULL DEFAULT true,
  dark_mode_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can view their own preferences." ON public.user_preferences;
CREATE POLICY "Users can view their own preferences." ON public.user_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences." ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences." ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences." ON public.user_preferences;
CREATE POLICY "Users can update their own preferences." ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Migrate existing data from profiles.notification_preferences JSONB column
INSERT INTO public.user_preferences (user_id, email_alerts, push_notifications, digest, dark_mode_default)
SELECT 
  id,
  COALESCE((notification_preferences->>'rsvps')::boolean, true) AS email_alerts,
  COALESCE((notification_preferences->>'digest')::boolean, true) AS push_notifications,
  COALESCE((notification_preferences->>'certs')::boolean, true) AS digest,
  COALESCE((notification_preferences->>'dark_mode')::boolean, false) AS dark_mode_default
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 5. Create updated_at trigger
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 6. Add realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;