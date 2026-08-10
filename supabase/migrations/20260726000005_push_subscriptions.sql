-- Migration: 20260726000002_push_subscriptions.sql
-- Description: Create push_subscriptions table for Web Push notifications

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
