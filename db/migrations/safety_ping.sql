-- Add requires_safety_ping to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS requires_safety_ping BOOLEAN DEFAULT FALSE;

-- Safety Confirmations Audit Log Table
CREATE TABLE IF NOT EXISTS safety_confirmations (
    id SERIAL PRIMARY KEY,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);
