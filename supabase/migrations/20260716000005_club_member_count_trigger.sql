-- Clean up old triggers/functions if they exist
DROP TRIGGER IF EXISTS on_member_added ON public.club_members;
DROP TRIGGER IF EXISTS on_member_removed ON public.club_members;
DROP FUNCTION IF EXISTS public.increment_member_count();
DROP FUNCTION IF EXISTS public.decrement_member_count();

-- Add column to clubs table safely
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0;

-- Backfill existing member counts (only counting approved members)
UPDATE public.clubs c
SET member_count = (
  SELECT COALESCE(COUNT(*), 0)
  FROM public.club_members m
  WHERE m.club_id = c.id AND m.status = 'approved'
);

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_club_member_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.clubs
      SET member_count = member_count + 1
      WHERE id = NEW.club_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.club_id != NEW.club_id THEN
      IF OLD.status = 'approved' THEN
        UPDATE public.clubs
        SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = OLD.club_id;
      END IF;
      IF NEW.status = 'approved' THEN
        UPDATE public.clubs
        SET member_count = member_count + 1
        WHERE id = NEW.club_id;
      END IF;
    ELSE
      IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        UPDATE public.clubs
        SET member_count = member_count + 1
        WHERE id = NEW.club_id;
      ELSIF OLD.status = 'approved' AND NEW.status = 'pending' THEN
        UPDATE public.clubs
        SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = NEW.club_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      UPDATE public.clubs
      SET member_count = GREATEST(member_count - 1, 0)
      WHERE id = OLD.club_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create trigger
DROP TRIGGER IF EXISTS update_club_member_count ON public.club_members;
CREATE TRIGGER update_club_member_count
  AFTER INSERT OR UPDATE OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_member_change();
