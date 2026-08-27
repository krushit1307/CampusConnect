-- 0. Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create custom types
CREATE TYPE user_role AS ENUM ('student', 'club_admin', 'system_admin', 'Premium');
CREATE TYPE member_role AS ENUM ('member', 'admin');
CREATE TYPE join_status AS ENUM ('pending', 'approved');
CREATE TYPE club_visibility AS ENUM ('public', 'private');

-- 1.5 Create utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create tables
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  college TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}'::TEXT[],
  role user_role DEFAULT 'student'::user_role,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING gin (skills);

CREATE TABLE user_preferences (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email_alerts BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  digest BOOLEAN NOT NULL DEFAULT true,
  dark_mode_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences." ON public.user_preferences;
CREATE POLICY "Users can view their own preferences." ON public.user_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences." ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences." ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences." ON public.user_preferences;
CREATE POLICY "Users can update their own preferences." ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_user_preferences
BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;

CREATE OR REPLACE FUNCTION public.is_valid_social_links(links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    links IS NULL OR (
      jsonb_typeof(links) = 'object'
      AND NOT EXISTS (
        SELECT 1 
        FROM jsonb_each_text(links) 
        WHERE value NOT LIKE 'http://%' AND value NOT LIKE 'https://%'
      )
    );
$$;

CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  github_repo_url TEXT,
  visibility club_visibility DEFAULT 'public'::club_visibility,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  CONSTRAINT check_clubs_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT check_clubs_github_repo_url CHECK (github_repo_url IS NULL OR github_repo_url LIKE 'https://github.com/%'),
  CONSTRAINT check_clubs_social_links_valid CHECK (public.is_valid_social_links(social_links))
);

CREATE TABLE club_members (
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES club_roles(id, club_id) ON DELETE RESTRICT NOT NULL,
  status join_status DEFAULT 'pending'::join_status,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX idx_club_members_club_id ON club_members(club_id);
CREATE INDEX idx_club_members_user_id ON club_members(user_id);
CREATE INDEX idx_club_members_status ON club_members(status);

CREATE TABLE event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  category_id UUID CONSTRAINT fk_events_category REFERENCES event_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  event_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_geo GEOGRAPHY(Point, 4326),
  max_attendees INTEGER,
  available_spots INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  short_id TEXT UNIQUE,
  generates_certificate BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE events
ADD CONSTRAINT check_events_max_attendees
CHECK (
  max_attendees IS NULL OR max_attendees > 0
);

CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_location_geo_gist ON events USING GIST (location_geo);

ALTER TABLE events
ADD CONSTRAINT events_latitude_valid
CHECK (
    latitude IS NULL OR
    (latitude >= -90 AND latitude <= 90)
);

ALTER TABLE events
ADD CONSTRAINT events_longitude_valid
CHECK (
    longitude IS NULL OR
    (longitude >= -180 AND longitude <= 180)
);

-- Issue #3899: Automated Health & Safety Compliance Checks
ALTER TABLE events ADD COLUMN category TEXT;
ALTER TABLE events ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN compliance_permit_url TEXT;
CREATE TABLE event_co_hosts (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, club_id)
);

CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in BOOLEAN DEFAULT FALSE,
  rsvp_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE event_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);



CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TYPE like_entity_type AS ENUM ('event', 'post', 'comment');

CREATE TABLE likes (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type like_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  club_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id, club_id),
  CONSTRAINT likes_user_entity_unique UNIQUE (user_id, entity_type, entity_id, club_id)
);

CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_entity ON likes(entity_type, entity_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes."
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own likes."
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes."
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT check_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  attendee_name TEXT,
  event_title TEXT,
  event_date TIMESTAMPTZ,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  email_sent_at TIMESTAMPTZ,
  CONSTRAINT unique_event_user_certificate UNIQUE (event_id, user_id)
);

CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  question TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_public_keys (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_club_members_club_id ON club_members(club_id);
CREATE INDEX idx_club_members_user_id ON club_members(user_id);
CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_posts_club_id ON posts(club_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_polls_event_id ON polls(event_id);
CREATE INDEX idx_polls_event_id_active ON polls(event_id) WHERE is_active = TRUE;
CREATE INDEX idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_poll_id_user_id ON poll_votes(poll_id, user_id);
CREATE INDEX idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX idx_direct_messages_receiver_id ON direct_messages(receiver_id);
CREATE INDEX idx_direct_messages_created_at ON direct_messages(created_at);

-------------------------------------------------------------------------------------------------------------
-- Speeds up filtering/joining posts by the club they belong to
CREATE INDEX IF NOT EXISTS idx_posts_club_id ON posts(club_id);
-- Speeds up joining posts to the author's profile data
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
-- Drastically speeds up ordering the feed chronologically 
-- The partial index (WHERE deleted_at IS NULL) saves space and speeds up queries that ignore deleted posts
CREATE INDEX IF NOT EXISTS idx_posts_active_created_at ON posts(created_at DESC) WHERE deleted_at IS NULL;
-- Speeds up fetching or counting comments for a specific post
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
-------------------------------------------------------------------------------------------------------------

-- Helper function: check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check Supabase JWT app_metadata claim first (fast path)
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'system_admin' THEN
    RETURN TRUE;
  END IF;

  -- Fallback: check the profiles table role column
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::TEXT = 'system_admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- Helper function: check if user is an approved member of a club
CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_members.club_id = is_club_member.club_id
      AND club_members.user_id = is_club_member.user_id
      AND club_members.status = 'approved'::join_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO authenticated;

-- Retrieve upcoming events for feed timeline
CREATE OR REPLACE FUNCTION public.get_upcoming_events_feed(user_uuid UUID)
RETURNS TABLE (
  title TEXT,
  date TIMESTAMPTZ,
  location TEXT,
  rsvp_count BIGINT,
  is_bookmarked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.title,
    e.start_date AS date,
    e.location,
    COALESCE((
      SELECT COUNT(*) 
      FROM public.event_rsvps r 
      WHERE r.event_id = e.id
    ), 0)::BIGINT AS rsvp_count,
    COALESCE(EXISTS(
      SELECT 1 
      FROM public.saved_events s 
      WHERE s.event_id = e.id AND s.user_id = user_uuid
    ), false) AS is_bookmarked
  FROM public.events e
  WHERE e.start_date >= NOW()
    AND e.status != 'canceled'
  ORDER BY e.start_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_events_feed(UUID) TO authenticated;
-- 3. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_co_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- event_co_hosts policies
CREATE POLICY "Co-hosts are viewable by everyone." ON event_co_hosts FOR SELECT USING (true);
CREATE POLICY "Primary club admins can add co-hosts." ON event_co_hosts FOR INSERT WITH CHECK (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id) AND created_by = auth.uid())
);
CREATE POLICY "Primary club admins can delete co-hosts." ON event_co_hosts FOR DELETE USING (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_co_hosts.event_id) AND created_by = auth.uid())
);

CREATE POLICY "System admins can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (public.is_system_admin());

-- profiles: users can read all, update only their own row (with restrictions)
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile (safe fields only)." ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    -- Allow updates only if role is NOT being changed
    -- or if the user is a system admin
    (OLD.role IS NOT DISTINCT FROM NEW.role)
    OR public.is_system_admin()
  )
);
CREATE POLICY "System admins can update any profile." ON profiles
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- clubs: public clubs visible to everyone, private clubs visible only to approved members and the creator
CREATE POLICY "Clubs are viewable by everyone." ON clubs FOR SELECT USING (
  visibility = 'public'
  OR public.is_club_member(id, auth.uid())
  OR auth.uid() = created_by
);
CREATE POLICY "Users can create clubs." ON clubs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Club admins can update clubs." ON clubs FOR UPDATE USING (
  auth.uid() = created_by OR 
  public.is_club_admin(id, auth.uid())
);

