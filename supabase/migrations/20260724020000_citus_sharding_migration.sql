-- Enable Citus extension
CREATE EXTENSION IF NOT EXISTS citus;

-- ==========================================
-- 1. Setup Reference Tables (Lookup / Global tables)
-- ==========================================

-- Drop foreign key constraint referencing auth.users if it exists to allow distribution
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Make profiles and event_categories reference tables (replicated to all nodes)
SELECT create_reference_table('public.profiles');
SELECT create_reference_table('public.event_categories');


-- ==========================================
-- 2. Add club_id Column to Distributed Child Tables
-- ==========================================

ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.event_waitlist ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.post_reactions ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.saved_events ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS club_id UUID;


-- ==========================================
-- 3. Backfill club_id from Parent Tables
-- ==========================================

UPDATE public.event_rsvps r
SET club_id = e.club_id
FROM public.events e
WHERE r.event_id = e.id AND r.club_id IS NULL;

UPDATE public.event_waitlist w
SET club_id = e.club_id
FROM public.events e
WHERE w.event_id = e.id AND w.club_id IS NULL;

UPDATE public.post_likes pl
SET club_id = p.club_id
FROM public.posts p
WHERE pl.post_id = p.id AND pl.club_id IS NULL;

UPDATE public.post_reactions pr
SET club_id = p.club_id
FROM public.posts p
WHERE pr.post_id = p.id AND pr.club_id IS NULL;

UPDATE public.comments c
SET club_id = p.club_id
FROM public.posts p
WHERE c.post_id = p.id AND c.club_id IS NULL;

UPDATE public.saved_events se
SET club_id = e.club_id
FROM public.events e
WHERE se.event_id = e.id AND se.club_id IS NULL;

UPDATE public.certificates cert
SET club_id = e.club_id
FROM public.events e
WHERE cert.event_id = e.id AND cert.club_id IS NULL;

-- Remove orphaned data that lacks a parent club mapping
DELETE FROM public.event_rsvps WHERE club_id IS NULL;
DELETE FROM public.event_waitlist WHERE club_id IS NULL;
DELETE FROM public.post_likes WHERE club_id IS NULL;
DELETE FROM public.post_reactions WHERE club_id IS NULL;
DELETE FROM public.comments WHERE club_id IS NULL;
DELETE FROM public.saved_events WHERE club_id IS NULL;
DELETE FROM public.certificates WHERE club_id IS NULL;

-- Set columns to NOT NULL
ALTER TABLE public.event_rsvps ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.event_waitlist ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.post_likes ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.post_reactions ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.comments ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.saved_events ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.certificates ALTER COLUMN club_id SET NOT NULL;


-- ==========================================
-- 4. Drop Old Primary Keys, Foreign Keys, and Unique Constraints
-- ==========================================

-- club_members
ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_pkey;

-- club_roles
ALTER TABLE public.club_roles DROP CONSTRAINT IF EXISTS club_roles_pkey;

-- club_invite_codes
ALTER TABLE public.club_invite_codes DROP CONSTRAINT IF EXISTS club_invite_codes_pkey;
ALTER TABLE public.club_invite_codes DROP CONSTRAINT IF EXISTS club_invite_codes_code_key;

-- events
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_pkey;

-- event_co_hosts
ALTER TABLE public.event_co_hosts DROP CONSTRAINT IF EXISTS event_co_hosts_event_id_fkey;

-- event_rsvps
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_pkey;
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_fkey;
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_user_id_key;

-- event_waitlist
ALTER TABLE public.event_waitlist DROP CONSTRAINT IF EXISTS event_waitlist_pkey;
ALTER TABLE public.event_waitlist DROP CONSTRAINT IF EXISTS event_waitlist_event_id_fkey;
ALTER TABLE public.event_waitlist DROP CONSTRAINT IF EXISTS event_waitlist_event_id_user_id_key;

-- posts
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_pkey;

-- post_likes
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_pkey;
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_user_id_key;

-- post_reactions
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_pkey;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_fkey;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_emoji_key;

-- comments
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_pkey;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;

-- saved_events
ALTER TABLE public.saved_events DROP CONSTRAINT IF EXISTS saved_events_pkey;
ALTER TABLE public.saved_events DROP CONSTRAINT IF EXISTS saved_events_event_id_fkey;
ALTER TABLE public.saved_events DROP CONSTRAINT IF EXISTS saved_events_event_id_user_id_key;

