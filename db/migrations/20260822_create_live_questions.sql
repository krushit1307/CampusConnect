CREATE TABLE live_questions (
    id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_upvotes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES live_questions(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, question_id)
);

-- Enable Supabase Realtime for live broadcasting
ALTER PUBLICATION supabase_realtime ADD TABLE live_questions;