-- club_members: members can read their club's list, only club admins can approve/change roles
CREATE POLICY "Anyone can read club members." ON club_members FOR SELECT USING (true);
CREATE POLICY "Users can request to join." ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave club." ON club_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update members." ON club_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members admin_members WHERE admin_members.club_id = club_members.club_id AND admin_members.user_id = auth.uid() AND admin_members.role = 'admin' AND admin_members.status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND created_by = auth.uid())
);

-- event_categories: public read, only system admins or verified club admins can insert
CREATE POLICY "Event categories are viewable by everyone." ON event_categories FOR SELECT USING (true);
CREATE POLICY "System admins and verified club admins can insert event categories." ON event_categories FOR INSERT TO authenticated WITH CHECK (public.is_system_admin() OR public.is_verified_club_admin());
CREATE POLICY "System admins can update event categories." ON event_categories FOR UPDATE TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());
CREATE POLICY "System admins can delete event categories." ON event_categories FOR DELETE TO authenticated USING (public.is_system_admin());

-- events: public read for public clubs, private club events visible only to approved members and the creator
CREATE POLICY "Events are viewable by everyone." ON events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = events.club_id
      AND (
        clubs.visibility = 'public'
        OR public.is_club_member(clubs.id, auth.uid())
        OR auth.uid() = clubs.created_by
      )
  )
);
CREATE POLICY "Club admins can insert events." ON events FOR INSERT WITH CHECK (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
);
CREATE POLICY "Club admins can update events." ON events FOR UPDATE USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.event_co_hosts ech
    WHERE ech.event_id = events.id
      AND public.is_club_admin(ech.club_id, auth.uid())
  )
);

-- event_rsvps: users can create/read their own RSVPs, club admins can read all for their events
CREATE POLICY "Users can read own RSVPs." ON event_rsvps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Club admins can read all RSVPs." ON event_rsvps FOR SELECT USING (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_rsvps.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);
CREATE POLICY "Users can RSVP." ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their RSVP." ON event_rsvps FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Club admins can update RSVPs (check in)." ON event_rsvps FOR UPDATE USING (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_rsvps.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);

-- posts/comments: club members can read/write within their club, authors/admins can edit/soft-delete their own
CREATE POLICY "Anyone can read posts." ON posts FOR SELECT USING (deleted_at IS NULL OR public.is_system_admin());
CREATE POLICY "Club members can insert posts." ON posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = posts.club_id AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = posts.club_id AND created_by = auth.uid())
);
CREATE POLICY "Authors or system admins can update posts." ON posts FOR UPDATE USING (auth.uid() = author_id OR public.is_system_admin());
CREATE POLICY "System admins can delete posts." ON posts FOR DELETE USING (public.is_system_admin());

