-- Migration: 20270305000000_venue_accessibility_dashboard.sql
-- Description: Create facility_manager role, venue_managers mapping, venue_deployments tracking, and RLS policies.

-- 1. Alter type user_role to add 'facility_manager' enum value
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'facility_manager';

-- 2. Create venue_managers table
CREATE TABLE IF NOT EXISTS public.venue_managers (
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (venue_id, user_id)
);

-- 3. Create venue_deployments table to track actions (e.g. Ramp Deployed) per event
CREATE TABLE IF NOT EXISTS public.venue_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(venue_id, event_id, action)
);

-- 4. Enable RLS
ALTER TABLE public.venue_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_deployments ENABLE ROW LEVEL SECURITY;

-- 5. Helper function to check if a user is a manager for a specific venue
CREATE OR REPLACE FUNCTION public.is_venue_manager(p_venue_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.venue_managers
    WHERE venue_id = p_venue_id AND user_id = p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_venue_manager(UUID, UUID) TO authenticated, service_role;

-- 6. RLS Policies for venue_managers
DROP POLICY IF EXISTS "Venue managers viewable by authenticated users" ON public.venue_managers;
CREATE POLICY "Venue managers viewable by authenticated users"
ON public.venue_managers FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage venue managers" ON public.venue_managers;
CREATE POLICY "Admins manage venue managers"
ON public.venue_managers FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'system_admin'
);

-- 7. RLS Policies for venue_deployments
DROP POLICY IF EXISTS "Deployments viewable by authenticated users" ON public.venue_deployments;
CREATE POLICY "Deployments viewable by authenticated users"
ON public.venue_deployments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Venue managers and admins can manage deployments" ON public.venue_deployments;
CREATE POLICY "Venue managers and admins can manage deployments"
ON public.venue_deployments FOR ALL
TO authenticated
USING (
  public.is_venue_manager(venue_id, auth.uid()) OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'system_admin'
)
WITH CHECK (
  public.is_venue_manager(venue_id, auth.uid()) OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'system_admin'
);
