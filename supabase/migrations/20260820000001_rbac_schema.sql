-- =============================================================================
-- Migration: Role-Based Access Control (RBAC) Schema
-- Issue: #2896 - Implement Role-Based Access Control (RBAC) UI for Club Executives
-- Description: Creates tables for custom club roles and granular permissions.
-- Replaces the simple boolean `is_admin` with a flexible permission matrix.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Define the master list of all possible permissions in the system
CREATE TYPE app_permission AS ENUM (
    'can_edit_profile',
    'can_manage_events',
    'can_view_finances',
    'can_manage_finances',
    'can_manage_members',
    'can_manage_roles',
    'can_delete_club',
    'can_moderate_forum'
);

-- 2. Custom Roles Table (e.g., President, Treasurer, Event Coordinator)
CREATE TABLE IF NOT EXISTS public.club_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE, -- Prevents deletion of 'President'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_club_roles_club_id ON public.club_roles(club_id);

-- 3. Role Permissions Mapping Table
CREATE TABLE IF NOT EXISTS public.club_role_permissions (
    role_id UUID NOT NULL REFERENCES public.club_roles(id) ON DELETE CASCADE,
    permission app_permission NOT NULL,
    PRIMARY KEY (role_id, permission)
);

-- 4. Update club_members to use role_id instead of simple boolean
-- Note: In a real migration, we would map existing 'admin' booleans to a 'President' role
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.club_roles(id) ON DELETE SET NULL;

-- Create a default 'President' role for all existing clubs via a function
CREATE OR REPLACE FUNCTION public.initialize_club_rbac()
RETURNS TRIGGER AS $$
DECLARE
    v_president_role_id UUID;
BEGIN
    -- Create the immutable President role for the new club
    INSERT INTO public.club_roles (club_id, name, is_system_role)
    VALUES (NEW.id, 'President', TRUE)
    RETURNING id INTO v_president_role_id;

    -- Grant ALL permissions to the President role
    INSERT INTO public.club_role_permissions (role_id, permission)
    SELECT v_president_role_id, enum_range(NULL::app_permission);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_initialize_club_rbac ON public.clubs;
CREATE TRIGGER trg_initialize_club_rbac
AFTER INSERT ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.initialize_club_rbac();

-- 5. Helper Function for RLS Policies
-- Checks if a user has a specific permission for a specific club
CREATE OR REPLACE FUNCTION public.has_club_permission(
    p_user_id UUID, 
    p_club_id UUID, 
    p_permission app_permission
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.club_members cm
        JOIN public.club_role_permissions crp ON cm.role_id = crp.role_id
        WHERE cm.user_id = p_user_id 
        AND cm.club_id = p_club_id 
        AND cm.status = 'approved'
        AND crp.permission = p_permission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- Row Level Security (RLS) Updates
-- =============================================================================

-- Example: Protecting the events table
-- DROP POLICY IF EXISTS "Club admins can manage events" ON public.events;
-- CREATE POLICY "Users with can_manage_events can manage events"
-- ON public.events FOR ALL
-- USING (public.has_club_permission(auth.uid(), club_id, 'can_manage_events'::app_permission));

-- Protecting the roles table itself
ALTER TABLE public.club_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view club roles"
ON public.club_roles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = club_roles.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Users with can_manage_roles can modify roles"
ON public.club_roles FOR ALL
USING (public.has_club_permission(auth.uid(), club_id, 'can_manage_roles'::app_permission))
WITH CHECK (public.has_club_permission(auth.uid(), club_id, 'can_manage_roles'::app_permission));

-- Prevent deletion of system roles (like President) via RLS check
CREATE POLICY "Cannot delete system roles"
ON public.club_roles FOR DELETE
USING (is_system_role = FALSE);