CREATE POLICY "Anyone can read comments." ON comments FOR SELECT USING (deleted_at IS NULL OR public.is_system_admin());
CREATE POLICY "Club members can insert comments." ON comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = (SELECT club_id FROM posts WHERE id = comments.post_id) AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM posts WHERE id = comments.post_id) AND created_by = auth.uid())
);
CREATE POLICY "Authors or club admins or system admins can update comments." ON comments FOR UPDATE USING (
  auth.uid() = author_id OR
  public.is_system_admin() OR
  public.is_club_admin((SELECT club_id FROM posts WHERE id = comments.post_id), auth.uid()) OR
  EXISTS (
    SELECT 1 FROM clubs
    WHERE id = (SELECT club_id FROM posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);
CREATE POLICY "System admins can delete comments." ON comments FOR DELETE USING (public.is_system_admin());

-- certificates: users can read only their own
CREATE POLICY "Users can read own certificates." ON certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert certificates." ON certificates FOR INSERT WITH CHECK (true);

-- saved_events: users can manage their own saved events/bookmarks
CREATE POLICY "Users can read own saved events." ON saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events." ON saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events." ON saved_events FOR DELETE USING (auth.uid() = user_id);

-- notifications: users can read, update, and delete their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- user_public_keys: E2EE public keys are readable by all authenticated users; owners can insert/update their own
CREATE POLICY "Public keys are readable by authenticated users." ON user_public_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own public key." ON user_public_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own public key." ON user_public_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- direct_messages: E2EE ciphertext only visible to sender and receiver; only sender can insert
CREATE POLICY "Users can view direct messages sent by or to them." ON direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send direct messages." ON direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- saved_events: users can manage their own saved events/bookmarks
CREATE POLICY "Users can read own saved events." ON saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events." ON saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events." ON saved_events FOR DELETE USING (auth.uid() = user_id);

-- polls: anyone can read, only event organizer can insert/update
CREATE POLICY "Polls are viewable by everyone." ON polls FOR SELECT USING (true);
CREATE POLICY "Event organizers can create polls." ON polls FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
    EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
  )
);
CREATE POLICY "Event organizers can manage polls." ON polls FOR UPDATE USING (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
) WITH CHECK (
  public.is_club_admin((SELECT club_id FROM events WHERE id = event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_id) AND created_by = auth.uid())
);

-- poll_options: anyone can read, only poll creator can insert/delete
CREATE POLICY "Poll options are viewable by everyone." ON poll_options FOR SELECT USING (true);
CREATE POLICY "Poll creators can insert options." ON poll_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_id AND polls.created_by = auth.uid())
);
CREATE POLICY "Poll creators can delete options." ON poll_options FOR DELETE USING (
  EXISTS (SELECT 1 FROM polls WHERE polls.id = poll_id AND polls.created_by = auth.uid())
);

-- poll_votes: users can read all votes, insert own, delete own
CREATE POLICY "Poll votes are viewable by everyone." ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can cast their own vote." ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own vote." ON poll_votes FOR DELETE USING (auth.uid() = user_id);

-- saved_events: users can manage their own saved events/bookmarks
CREATE POLICY "Users can read own saved events." ON saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events." ON saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events." ON saved_events FOR DELETE USING (auth.uid() = user_id);

-- saved_events: users can manage their own saved events/bookmarks
CREATE POLICY "Users can read own saved events." ON saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events." ON saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events." ON saved_events FOR DELETE USING (auth.uid() = user_id);

