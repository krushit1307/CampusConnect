-- Migration: AR Evacuation Hologram Spatial Node Graph
-- Stores venue spatial anchors, smoke sensor levels, crush bottleneck scores, and dynamic egress paths.

CREATE TABLE IF NOT EXISTS venue_spatial_evac_nodes (
    id VARCHAR(128) PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    pos_x NUMERIC(8, 3) NOT NULL DEFAULT 0.000,
    pos_y NUMERIC(8, 3) NOT NULL DEFAULT 0.000,
    pos_z NUMERIC(8, 3) NOT NULL DEFAULT 0.000,
    is_exit BOOLEAN NOT NULL DEFAULT FALSE,
    exit_capacity_rate INT NOT NULL DEFAULT 100, -- persons/minute
    current_smoke_density_ppm INT NOT NULL DEFAULT 0,
    current_bottleneck_score INT NOT NULL DEFAULT 0, -- 0-100 crush index
    connected_node_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_ar_evacuation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) NOT NULL,
    emergency_type VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    user_pos_x NUMERIC(8, 3) NOT NULL,
    user_pos_y NUMERIC(8, 3) NOT NULL,
    user_pos_z NUMERIC(8, 3) NOT NULL,
    assigned_exit_node_id VARCHAR(128) REFERENCES venue_spatial_evac_nodes(id),
    total_distance_meters NUMERIC(8, 2) NOT NULL,
    estimated_evac_seconds INT NOT NULL,
    hologram_render_device VARCHAR(64) DEFAULT 'ARCore_Android',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_spatial_nodes_event ON venue_spatial_evac_nodes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ar_evac_logs ON event_ar_evacuation_logs(event_id, emergency_type);
