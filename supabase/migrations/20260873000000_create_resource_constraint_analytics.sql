-- 1. Create campus_resources table
CREATE TABLE IF NOT EXISTS campus_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'equipment' NOT NULL,
    estimated_unit_cost NUMERIC(10, 2) DEFAULT 500.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create resource_booking_logs table tracking bookings and blocked conflicts
CREATE TABLE IF NOT EXISTS resource_booking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES campus_resources(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('booked', 'blocked_conflict')),
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_resource_logs_resource ON resource_booking_logs(resource_id, status);

-- Enable RLS
ALTER TABLE campus_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_booking_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view resource utilization telemetry
CREATE POLICY "Admins can view resource utilization telemetry"
    ON resource_booking_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_preferences up
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );