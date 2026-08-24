ALTER TABLE events 
ADD COLUMN is_virtual BOOLEAN DEFAULT FALSE,
ADD COLUMN mux_stream_id VARCHAR(255),
ADD COLUMN stream_key VARCHAR(255),
ADD COLUMN playback_id VARCHAR(255);

CREATE TABLE stream_watch_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    watch_duration_seconds INT DEFAULT 0,
    has_attended BOOLEAN DEFAULT FALSE,
    last_ping_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
