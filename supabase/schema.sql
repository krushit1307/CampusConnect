-- 1. Create custom types
CREATE TYPE user_role AS ENUM ('student', 'club_admin', 'system_admin');
CREATE TYPE member_role AS ENUM ('member', 'admin');
CREATE TYPE join_status AS ENUM ('pending', 'approved');

-- 2. Create tables
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  college TEXT,
  bio TEXT,
  role user_role DEFAULT 'student'::user_role,
  notification_preferences JSONB NOT NULL DEFAULT '{"rsvps": true, "digest": true, "certs": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles
ADD CONSTRAINT profiles_notification_preferences_valid
CHECK (
  jsonb_typeof(notification_preferences) = 'object'
  AND notification_preferences ? 'rsvps'
  AND notification_preferences ? 'digest'
  AND notification_preferences ? 'certs'
  AND jsonb_typeof(notification_preferences->'rsvps') = 'boolean'
  AND jsonb_typeof(notification_preferences->'digest') = 'boolean'
  AND jsonb_typeof(notification_preferences->'certs') = 'boolean'
);

CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member'::member_role,
  status join_status DEFAULT 'pending'::join_status,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

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
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  max_attendees INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events
ADD CONSTRAINT check_events_max_attendees
CHECK (
  max_attendees IS NULL OR max_attendees > 0
);

CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_events_start_date ON events(start_date);

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
CREATE INDEX idx_club_members_club_id
ON club_members(club_id);

CREATE INDEX idx_club_members_user_id
ON club_members(user_id);

CREATE INDEX idx_event_rsvps_event_id
ON event_rsvps(event_id);

CREATE INDEX idx_event_rsvps_user_id
ON event_rsvps(user_id);

CREATE INDEX idx_notifications_user_id
ON notifications(user_id);

CREATE INDEX idx_posts_club_id
ON posts(club_id);

CREATE INDEX idx_comments_post_id
ON comments(post_id);

CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in BOOLEAN DEFAULT FALSE,
  rsvp_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- profiles: users can read all, update only their own row
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- clubs: public read, only club admins/creators can update
CREATE POLICY "Clubs are viewable by everyone." ON clubs FOR SELECT USING (true);
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

-- event_categories: public read, only system admins can modify
CREATE POLICY "Event categories are viewable by everyone." ON event_categories FOR SELECT USING (true);
CREATE POLICY "System admins can insert event categories." ON event_categories FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());
CREATE POLICY "System admins can update event categories." ON event_categories FOR UPDATE TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());
CREATE POLICY "System admins can delete event categories." ON event_categories FOR DELETE TO authenticated USING (public.is_system_admin());

-- events: public read, only club admins can create/edit
CREATE POLICY "Events are viewable by everyone." ON events FOR SELECT USING (true);
CREATE POLICY "Club admins can insert events." ON events FOR INSERT WITH CHECK (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
);
CREATE POLICY "Club admins can update events." ON events FOR UPDATE USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
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

-- posts/comments: club members can read/write within their club, authors can edit/delete their own
CREATE POLICY "Anyone can read posts." ON posts FOR SELECT USING (true);
CREATE POLICY "Club members can insert posts." ON posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = posts.club_id AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = posts.club_id AND created_by = auth.uid())
);
CREATE POLICY "Authors can update own posts." ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own posts." ON posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Anyone can read comments." ON comments FOR SELECT USING (true);
CREATE POLICY "Club members can insert comments." ON comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = (SELECT club_id FROM posts WHERE id = comments.post_id) AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM posts WHERE id = comments.post_id) AND created_by = auth.uid())
);
CREATE POLICY "Authors can update own comments." ON comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own comments." ON comments FOR DELETE USING (auth.uid() = author_id);

-- certificates: users can read only their own
CREATE POLICY "Users can read own certificates." ON certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert certificates." ON certificates FOR INSERT WITH CHECK (true); -- Usually handled by edge functions / server

-- saved_events: users can manage their own saved events/bookmarks
CREATE POLICY "Users can read own saved events." ON saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events." ON saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events." ON saved_events FOR DELETE USING (auth.uid() = user_id);

-- notifications: users can read, update, and delete their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- 4. Triggers
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
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

  -- Abort insert if count is >= 5
  IF v_comment_count >= 5 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded. You can only post 5 comments per minute.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER before_comment_insert
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.check_comment_rate_limit();

-- ------------------------------------------------------------
-- 5. Storage Buckets & Policies
-- ------------------------------------------------------------

-- Create public buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('club-banners', 'club-banners', true),
  ('event-banners', 'event-banners', true),
  ('certificates', 'certificates', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

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
    'certificates'
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
    'certificates'
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
    'certificates'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates'
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
    'certificates'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ------------------------------------------------------------
-- 6. Realtime
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE saved_events;

-- Backfill any missing profiles for existing authenticated users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
