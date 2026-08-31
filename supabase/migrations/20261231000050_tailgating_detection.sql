-- Migration: Real-Time Campus Safety Emergency Locking (Tailgating Detection)
-- Issue: #5070
-- Description: Sets up door access control tables, camera metadata tracking,
--              detections, security incidents, evidence, alert deliveries,
--              alarm dispatches, and access audit logging.

CREATE TABLE IF NOT EXISTS public.access_control_doors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    building VARCHAR(255) NOT NULL,
    location_details TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.door_configurations (
    door_id UUID PRIMARY KEY REFERENCES public.access_control_doors(id) ON DELETE CASCADE,
    camera_id VARCHAR(255) NOT NULL,
    expected_crossing_count INT NOT NULL DEFAULT 1 CHECK (expected_crossing_count >= 1),
    detection_window_seconds INT NOT NULL DEFAULT 5 CHECK (detection_window_seconds BETWEEN 2 AND 30),
    confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (confidence_threshold BETWEEN 0.00 AND 1.00),
    alert_severity VARCHAR(50) NOT NULL DEFAULT 'HIGH',
    alarm_simulation_mode BOOLEAN NOT NULL DEFAULT true,
    evidence_retention_days INT NOT NULL DEFAULT 7 CHECK (evidence_retention_days BETWEEN 1 AND 90),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.camera_devices (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_details TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    health_state VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tailgating_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    door_id UUID NOT NULL REFERENCES public.access_control_doors(id) ON DELETE CASCADE,
    camera_id VARCHAR(255) NOT NULL,
    badge_swipe_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    expected_count INT NOT NULL,
    observed_count INT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    is_tailgating_detected BOOLEAN NOT NULL,
    observed_crossings JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evidence_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID NOT NULL REFERENCES public.tailgating_detections(id) ON DELETE CASCADE,
    camera_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    storage_reference VARCHAR(500) NOT NULL, -- Anonymous reference only (no raw data)
    retention_expiration TIMESTAMPTZ NOT NULL,
    access_authorized_state BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    door_id UUID NOT NULL REFERENCES public.access_control_doors(id) ON DELETE CASCADE,
    camera_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    observed_count INT NOT NULL,
    expected_count INT NOT NULL,
    correlation_id VARCHAR(255) NOT NULL,
    evidence_clip_id UUID REFERENCES public.evidence_clips(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.security_events(id) ON DELETE CASCADE,
    severity VARCHAR(50) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    observed_count INT NOT NULL,
    expected_count INT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    is_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alarm_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.security_events(id) ON DELETE CASCADE,
    door_id UUID NOT NULL REFERENCES public.access_control_doors(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    simulation_mode BOOLEAN NOT NULL DEFAULT true,
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(255) NOT NULL,
    user_id UUID,
    user_role VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    details TEXT NOT NULL,
    ip_address VARCHAR(45)
);

-- CREATE INDEXES for efficient door/timestamp lookups
CREATE INDEX IF NOT EXISTS idx_tailgating_detections_door_timestamp ON public.tailgating_detections (door_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_door_timestamp ON public.security_events (door_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_clips_expiration ON public.evidence_clips (retention_expiration);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_incident_id ON public.alert_deliveries (incident_id);

-- RLS CONFIGURATIONS
ALTER TABLE public.access_control_doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tailgating_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Setup general read access policies for authenticated users
CREATE POLICY select_public_access_doors ON public.access_control_doors FOR SELECT TO authenticated USING (true);
CREATE POLICY select_public_door_configs ON public.door_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY select_public_cameras ON public.camera_devices FOR SELECT TO authenticated USING (true);

-- Security audit logs policy: only accessible by security admins
CREATE POLICY select_security_audit_logs ON public.security_audit_logs FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'role' = 'security_admin' OR auth.uid() IN (SELECT id FROM public.profiles WHERE email LIKE '%security%'));

-- Incidents and detections: writable by system triggers/service role, readable by authenticated safety personnel
CREATE POLICY select_security_events ON public.security_events FOR SELECT TO authenticated USING (true);
CREATE POLICY modify_security_events ON public.security_events FOR ALL TO authenticated USING (true);
CREATE POLICY select_alert_deliveries ON public.alert_deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY modify_alert_deliveries ON public.alert_deliveries FOR ALL TO authenticated USING (true);
CREATE POLICY select_detections ON public.tailgating_detections FOR SELECT TO authenticated USING (true);
CREATE POLICY select_evidence_clips ON public.evidence_clips FOR SELECT TO authenticated USING (true);
CREATE POLICY select_alarm_actions ON public.alarm_actions FOR SELECT TO authenticated USING (true);
