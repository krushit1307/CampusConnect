-- Migration: 20270401000000_hardware_provisioning.sql
-- Description: Issue #4234 - Real-Time Hardware Resource Provisioning API

CREATE TABLE IF NOT EXISTS public.hardware_provisioning_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- e.g., 'aws_ec2'
  resource_type TEXT NOT NULL, -- e.g., 't3.micro'
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, provisioning, active, partially_failed, failed, terminating, terminated
  event_start_time TIMESTAMPTZ NOT NULL,
  event_end_time TIMESTAMPTZ NOT NULL,
  provisioning_metadata JSONB DEFAULT '{}'::jsonb,
  error_information TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hardware_provisioned_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.hardware_provisioning_requests(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES public.event_attendees(id) ON DELETE SET NULL, -- mapped to a specific attendee
  provider_resource_id TEXT, -- e.g., i-1234567890abcdef0
  status TEXT DEFAULT 'pending', -- pending, provisioning, active, failed, terminating, terminated
  public_ip TEXT,
  private_ip TEXT,
  connection_metadata JSONB DEFAULT '{}'::jsonb, -- never stores secret keys directly
  error_information TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_hw_prov_req_event ON public.hardware_provisioning_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_hw_prov_res_req ON public.hardware_provisioned_resources(request_id);
CREATE INDEX IF NOT EXISTS idx_hw_prov_res_attendee ON public.hardware_provisioned_resources(attendee_id);
CREATE INDEX IF NOT EXISTS idx_hw_prov_req_status ON public.hardware_provisioning_requests(status);

-- RLS Policies
ALTER TABLE public.hardware_provisioning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_provisioned_resources ENABLE ROW LEVEL SECURITY;

-- Organizers can see requests for their clubs
CREATE POLICY "Organizers manage their requests"
ON public.hardware_provisioning_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_members.club_id = hardware_provisioning_requests.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role IN ('admin', 'organizer')
  )
);

-- Organizers can see all resources for their requests
CREATE POLICY "Organizers manage their resources"
ON public.hardware_provisioned_resources
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_members.club_id = hardware_provisioned_resources.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role IN ('admin', 'organizer')
  )
);

-- Attendees can see their own assigned resources (read-only)
CREATE POLICY "Attendees can see their assigned resources"
ON public.hardware_provisioned_resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_attendees.id = hardware_provisioned_resources.attendee_id
    AND event_attendees.user_id = auth.uid()
  )
);

-- Service Role / Supabase Functions can do everything
GRANT ALL ON public.hardware_provisioning_requests TO service_role;
GRANT ALL ON public.hardware_provisioned_resources TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.hardware_provisioning_requests TO authenticated;
GRANT SELECT ON public.hardware_provisioned_resources TO authenticated;

-- Schedule cleanup of expired hardware resources
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'terminate-expired-hardware') THEN
      PERFORM cron.unschedule('terminate-expired-hardware');
    END IF;
    
    PERFORM cron.schedule(
      'terminate-expired-hardware',
      '*/15 * * * *', -- Run every 15 minutes
      'SELECT net.http_post(url := ''http://localhost:54321/functions/v1/hardware-termination-cron'', headers := ''{"Authorization": "Bearer '' || current_setting(''app.settings.service_role_key'', true) || ''"}''::jsonb)'
    );
  END IF;
END
$$;
