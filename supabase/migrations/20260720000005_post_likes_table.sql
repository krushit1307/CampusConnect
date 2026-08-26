CREATE TABLE post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Public Read: Allows the UI to fetch and display like counts for everyone
CREATE POLICY "Anyone can read post likes." 
ON post_likes FOR SELECT 
USING (true);

-- Insert: Users can only like a post as themselves
CREATE POLICY "Users can insert their own likes." 
ON post_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Delete: Users can only unlike (delete) their own likes
CREATE POLICY "Users can delete their own likes." 
ON post_likes FOR DELETE 
USING (auth.uid() = user_id);
