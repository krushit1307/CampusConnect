-- =============================================================================
-- Migration: Create Unified Audit Log System
-- Issue: #2727 - Implement a Unified Audit Log of all Admin Actions
-- Description: Creates an append-only audit_logs table with Postgres Triggers 
-- to automatically capture INSERT, UPDATE, and DELETE operations on critical 
-- tables (events, clubs, club_members). Includes JSONB scrubbing for sensitive 
-- data and a partitioning strategy for long-term performance.
-- =============================================================================

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the main audit_logs table
-- We use PARTITION BY RANGE on timestamp to allow easy archival/deletion of old logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create initial partitions (Current month and next month)
-- A background cron job should create future partitions monthly
CREATE TABLE IF NOT EXISTS audit_logs_y2026m08 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS audit_logs_y2026m09 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- Create indexes for fast querying
-- Index on table_name and record_id for fetching history of a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON public.audit_logs (table_name, record_id, timestamp DESC);

-- Index on actor_id for fetching all actions by a specific user
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
ON public.audit_logs (actor_id, timestamp DESC);

-- Index on timestamp for chronological feeds and partition pruning
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
ON public.audit_logs (timestamp DESC);

-- =============================================================================
-- Generic Trigger Function for Audit Logging
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_audit_action()
RETURNS TRIGGER AS $$
DECLARE
    old_json JSONB;
    new_json JSONB;
    current_actor UUID;
BEGIN
    -- Extract actor_id from Supabase JWT context
    current_actor := auth.uid();
    
    -- Capture OLD and NEW states
    IF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        new_json := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'INSERT' THEN
        old_json := NULL;
        new_json := to_jsonb(NEW);
    END IF;

    -- CRITICAL: Scrub sensitive fields from JSONB payloads before insertion
    -- We never want to log passwords, tokens, or sensitive PII
    IF old_json IS NOT NULL THEN
        old_json := old_json - 'password_hash' - 'totp_secret' - 'api_key' - 'service_role_key';
    END IF;
    
    IF new_json IS NOT NULL THEN
        new_json := new_json - 'password_hash' - 'totp_secret' - 'api_key' - 'service_role_key';
    END IF;

    -- Insert the audit record
    INSERT INTO public.audit_logs (
        table_name, 
        record_id, 
        action, 
        old_data, 
        new_data, 
        actor_id, 
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
            'UNKNOWN'
        )::TEXT,
        TG_OP,
        old_json,
        new_json,
        current_actor,
        NOW()
    );

    -- Return the appropriate row for the trigger
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Apply Triggers to Critical Tables
-- =============================================================================

-- 1. Events Table
DROP TRIGGER IF EXISTS trg_audit_events ON public.events;
CREATE TRIGGER trg_audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- 2. Clubs Table
DROP TRIGGER IF EXISTS trg_audit_clubs ON public.clubs;
CREATE TRIGGER trg_audit_clubs
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- 3. Club Members Table
DROP TRIGGER IF EXISTS trg_audit_club_members ON public.club_members;
CREATE TRIGGER trg_audit_club_members
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.log_audit_action();

-- =============================================================================
-- Row Level Security (RLS) for Audit Logs
-- =============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Club Admins can only view audit logs for their own clubs
-- This requires a join or a check against the club_members table
CREATE POLICY "Club admins can view their club's audit logs"
ON public.audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        JOIN public.events e ON cm.club_id = e.club_id
        WHERE cm.user_id = auth.uid() 
        AND cm.role = 'admin'
        AND (
            (audit_logs.table_name = 'events' AND e.id = audit_logs.record_id::uuid) OR
            (audit_logs.table_name = 'club_members' AND cm.club_id = (SELECT club_id FROM public.club_members WHERE id = audit_logs.record_id::uuid))
        )
    )
    OR 
    -- Super admins or the actor themselves can always see their own logs
    actor_id = auth.uid()
);

-- Only the system (via triggers) can insert into audit logs
-- No manual inserts allowed from the frontend
CREATE POLICY "System only insert"
ON public.audit_logs FOR INSERT
WITH CHECK (false); -- Blocks all direct inserts from PostgREST

-- No updates or deletes allowed on audit logs (Immutable append-only)
CREATE POLICY "No updates allowed"
ON public.audit_logs FOR UPDATE
USING (false);

CREATE POLICY "No deletes allowed"
ON public.audit_logs FOR DELETE
USING (false);
