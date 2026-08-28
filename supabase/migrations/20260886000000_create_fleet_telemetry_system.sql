-- 1. Create autonomous_shuttles table
CREATE TABLE IF NOT EXISTS autonomous_shuttles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shuttle_code TEXT UNIQUE NOT NULL, -- e.g. 'SHUTTLE_01'
    model_name TEXT DEFAULT 'May Mobility Autonomous Van' NOT NULL,
    max_capacity INTEGER DEFAULT 12 NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'charging_required', 'maintenance', 'in_depot')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create shuttle_telemetry_logs table for time-series GIS tracking
CREATE TABLE IF NOT EXISTS shuttle_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shuttle_id UUID NOT NULL REFERENCES autonomous_shuttles(id) ON DELETE CASCADE,
    battery_percent NUMERIC(5, 2) NOT NULL CHECK (battery_percent BETWEEN 0 AND 100),
    current_speed_mph NUMERIC(5, 2) NOT NULL,
    occupancy_count INTEGER NOT NULL CHECK (occupancy_count >= 0),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    dispatch_command TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for real-time fleet map queries
CREATE INDEX IF NOT EXISTS idx_telemetry_shuttle_time ON shuttle_telemetry_logs(shuttle_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE autonomous_shuttles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view fleet telemetry dashboards
CREATE POLICY "Admins can view shuttle telemetry"
    ON shuttle_telemetry_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_preferences up
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- 3. Stored RPC procedure to process incoming telemetry stream & trigger low-battery depot dispatch
CREATE OR REPLACE FUNCTION ingest_shuttle_telemetry(
    p_shuttle_code TEXT,
    p_battery NUMERIC(5, 2),
    p_speed NUMERIC(5, 2),
    p_occupancy INTEGER,
    p_lat NUMERIC(10, 7),
    p_lng NUMERIC(10, 7)
)
RETURNS TABLE (
    shuttle_id UUID,
    shuttle_code TEXT,
    battery_percent NUMERIC(5, 2),
    status TEXT,
    dispatch_command TEXT,
    marker_color TEXT
) AS $$
DECLARE
    v_shuttle_id UUID;
    v_dispatch TEXT := NULL;
    v_status TEXT := 'active';
    v_marker_color TEXT := 'green';
BEGIN
    SELECT id INTO v_shuttle_id
    FROM autonomous_shuttles
    WHERE shuttle_code = p_shuttle_code;

    IF NOT FOUND THEN
        INSERT INTO autonomous_shuttles (shuttle_code)
        VALUES (p_shuttle_code)
        RETURNING id INTO v_shuttle_id;
    END IF;

    -- Critical low battery threshold (< 10%)
    IF p_battery < 10.00 THEN
        v_status := 'charging_required';
        v_dispatch := 'ROUTE_TO_CHARGING_DEPOT';
        v_marker_color := 'red';
    ELSIF p_battery < 25.00 THEN
        v_marker_color := 'yellow';
    END IF;

    UPDATE autonomous_shuttles
    SET status = v_status
    WHERE id = v_shuttle_id;

    INSERT INTO shuttle_telemetry_logs (
        shuttle_id,
        battery_percent,
        current_speed_mph,
        occupancy_count,
        latitude,
        longitude,
        dispatch_command
    )
    VALUES (
        v_shuttle_id,
        p_battery,
        p_speed,
        p_occupancy,
        p_lat,
        p_lng,
        v_dispatch
    );

    RETURN QUERY SELECT v_shuttle_id, p_shuttle_code, p_battery, v_status, v_dispatch, v_marker_color;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;