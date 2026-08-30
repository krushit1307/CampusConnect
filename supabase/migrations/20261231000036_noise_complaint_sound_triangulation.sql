-- Migration: Crowdsourced Mobile Noise Complaint Sound Level Triangulation
-- Stores complaint events, silent mic array sampling telemetry, and police dispatch verification tickets.

CREATE TABLE IF NOT EXISTS noise_complaint_incidents (
    id VARCHAR(128) PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    venue_room VARCHAR(255) NOT NULL,
    organizer_name VARCHAR(255) NOT NULL,
    complaints_count INT NOT NULL DEFAULT 3,
    complaint_timestamps TIMESTAMPTZ[] NOT NULL DEFAULT '{}',
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING_TRIANGULATION',
    triangulated_average_db INT NOT NULL DEFAULT 0,
    threshold_max_db INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendee_microphone_sound_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(128) REFERENCES noise_complaint_incidents(id) ON DELETE CASCADE,
    attendee_id VARCHAR(128) NOT NULL,
    attendee_name VARCHAR(255) NOT NULL,
    audio_sample_duration_ms INT NOT NULL DEFAULT 2000,
    measured_dbfs NUMERIC(6, 2) NOT NULL,
    calculated_spl_db INT NOT NULL,
    device_model VARCHAR(128),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campus_police_dispatch_tickets (
    id VARCHAR(128) PRIMARY KEY,
    incident_id VARCHAR(128) REFERENCES noise_complaint_incidents(id) ON DELETE CASCADE,
    dispatch_priority VARCHAR(64) NOT NULL,
    empirical_data_summary TEXT NOT NULL,
    assigned_officer VARCHAR(255) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_noise_incidents_status ON noise_complaint_incidents(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendee_mic_readings ON attendee_microphone_sound_readings(incident_id);