-- 4. Triggers
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';

  -- Prefer first_name/last_name from metadata; fall back to splitting full_name
  IF v_first_name IS NULL OR v_first_name = '' THEN
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      IF POSITION(' ' IN v_full_name) > 0 THEN
        v_first_name := SUBSTRING(v_full_name FROM 1 FOR POSITION(' ' IN v_full_name) - 1);
        v_last_name := SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1);
      ELSE
        v_first_name := v_full_name;
      END IF;
    ELSE
      v_first_name := 'User';
      v_last_name := '';
    END IF;
  END IF;

  IF v_last_name IS NULL THEN
    v_last_name := '';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, avatar_url)
  VALUES (new.id, v_first_name, v_last_name, new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enforce RSVP capacity limits
CREATE OR REPLACE FUNCTION public.check_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Fetch the max_attendees for the event being RSVP'd to.
  -- If max_attendees is NULL, the event has unlimited capacity.
  SELECT max_attendees
  INTO v_max_attendees
  FROM public.events
  WHERE id = NEW.event_id;

  -- Only enforce capacity if a limit is set
  IF v_max_attendees IS NOT NULL THEN
    -- Count existing RSVPs for this event
    SELECT COUNT(*)
    INTO v_current_count
    FROM public.event_rsvps
    WHERE event_id = NEW.event_id;

    -- Raise an exception if at or over capacity
    IF v_current_count >= v_max_attendees THEN
      RAISE EXCEPTION 'Event has reached its maximum capacity of % attendees.', v_max_attendees
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_rsvp_insert
BEFORE INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_event_capacity();

-- Auto-notify RSVP'd attendees on event cancellation
CREATE OR REPLACE FUNCTION public.handle_event_cancellation()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT 
    rsvp.user_id,
    'event',
    'Event Canceled',
    'Event ' || NEW.title || ' has been canceled by the organizer.',
    '/events/' || NEW.id
  FROM public.event_rsvps rsvp
  WHERE rsvp.event_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_event_canceled
  AFTER UPDATE ON public.events
  FOR EACH ROW
  WHEN (NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled')
  EXECUTE PROCEDURE public.handle_event_cancellation();

-- Promote waitlist attendee after RSVP cancellation trigger (#587)
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
BEGIN
    SELECT w.id, w.event_id, w.user_id INTO next_waitlist_record
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = OLD.event_id
    ORDER BY
        CASE WHEN p.role = 'Premium' THEN 1 ELSE 2 END ASC,
        w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER tr_promote_waitlist_on_rsvp_cancel
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_attendee();

-- Prevent non-admins from pinning discussion posts
CREATE OR REPLACE FUNCTION public.check_post_pin_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pinned = TRUE THEN
    -- Verify the user is an admin of the corresponding club or the club owner
    IF NOT (
      public.is_club_admin(NEW.club_id, auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = NEW.club_id AND created_by = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'Only club administrators can pin posts.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER before_post_pin_check
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.check_post_pin_permission();

-- Auto-complete past events function (#589)
CREATE OR REPLACE FUNCTION public.auto_complete_past_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET status = 'completed',
      updated_at = NOW()
  WHERE status = 'scheduled'
    AND COALESCE(end_date, start_date, event_date) < NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_complete_past_events() TO authenticated, service_role;

-- Comment rate limiter trigger function and trigger
CREATE OR REPLACE FUNCTION public.check_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_count INTEGER;
BEGIN
  -- Count comments created by the currently authenticated user in the past 60 seconds
  SELECT COUNT(*)
  INTO v_comment_count
  FROM public.comments
  WHERE author_id = auth.uid()
    AND created_at >= NOW() - INTERVAL '1 minute';

  -- Abort insert if count is >= 15
  IF v_comment_count >= 15 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded. You can only post 15 comments per minute.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_comment_insert
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.check_comment_rate_limit();

-- Post like count triggers on post_reactions and likes
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
    v_post_id := COALESCE(NEW.entity_id, OLD.entity_id);
  ELSE
    v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  END IF;

  UPDATE posts
  SET like_count = (
    (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id) +
    (SELECT COUNT(*) FROM likes WHERE entity_type = 'post' AND entity_id = v_post_id)
  )
  WHERE id = v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_post_reactions_insert
AFTER INSERT ON post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

CREATE TRIGGER trg_post_reactions_delete
AFTER DELETE ON post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

CREATE TRIGGER trg_likes_insert
AFTER INSERT ON likes
FOR EACH ROW
WHEN (NEW.entity_type = 'post')
EXECUTE FUNCTION public.update_post_like_count();

CREATE TRIGGER trg_likes_delete
AFTER DELETE ON likes
FOR EACH ROW
WHEN (OLD.entity_type = 'post')
EXECUTE FUNCTION public.update_post_like_count();



CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_clubs
BEFORE UPDATE ON clubs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_events
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_posts
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_comments
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Trigger to cascade soft-delete to user's posts & comments on profile deletion
CREATE OR REPLACE FUNCTION public.handle_profile_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET deleted_at = NOW()
  WHERE author_id = OLD.id;

  UPDATE public.comments
  SET deleted_at = NOW()
  WHERE author_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_profile_soft_delete_cascade
BEFORE DELETE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_soft_delete_cascade();

-- Trigger function to request chat message moderation
CREATE OR REPLACE FUNCTION public.handle_new_chat_message_moderation()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/chat-moderation';
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'chat_messages',
        'record', jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'sender_id', NEW.sender_id,
            'receiver_id', NEW.receiver_id,
            'created_at', NEW.created_at
        )
    );

    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_chat_message_created_moderation
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_chat_message_moderation();

-- ------------------------------------------------------------
-- 5. Storage Buckets & Policies
-- ------------------------------------------------------------

-- Create public buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('club-banners', 'club-banners', true),
  ('event-banners', 'event-banners', true),
  ('certificates', 'certificates', true),
  ('qrcodes', 'qrcodes', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Create private club-documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-documents', 'club-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- Remove existing policies if they already exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- Public read access
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates',
    'qrcodes'
  )
);

-- Authenticated users can upload only to their own folder
CREATE POLICY "Users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates',
    'qrcodes'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can overwrite/update only their own files
CREATE POLICY "Users can update own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates',
    'qrcodes'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates',
    'qrcodes'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete only their own files
CREATE POLICY "Users can delete own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates',
    'qrcodes'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ------------------------------------------------------------
-- 6. Event Short ID Generation
-- ------------------------------------------------------------

-- Create sequence for event short IDs
CREATE SEQUENCE IF NOT EXISTS event_short_seq
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

-- Create trigger function to generate short_id
CREATE OR REPLACE FUNCTION generate_event_short_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate short_id if it's NULL
  IF NEW.short_id IS NULL THEN
    NEW.short_id := 'EVT-' || 
                    EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
                    LPAD(nextval('event_short_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trg_generate_event_short_id ON events;
CREATE TRIGGER trg_generate_event_short_id
BEFORE INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION generate_event_short_id();

-- ------------------------------------------------------------
-- 7. Realtime
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE saved_events;
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- Backfill any missing profiles for existing authenticated users
INSERT INTO public.profiles (id, first_name, last_name, avatar_url)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'first_name',
    CASE
      WHEN raw_user_meta_data->>'full_name' IS NOT NULL AND raw_user_meta_data->>'full_name' != ''
      THEN SUBSTRING(raw_user_meta_data->>'full_name' FROM 1 FOR POSITION(' ' IN raw_user_meta_data->>'full_name') - 1)
      ELSE 'User'
    END
  ),
  COALESCE(
    raw_user_meta_data->>'last_name',
    CASE
      WHEN raw_user_meta_data->>'full_name' IS NOT NULL AND raw_user_meta_data->>'full_name' != ''
        AND POSITION(' ' IN raw_user_meta_data->>'full_name') > 0
      THEN SUBSTRING(raw_user_meta_data->>'full_name' FROM POSITION(' ' IN raw_user_meta_data->>'full_name') + 1)
      ELSE ''
    END
  ),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 8. PostGIS Geospatial Queries (#1860)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_events_location_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location_geo := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_events_location_geo ON public.events;
CREATE TRIGGER trg_sync_events_location_geo
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_events_location_geo();

CREATE OR REPLACE FUNCTION public.get_events_nearby(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 8046.72
)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    category_id UUID,
    title TEXT,
    description TEXT,
    banner_url TEXT,
    event_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    max_attendees INTEGER,
    available_spots INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_geo GEOGRAPHY := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.club_id,
        e.category_id,
        e.title,
        e.description,
        e.banner_url,
        e.event_date,
        e.start_date,
        e.end_date,
        e.location,
        e.latitude,
        e.longitude,
        e.max_attendees,
        e.available_spots,
        e.status,
        e.created_at,
        ST_Distance(
            COALESCE(e.location_geo, ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography),
            user_geo
        ) AS distance_meters
    FROM public.events e
    WHERE (e.location_geo IS NOT NULL OR (e.latitude IS NOT NULL AND e.longitude IS NOT NULL))
      AND ST_DWithin(
          COALESCE(e.location_geo, ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography),
          user_geo,
          radius_meters
      )
    ORDER BY distance_meters ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_events_nearby(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon;


-- ============================================================
-- 10. Club Audit Logs & Triggers (Added for #1952)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.club_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.audit_club_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    old_json JSONB := '{}'::jsonb;
    new_json JSONB := '{}'::jsonb;
    has_changes BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- 1. name
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            old_json := old_json || jsonb_build_object('name', OLD.name);
            new_json := new_json || jsonb_build_object('name', NEW.name);
            has_changes := TRUE;
        END IF;

        -- 2. slug
        IF OLD.slug IS DISTINCT FROM NEW.slug THEN
            old_json := old_json || jsonb_build_object('slug', OLD.slug);
            new_json := new_json || jsonb_build_object('slug', NEW.slug);
            has_changes := TRUE;
        END IF;

        -- 3. description
        IF OLD.description IS DISTINCT FROM NEW.description THEN
            old_json := old_json || jsonb_build_object('description', OLD.description);
            new_json := new_json || jsonb_build_object('description', NEW.description);
            has_changes := TRUE;
        END IF;

        -- 4. banner_url
        IF OLD.banner_url IS DISTINCT FROM NEW.banner_url THEN
            old_json := old_json || jsonb_build_object('banner_url', OLD.banner_url);
            new_json := new_json || jsonb_build_object('banner_url', NEW.banner_url);
            has_changes := TRUE;
        END IF;

        -- 5. logo_url
        IF OLD.logo_url IS DISTINCT FROM NEW.logo_url THEN
            old_json := old_json || jsonb_build_object('logo_url', OLD.logo_url);
            new_json := new_json || jsonb_build_object('logo_url', NEW.logo_url);
            has_changes := TRUE;
        END IF;

        -- 6. github_repo_url
        IF OLD.github_repo_url IS DISTINCT FROM NEW.github_repo_url THEN
            old_json := old_json || jsonb_build_object('github_repo_url', OLD.github_repo_url);
            new_json := new_json || jsonb_build_object('github_repo_url', NEW.github_repo_url);
            has_changes := TRUE;
        END IF;

        -- 7. visibility
        IF OLD.visibility IS DISTINCT FROM NEW.visibility THEN
            old_json := old_json || jsonb_build_object('visibility', OLD.visibility);
            new_json := new_json || jsonb_build_object('visibility', NEW.visibility);
            has_changes := TRUE;
        END IF;

        -- 8. social_links
        IF OLD.social_links IS DISTINCT FROM NEW.social_links THEN
            old_json := old_json || jsonb_build_object('social_links', OLD.social_links);
            new_json := new_json || jsonb_build_object('social_links', NEW.social_links);
            has_changes := TRUE;
        END IF;

        IF has_changes THEN
            INSERT INTO public.club_audit_logs (club_id, action_type, old_data, new_data)
            VALUES (NEW.id, 'UPDATE', old_json, new_json);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clubs_audit_trigger ON public.clubs;
CREATE TRIGGER clubs_audit_trigger
    AFTER UPDATE ON public.clubs
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_club_changes();

ALTER TABLE public.club_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can read club audit logs"
ON public.club_audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'system_admin'::public.user_role
    )
);

GRANT ALL ON TABLE public.club_audit_logs TO postgres;
GRANT SELECT ON TABLE public.club_audit_logs TO authenticated;


-- Backfill any missing profiles for existing authenticated users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast trigram prefix matching and typo tolerance
CREATE INDEX IF NOT EXISTS clubs_name_trgm_idx ON public.clubs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clubs_description_trgm_idx ON public.clubs USING gin (description gin_trgm_ops);

-- Create the RPC search function
CREATE OR REPLACE FUNCTION public.search_clubs(search_term TEXT)
RETURNS SETOF public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set pg_trgm.similarity_threshold to 0.3 as requested
  PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);
  
  RETURN QUERY
    SELECT *
    FROM public.clubs
    WHERE name % search_term OR description % search_term
    ORDER BY similarity(name, search_term) DESC;
END;
$$;
