-- Drop the existing strict inequality constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_end_after_start;

-- Re-create the constraint enforcing start_date <= end_date
ALTER TABLE events
ADD CONSTRAINT chk_events_end_after_start
CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
