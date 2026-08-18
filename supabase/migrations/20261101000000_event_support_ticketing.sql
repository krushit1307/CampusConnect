-- Migration: 20261101000000_event_support_ticketing.sql
-- Description: Implement Real-Time Event Support Ticketing schema, Realtime rules, and triggers (#3344).

-- 1. Create event_live_tickets table
CREATE TABLE IF NOT EXISTS public.event_live_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_live_tickets ENABLE ROW LEVEL SECURITY;

-- Allow service role full control
DROP POLICY IF EXISTS "service_role has full access to event_live_tickets" ON public.event_live_tickets;
CREATE POLICY "service_role has full access to event_live_tickets"
    ON public.event_live_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anyone to file tickets (authenticated or anonymous)
DROP POLICY IF EXISTS "Anyone can insert event support tickets" ON public.event_live_tickets;
CREATE POLICY "Anyone can insert event support tickets" ON public.event_live_tickets
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- Allow reporter or event organizers/admins to view tickets
DROP POLICY IF EXISTS "Users and organizers can view tickets" ON public.event_live_tickets;
CREATE POLICY "Users and organizers can view tickets" ON public.event_live_tickets
    FOR SELECT TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
    );

-- Allow only event organizers to update tickets
DROP POLICY IF EXISTS "Organizers can update tickets" ON public.event_live_tickets;
CREATE POLICY "Organizers can update tickets" ON public.event_live_tickets
    FOR UPDATE TO authenticated
    USING (public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid()))
    WITH CHECK (public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid()));

-- 2. Add table to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_live_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_live_tickets;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback/ignore if supabase_realtime does not exist in testing DB environment
    NULL;
END $$;

-- 3. Create ticket resolution push trigger
CREATE OR REPLACE FUNCTION public.handle_ticket_resolution_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND OLD.status = 'open' AND NEW.user_id IS NOT NULL THEN
        -- Safely verify if public.notifications exists first
        IF EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relname = 'notifications' AND n.nspname = 'public'
        ) THEN
            INSERT INTO public.notifications (user_id, type, title, message)
            VALUES (
                NEW.user_id,
                'support_ticket_resolved',
                'Support Ticket Resolved',
                'Thanks! We resolved your report: "' || NEW.message || '"'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_resolved_notify ON public.event_live_tickets;
CREATE TRIGGER on_ticket_resolved_notify
    AFTER UPDATE ON public.event_live_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ticket_resolution_notification();
