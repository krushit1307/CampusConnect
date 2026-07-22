-- 1. Add the missing 'flagged' column to the posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.notify_admins_on_flagged_post()
RETURNS trigger AS $$
BEGIN
  -- Insert a notification for all club admins of the post's club
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT 
    cm.user_id,
    'alert',
    'Post Flagged for Moderation',
    'A post in your club has been flagged for review.',
    '/clubs/' || NEW.club_id || '/posts/' || NEW.id
  FROM public.club_members cm
  WHERE cm.club_id = NEW.club_id 
    AND cm.role = 'admin' 
    AND cm.status = 'approved';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create the trigger
CREATE OR REPLACE TRIGGER on_post_flagged
  AFTER UPDATE ON public.posts
  FOR EACH ROW
  WHEN (NEW.flagged = TRUE AND OLD.flagged = FALSE)
  EXECUTE PROCEDURE public.notify_admins_on_flagged_post();
