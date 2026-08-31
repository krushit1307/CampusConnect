-- 20270123000001_democratic_song_requests.sql
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  organizer_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.song_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_art_url TEXT,
  upvotes INTEGER DEFAULT 0,
  requested_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.song_upvotes (
  song_request_id UUID REFERENCES public.song_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (song_request_id, user_id)
);

-- RLS Policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_upvotes ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update their events" ON public.events
  FOR UPDATE USING (auth.uid() = organizer_id);

-- Song requests policies
CREATE POLICY "Song requests are viewable by everyone" ON public.song_requests
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create song requests" ON public.song_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Song upvotes policies
CREATE POLICY "Upvotes are viewable by everyone" ON public.song_upvotes
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upvote" ON public.song_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their upvotes" ON public.song_upvotes
  FOR DELETE USING (auth.uid() = user_id);
