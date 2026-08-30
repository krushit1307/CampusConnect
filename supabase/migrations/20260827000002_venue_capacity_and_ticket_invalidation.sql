-- Migration: 20260827000002_venue_capacity_and_ticket_invalidation.sql
-- Purpose: Add physical capacity tracking and emergency ticket invalidation for events.

-- Add physical capacity and emergency halt flags to events
ALTER TABLE IF EXISTS events
ADD COLUMN IF NOT EXISTS venue_physical_capacity INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_halt_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS emergency_halt_triggered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS emergency_halt_triggered_by UUID REFERENCES auth.users(id);

-- Function to invalidate all un-scanned tickets when emergency halt is triggered
CREATE OR REPLACE FUNCTION invalidate_tickets_on_halt()
RETURNS TRIGGER AS $$
BEGIN
    -- If emergency halt is newly activated
    IF NEW.emergency_halt_active = TRUE AND OLD.emergency_halt_active = FALSE THEN
        -- Update all pending/confirmed registrations to 'invalidated'
        UPDATE event_registrations
        SET status = 'invalidated',
            invalidation_reason = 'Emergency venue capacity reached. Access denied by Fire Marshal.'
        WHERE event_id = NEW.id 
          AND status IN ('pending', 'confirmed')
          AND checked_in_at IS NULL;
          
        -- Log this action
        INSERT INTO event_audit_logs (event_id, action, details, performed_by)
        VALUES (NEW.id, 'EMERGENCY_HALT', 'All un-scanned tickets invalidated due to capacity', NEW.emergency_halt_triggered_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invalidate_tickets_on_halt ON events;
CREATE TRIGGER trigger_invalidate_tickets_on_halt
AFTER UPDATE OF emergency_halt_active ON events
FOR EACH ROW
EXECUTE FUNCTION invalidate_tickets_on_halt();

-- Index for fast counting of checked-in attendees
CREATE INDEX IF NOT EXISTS idx_event_registrations_checked_in 
ON event_registrations(event_id) WHERE checked_in_at IS NOT NULL;
