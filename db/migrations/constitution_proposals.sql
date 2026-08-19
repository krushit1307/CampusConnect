-- Constitution Proposals Table (Git-style PR system for club governance)
CREATE TABLE IF NOT EXISTS constitution_proposals (
    id SERIAL PRIMARY KEY,
    club_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_text TEXT NOT NULL,
    proposed_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'merged', 'closed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
