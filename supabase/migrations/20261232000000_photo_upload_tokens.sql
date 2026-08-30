-- Migration: Missing Photo Chaser
-- Description: Creates photo_upload_tokens table and adds photo_reminder_sent_at to events.

CREATE TABLE IF NOT EXISTS public.photo_upload_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add column to track when the reminder was sent
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS photo_reminder_sent_at TIMESTAMPTZ;

-- Create index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_photo_upload_tokens_token ON public.photo_upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_events_photo_reminder ON public.events(photo_reminder_sent_at) WHERE photo_reminder_sent_at IS NULL;

-- Enable RLS
ALTER TABLE public.photo_upload_tokens ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role can manage photo_upload_tokens"
ON public.photo_upload_tokens FOR ALL
USING (auth.role() = 'service_role');

-- Organizer can read their own tokens if they happen to be logged in
CREATE POLICY "Organizers can view their tokens"
ON public.photo_upload_tokens FOR SELECT
USING (auth.uid() = organizer_id);
