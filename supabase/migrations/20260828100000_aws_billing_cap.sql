-- Migration for Real-Time Hardware Resource Billing Cap (#4429)

-- 1. Add max_aws_budget to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS max_aws_budget NUMERIC(10, 2) DEFAULT NULL;

-- 2. Create event_aws_billing_logs to store snapshots
CREATE TABLE IF NOT EXISTS public.event_aws_billing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_cost NUMERIC(10, 2) NOT NULL,
    max_budget NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD'
);

-- 3. Create aws_circuit_breaker_audits to log terminations
CREATE TABLE IF NOT EXISTS public.aws_circuit_breaker_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cost_at_termination NUMERIC(10, 2) NOT NULL,
    max_budget NUMERIC(10, 2) NOT NULL,
    terminated_instance_count INT NOT NULL,
    instance_ids TEXT[] NOT NULL,
    sms_sent_to TEXT
);

-- RLS
ALTER TABLE public.event_aws_billing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aws_circuit_breaker_audits ENABLE ROW LEVEL SECURITY;

-- Admins / Organizers can view billing logs
CREATE POLICY "Organizers can view billing logs for their events"
    ON public.event_aws_billing_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_aws_billing_logs.event_id
            AND events.organizer_id = auth.uid()
        )
    );

CREATE POLICY "Organizers can view circuit breaker audits"
    ON public.aws_circuit_breaker_audits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = aws_circuit_breaker_audits.event_id
            AND events.organizer_id = auth.uid()
        )
    );

-- Allow Edge Function to insert (using service_role key bypasses RLS anyway)

-- 4. Schedule the cron job using pg_cron and pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to call the Edge Function every 15 minutes
SELECT cron.schedule(
    'aws-billing-circuit-breaker-cron',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/aws-billing-circuit-breaker',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    );
    $$
);
