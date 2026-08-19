-- Add 'ideation_phase' to event status enum (example PostgreSQL syntax)
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'ideation_phase';

-- Event Proposals Table (attributes like time slots, speakers, food options)
CREATE TABLE IF NOT EXISTS event_proposals (
    id SERIAL PRIMARY KEY,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- e.g., 'time', 'speaker', 'food'
    option_value TEXT NOT NULL,
    votes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proposal Votes Table (tracks user participation)
CREATE TABLE IF NOT EXISTS proposal_votes (
    id SERIAL PRIMARY KEY,
    proposal_id INT REFERENCES event_proposals(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, user_id)
);
