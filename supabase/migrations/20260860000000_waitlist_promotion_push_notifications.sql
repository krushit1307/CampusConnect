-- Migration: 20260860000000_waitlist_promotion_push_notifications.sql
-- Description: Automated Waitlist Promotion Push Notifications with FCM/APNs deep-linking to Stripe Checkout (#4404)

-- Add fcm_device_token to public.profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_device_token TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.waitlist_push_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fcm_device_token TEXT NOT NULL,
  notification_title TEXT NOT NULL,
  notification_body TEXT NOT NULL,
  deep_link_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered', -- 'delivered', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user push notification lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_push_user ON public.waitlist_push_notifications(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.waitlist_push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read waitlist push notifications"
ON public.waitlist_push_notifications FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage waitlist push notifications"
ON public.waitlist_push_notifications FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.waitlist_push_notifications TO authenticated, anon;
