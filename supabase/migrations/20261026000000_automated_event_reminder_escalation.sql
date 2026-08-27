-- Migration: 20261026000000_automated_event_reminder_escalation.sql
-- Description: Create scheduled_reminders table, triggers on RSVPs, query helper RPC, and pg_cron scheduler (#3280).

-- 1. Create scheduled_reminders table
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    stage INT NOT NULL CHECK (stage IN (1, 2, 3)), -- 1 = Email (T-72h), 2 = Push (T-24h), 3 = SMS (T-1h)
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron polling efficiency
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_query
  ON public.scheduled_reminders (status, scheduled_for ASC);

-- Enable RLS
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role has full access to scheduled_reminders"
    ON public.scheduled_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view reminders for their own RSVPs"
    ON public.scheduled_reminders FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_rsvps r
            WHERE r.id = scheduled_reminders.rsvp_id
              AND r.user_id = auth.uid()
        )
    );

-- 2. Create RSVP trigger function to schedule 3 distinct reminder job payloads
CREATE OR REPLACE FUNCTION public.handle_rsvp_reminders_scheduling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
BEGIN
    -- If attending (inserted or transitioned to attending status)
    IF (TG_OP = 'INSERT' AND NEW.status = 'attending') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'attending' AND (OLD.status IS DISTINCT FROM 'attending')) THEN
        
        -- Delete any pre-existing reminders for this RSVP (defensive)
        DELETE FROM public.scheduled_reminders WHERE rsvp_id = NEW.id;

        -- Fetch the event's start_time
        SELECT start_time INTO v_start_time FROM public.events WHERE id = NEW.event_id;

        IF v_start_time IS NOT NULL THEN
            -- Job 1: Email (T-72h)
            IF v_start_time - INTERVAL '72 hours' > NOW() THEN
                INSERT INTO public.scheduled_reminders (rsvp_id, stage, scheduled_for)
                VALUES (NEW.id, 1, v_start_time - INTERVAL '72 hours');
            END IF;

            -- Job 2: Push (T-24h)
            IF v_start_time - INTERVAL '24 hours' > NOW() THEN
                INSERT INTO public.scheduled_reminders (rsvp_id, stage, scheduled_for)
                VALUES (NEW.id, 2, v_start_time - INTERVAL '24 hours');
            END IF;

            -- Job 3: SMS (T-1h)
            IF v_start_time - INTERVAL '1 hour' > NOW() THEN
                INSERT INTO public.scheduled_reminders (rsvp_id, stage, scheduled_for)
                VALUES (NEW.id, 3, v_start_time - INTERVAL '1 hour');
            END IF;
        END IF;

    -- If updated away from attending (cancelled, waitlisted, etc.)
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM 'attending' AND OLD.status = 'attending' THEN
        DELETE FROM public.scheduled_reminders WHERE rsvp_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_schedule_rsvp_reminders ON public.event_rsvps;
CREATE TRIGGER trigger_schedule_rsvp_reminders
    AFTER INSERT OR UPDATE ON public.event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_rsvp_reminders_scheduling();

-- 3. Create secure RPC function to dequeue scheduled reminders using SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_scheduled_reminders()
RETURNS TABLE (
    id UUID,
    rsvp_id UUID,
    stage INT,
    scheduled_for TIMESTAMPTZ,
    event_id UUID,
    event_title TEXT,
    user_id UUID,
    user_email TEXT,
    user_phone TEXT,
    user_first_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_ids UUID[];
BEGIN
    -- Find pending jobs that are due
    SELECT ARRAY(
        SELECT r.id
        FROM public.scheduled_reminders r
        WHERE r.status = 'pending' AND r.scheduled_for <= NOW()
        ORDER BY r.scheduled_for ASC
        FOR UPDATE SKIP LOCKED
    ) INTO v_ids;

    IF array_length(v_ids, 1) > 0 THEN
        UPDATE public.scheduled_reminders
        SET status = 'sent', updated_at = NOW()
        WHERE public.scheduled_reminders.id = ANY(v_ids);

        RETURN QUERY
        SELECT 
            r.id,
            r.rsvp_id,
            r.stage,
            r.scheduled_for,
            e.id AS event_id,
            e.title AS event_title,
            rsvp.user_id,
            u.email::TEXT AS user_email,
            p.phone_number::TEXT AS user_phone,
            p.first_name::TEXT AS user_first_name
        FROM public.scheduled_reminders r
        JOIN public.event_rsvps rsvp ON r.rsvp_id = rsvp.id
        JOIN public.events e ON rsvp.event_id = e.id
        JOIN auth.users u ON rsvp.user_id = u.id
        JOIN public.profiles p ON rsvp.user_id = p.id
        WHERE r.id = ANY(v_ids);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dequeue_scheduled_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dequeue_scheduled_reminders() TO service_role;

-- 4. Register pg_cron job calling the Deno Edge Function every 15 minutes
SELECT cron.schedule(
  'process-scheduled-reminders-cron',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'http://localhost:54321/functions/v1/process-reminders-cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
