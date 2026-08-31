-- Venue Speaker Locations (networked PA/smart speakers)
CREATE TABLE IF NOT EXISTS venue_speakers (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL,
  speaker_code VARCHAR(100) NOT NULL UNIQUE,
  speaker_name VARCHAR(255) NOT NULL,
  
  -- Physical location
  zone_id INTEGER,
  room_name VARCHAR(255),
  location_description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Speaker specifications
  frequency_range_hz VARCHAR(50), -- e.g., "100-8000"
  directionality VARCHAR(50), -- "omnidirectional", "directional"
  audio_output_type VARCHAR(50), -- "speaker", "buzzer", "alarm"
  
  -- Integration
  api_endpoint VARCHAR(500),
  api_key_encrypted VARCHAR(500),
  device_id VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_tested TIMESTAMP,
  connection_status VARCHAR(50), -- "connected", "disconnected", "error"
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acoustic Zones (regions with speaker coverage)
CREATE TABLE IF NOT EXISTS acoustic_zones (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL,
  zone_name VARCHAR(255) NOT NULL,
  zone_type VARCHAR(50), -- "room", "hallway", "stairwell", "exit"
  
  -- Coverage
  speaker_ids INTEGER[], -- Array of speaker IDs in this zone
  
  -- Exit information
  exit_name VARCHAR(255),
  exit_latitude DECIMAL(10, 8),
  exit_longitude DECIMAL(11, 8),
  
  -- Accessibility
  is_emergency_exit BOOLEAN,
  accessibility_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wayfinding Routes (pre-calculated paths to exits)
CREATE TABLE IF NOT EXISTS wayfinding_routes (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  
  -- Route definition
  start_zone_id INTEGER NOT NULL,
  end_zone_id INTEGER NOT NULL, -- Exit zone
  
  -- Speaker sequence (ordered list of speaker IDs to activate)
  speaker_sequence INTEGER[],
  
  -- Timing
  total_duration_seconds INTEGER,
  interval_between_pings_ms INTEGER DEFAULT 2000,
  
  -- Audio properties
  audio_frequency_hz INTEGER DEFAULT 3000, -- Perceptible to visually impaired
  audio_duration_ms INTEGER DEFAULT 500,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  tested_by_user_id INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Audio Sequences (generated during actual events)
CREATE TABLE IF NOT EXISTS emergency_audio_sequences (
  id SERIAL PRIMARY KEY,
  emergency_event_id INTEGER NOT NULL,
  venue_id INTEGER NOT NULL,
  
  -- Sequence properties
  sequence_type VARCHAR(50), -- "evacuation_path", "alarm_override", "guided_exit"
  status VARCHAR(50), -- "pending", "active", "completed", "failed"
  
  -- Audio configuration
  speaker_sequence INTEGER[],
  audio_frequency_hz INTEGER,
  loop_count INTEGER DEFAULT 1,
  
  -- Tracking
  activated_at TIMESTAMP,
  completed_at TIMESTAMP,
  activated_by_user_id INTEGER,
  
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Speaker Zone Mapping (which speakers cover which zones)
CREATE TABLE IF NOT EXISTS speaker_zone_coverage (
  id SERIAL PRIMARY KEY,
  speaker_id INTEGER NOT NULL REFERENCES venue_speakers(id),
  zone_id INTEGER NOT NULL REFERENCES acoustic_zones(id),
  coverage_percentage INTEGER, -- 0-100
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_venue_speakers_venue_id ON venue_speakers(venue_id);
CREATE INDEX idx_venue_speakers_active ON venue_speakers(is_active);
CREATE INDEX idx_acoustic_zones_venue_id ON acoustic_zones(venue_id);
CREATE INDEX idx_wayfinding_routes_venue_id ON wayfinding_routes(venue_id);
CREATE INDEX idx_wayfinding_routes_start_end ON wayfinding_routes(start_zone_id, end_zone_id);
CREATE INDEX idx_emergency_sequences_event_id ON emergency_audio_sequences(emergency_event_id);
CREATE INDEX idx_speaker_coverage_speaker_id ON speaker_zone_coverage(speaker_id);