-- 1. Create custom types
CREATE TYPE user_role AS ENUM ('student', 'club_admin');
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_category ON events(category_id);

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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  certificate_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- profiles: users can read all, update only their own row
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- clubs: public read, only club admins/creators can update
CREATE POLICY "Clubs are viewable by everyone." ON clubs FOR SELECT USING (true);
CREATE POLICY "Users can create clubs." ON clubs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Club admins can update clubs." ON clubs FOR UPDATE USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM club_members WHERE club_id = clubs.id AND user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);

-- club_members: members can read their club's list, only club admins can approve/change roles
CREATE POLICY "Anyone can read club members." ON club_members FOR SELECT USING (true);
CREATE POLICY "Users can request to join." ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave club." ON club_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update members." ON club_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members admin_members WHERE admin_members.club_id = club_members.club_id AND admin_members.user_id = auth.uid() AND admin_members.role = 'admin' AND admin_members.status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND created_by = auth.uid())
);

-- event_categories: public read
CREATE POLICY "Event categories are viewable by everyone." ON event_categories FOR SELECT USING (true);

-- events: public read, only club admins can create/edit
CREATE POLICY "Events are viewable by everyone." ON events FOR SELECT USING (true);
CREATE POLICY "Club admins can insert events." ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = events.club_id AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
);
CREATE POLICY "Club admins can update events." ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = events.club_id AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
);

-- event_rsvps: users can create/read their own RSVPs, club admins can read all for their events
CREATE POLICY "Users can read own RSVPs." ON event_rsvps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Club admins can read all RSVPs." ON event_rsvps FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);
CREATE POLICY "Users can RSVP." ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their RSVP." ON event_rsvps FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Club admins can update RSVPs (check in)." ON event_rsvps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
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
