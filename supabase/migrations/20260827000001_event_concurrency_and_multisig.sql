-- Migration: 20260827000001_event_concurrency_and_multisig.sql
-- Purpose: Add Optimistic Concurrency Control (OCC) and Multi-Signature approval tracking for events.

-- Add version column for OCC
ALTER TABLE IF EXISTS events
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add multi-sig approval tracking for destructive actions
ALTER TABLE IF EXISTS events
ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID,
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP WITH TIME ZONE;

-- Function to increment version on update
CREATE OR REPLACE FUNCTION increment_event_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if actual data fields are changing, not just metadata
    IF TG_OP = 'UPDATE' THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_event_version ON events;
CREATE TRIGGER trigger_increment_event_version
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION increment_event_version();

-- Function to check multi-sig requirement for cancellation
CREATE OR REPLACE FUNCTION check_cancellation_multisig()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    -- Count total admins for this event's club
    SELECT COUNT(*) INTO admin_count 
    FROM club_admins 
    WHERE club_id = NEW.club_id AND role IN ('president', 'co-president', 'admin');

    -- If club has 2 or more admins, require 2 approvals for cancellation
    IF admin_count >= 2 THEN
        IF array_length(NEW.cancellation_approved_by, 1) < 2 THEN
            RAISE EXCEPTION 'Multi-signature approval required: At least 2 admins must approve event cancellation.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_cancellation_multisig ON events;
CREATE TRIGGER trigger_check_cancellation_multisig
BEFORE UPDATE OF status ON events
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
EXECUTE FUNCTION check_cancellation_multisig();
