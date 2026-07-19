-- ============================================================
-- Migration: 20260718000001_event_cancellation_notifications.sql
-- Description:
-- Adds a status column to the events table, creates a notifications
-- table with RLS, and sets up a trigger that dispatches system
-- notifications to RSVP'd users when an event is canceled.
-- ============================================================

-- 1. Alter events table to add status column
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled';

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index IF NOT EXISTS for faster notification lookups by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- 3. Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for notifications table
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create Trigger Function to handle event cancellation notifications
CREATE OR REPLACE FUNCTION public.handle_event_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a notification for each attendee who has RSVP'd to the event
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT 
    rsvp.user_id,
    'event',
    'Event Canceled',
    'Event ' || NEW.title || ' has been canceled by the organizer.',
    '/events/' || NEW.id
  FROM public.event_rsvps rsvp
  WHERE rsvp.event_id = NEW.id;

  RETURN NEW;
END;
$$;

-- 6. Create Trigger on events table
DROP TRIGGER IF EXISTS on_event_canceled ON public.events;
CREATE TRIGGER on_event_canceled
  AFTER UPDATE ON public.events
  FOR EACH ROW
  WHEN (NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled')
  EXECUTE FUNCTION public.handle_event_cancellation();
