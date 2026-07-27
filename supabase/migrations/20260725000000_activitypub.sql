CREATE TABLE activitypub_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID UNIQUE REFERENCES clubs(id) ON DELETE CASCADE,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activitypub_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  inbox_url TEXT NOT NULL,
  shared_inbox_url TEXT,
  username TEXT NOT NULL,
  domain TEXT NOT NULL,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, actor_id)
);

CREATE INDEX idx_ap_followers_club ON activitypub_followers(club_id);
CREATE INDEX idx_ap_followers_domain ON activitypub_followers(domain);

CREATE TABLE activitypub_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  activity_id TEXT UNIQUE NOT NULL,
  activity_type TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  payload JSONB NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ap_activities_club ON activitypub_activities(club_id);
CREATE INDEX idx_ap_activities_type ON activitypub_activities(activity_type);

CREATE TABLE activitypub_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  raw JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ap_inbox_club ON activitypub_inbox(club_id);

ALTER TABLE clubs ADD COLUMN activitypub_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clubs ADD COLUMN activitypub_follower_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clubs
  SET activitypub_follower_count = activitypub_follower_count + 1
  WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clubs
  SET activitypub_follower_count = GREATEST(activitypub_follower_count - 1, 0)
  WHERE id = OLD.club_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_ap_follower_insert
AFTER INSERT ON activitypub_followers
FOR EACH ROW
EXECUTE FUNCTION public.increment_follower_count();

CREATE TRIGGER trg_ap_follower_delete
AFTER DELETE ON activitypub_followers
FOR EACH ROW
EXECUTE FUNCTION public.decrement_follower_count();

ALTER TABLE activitypub_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activitypub_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE activitypub_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activitypub_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read followers" ON activitypub_followers FOR SELECT USING (true);
CREATE POLICY "Anyone can read activities" ON activitypub_activities FOR SELECT USING (true);
CREATE POLICY "Anyone can read inbox" ON activitypub_inbox FOR SELECT USING (true);
