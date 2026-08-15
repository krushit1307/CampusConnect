-- Migration: 20260726000005_push_subscriptions.sql
-- Description: Create push_subscriptions table for Web Push notifications
--
-- FIX (as part of the notification batching work in issue #<batching issue>):
-- Three separate migrations named "push_subscriptions" were committed
-- independently (this one, 20260728120001, and 20260803000000), each
-- trying to CREATE TABLE public.push_subscriptions with a DIFFERENT
-- shape (profile_id vs user_id, different FKs/constraints). Applied in
-- order, this one succeeds, then 20260728120001 hard-fails with
-- `column "user_id" does not exist` (verified locally), and
-- `supabase db reset` never completes — blocking ALL local development,
-- not just anything push-related.
--
-- This file is now the single canonical definition. It uses `user_id`
-- (not `profile_id`) because that's what the already-written
-- send-push-notification/broadcast-push-notification Edge Functions
-- query against — profile_id was never actually wired up to anything.
-- The other two migrations have been reduced to no-ops with an
-- explanation, rather than deleted, to preserve migration history.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'push_subscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

COMMENT ON TABLE public.push_subscriptions IS 'Stores Web Push API subscription details for user devices.';
