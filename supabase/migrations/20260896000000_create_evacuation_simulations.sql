-- 1. Create venue_evacuation_simulations table to log simulation results and Fire Marshal approvals
CREATE TABLE IF NOT EXISTS venue_evacuation_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
    exit_nodes_count INTEGER NOT NULL CHECK (exit_nodes_count > 0),
    max_bottleneck_density NUMERIC(8, 2) NOT NULL,
    critical_bottleneck_detected BOOLEAN DEFAULT FALSE NOT NULL,
    fire_marshal_approved BOOLEAN DEFAULT FALSE NOT NULL,
    simulation_run_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast event simulation lookups
CREATE INDEX IF NOT EXISTS idx_evacuation_sim_event ON venue_evacuation_simulations(event_id);

-- Enable RLS
ALTER TABLE venue_evacuation_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizers and Admins can view and execute simulation logs
CREATE POLICY "Organizers and Admins can manage evacuation simulations"
    ON venue_evacuation_simulations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = venue_evacuation_simulations.event_id AND eo.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM user_preferences up
            WHERE up.user_id = auth.uid() AND up.is_admin = TRUE
        )
    );

-- 2. Stored RPC procedure to record simulation metrics and determine approval status
CREATE OR REPLACE FUNCTION record_evacuation_simulation_run(
    p_event_id UUID,
    p_max_capacity INTEGER,
    p_exit_count INTEGER,
    p_max_density NUMERIC(8, 2),
    p_critical_bottleneck BOOLEAN
)
RETURNS TABLE (
    simulation_id UUID,
    event_id UUID,
    critical_bottleneck_detected BOOLEAN,
    fire_marshal_approved BOOLEAN,
    status_message TEXT
) AS $$
DECLARE
    v_sim_id UUID;
    v_approved BOOLEAN;
    v_msg TEXT;
BEGIN
    v_approved := NOT p_critical_bottleneck;

    IF v_approved THEN
        v_msg := 'Evacuation simulation passed safely. Cleared for Fire Marshal approval.';
    ELSE
        v_msg := 'CRITICAL BOTTLENECK DETECTED! Evacuation flow exceeds safe door width capacity. Additional exits required.';
    END IF;

    INSERT INTO venue_evacuation_simulations (
        event_id,
        max_capacity,
        exit_nodes_count,
        max_bottleneck_density,
        critical_bottleneck_detected,
        fire_marshal_approved
    )
    VALUES (
        p_event_id,
        p_max_capacity,
        p_exit_count,
        p_max_density,
        p_critical_bottleneck,
        v_approved
    )
    RETURNING id INTO v_sim_id;

    RETURN QUERY SELECT v_sim_id, p_event_id, p_critical_bottleneck, v_approved, v_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;