-- certificates
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_pkey;
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_event_id_fkey;


-- ==========================================
-- 5. Recreate Primary Keys & Unique Constraints with club_id
-- ==========================================

ALTER TABLE public.club_members ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.club_roles ADD PRIMARY KEY (id, club_id);

ALTER TABLE public.club_invite_codes ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.club_invite_codes ADD CONSTRAINT club_invite_codes_code_club_id_key UNIQUE (code, club_id);

ALTER TABLE public.events ADD PRIMARY KEY (id, club_id);

ALTER TABLE public.event_rsvps ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_event_id_user_id_club_id_key UNIQUE (event_id, user_id, club_id);

ALTER TABLE public.event_waitlist ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.event_waitlist ADD CONSTRAINT event_waitlist_event_id_user_id_club_id_key UNIQUE (event_id, user_id, club_id);

ALTER TABLE public.posts ADD PRIMARY KEY (id, club_id);

ALTER TABLE public.post_likes ADD PRIMARY KEY (post_id, user_id, club_id);

ALTER TABLE public.post_reactions ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_emoji_club_id_key UNIQUE (post_id, user_id, emoji, club_id);

ALTER TABLE public.comments ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.saved_events ADD PRIMARY KEY (id, club_id);
ALTER TABLE public.saved_events ADD CONSTRAINT saved_events_event_id_user_id_club_id_key UNIQUE (event_id, user_id, club_id);

ALTER TABLE public.certificates ADD PRIMARY KEY (id, club_id);


-- ==========================================
-- 6. Recreate Composite Foreign Keys referencing Distributed Tables
-- ==========================================

ALTER TABLE public.event_co_hosts ADD CONSTRAINT event_co_hosts_event_id_club_id_fkey FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_event_id_club_id_fkey FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.event_waitlist ADD CONSTRAINT event_waitlist_event_id_club_id_fkey FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_club_id_fkey FOREIGN KEY (post_id, club_id) REFERENCES public.posts (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_post_id_club_id_fkey FOREIGN KEY (post_id, club_id) REFERENCES public.posts (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_post_id_club_id_fkey FOREIGN KEY (post_id, club_id) REFERENCES public.posts (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.saved_events ADD CONSTRAINT saved_events_event_id_club_id_fkey FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE;
ALTER TABLE public.certificates ADD CONSTRAINT certificates_event_id_club_id_fkey FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE;


-- ==========================================
-- 7. Distribute all tables across worker shards
-- ==========================================

SELECT create_distributed_table('public.clubs', 'id');
SELECT create_distributed_table('public.club_members', 'club_id');
SELECT create_distributed_table('public.club_roles', 'club_id');
SELECT create_distributed_table('public.club_invite_codes', 'club_id');
SELECT create_distributed_table('public.events', 'club_id');
SELECT create_distributed_table('public.event_co_hosts', 'club_id');
SELECT create_distributed_table('public.event_rsvps', 'club_id');
SELECT create_distributed_table('public.event_waitlist', 'club_id');
SELECT create_distributed_table('public.posts', 'club_id');
SELECT create_distributed_table('public.post_likes', 'club_id');
SELECT create_distributed_table('public.post_reactions', 'club_id');
SELECT create_distributed_table('public.comments', 'club_id');
SELECT create_distributed_table('public.saved_events', 'club_id');
SELECT create_distributed_table('public.certificates', 'club_id');


-- ==========================================
-- 8. Setup Auto-Population Triggers for club_id
-- ==========================================

CREATE OR REPLACE FUNCTION public.fn_populate_club_id_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.events WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_populate_club_id_from_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.posts WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Add triggers to event child tables
CREATE TRIGGER trg_populate_rsvp_club_id
  BEFORE INSERT ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_event();

CREATE TRIGGER trg_populate_waitlist_club_id
  BEFORE INSERT ON public.event_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_event();

CREATE TRIGGER trg_populate_saved_event_club_id
  BEFORE INSERT ON public.saved_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_event();

CREATE TRIGGER trg_populate_certificate_club_id
  BEFORE INSERT ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_event();

-- Add triggers to post child tables
CREATE TRIGGER trg_populate_post_like_club_id
  BEFORE INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_post();

CREATE TRIGGER trg_populate_post_reaction_club_id
  BEFORE INSERT ON public.post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_post();

CREATE TRIGGER trg_populate_comment_club_id
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_club_id_from_post();
