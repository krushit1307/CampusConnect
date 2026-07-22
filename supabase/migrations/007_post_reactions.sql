CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '👏', '🔥')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);
