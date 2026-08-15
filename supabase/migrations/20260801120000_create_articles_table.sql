-- Migration: Create articles table and calculate_article_read_time trigger
-- Issue: #1964

CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- html rich text format
  read_time_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read articles." ON public.articles;
CREATE POLICY "Anyone can read articles."
  ON public.articles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Club admins can insert articles." ON public.articles;
CREATE POLICY "Club admins can insert articles."
  ON public.articles FOR INSERT
  WITH CHECK (
    public.is_club_member(club_id, auth.uid()) AND (
      public.is_club_admin(articles.club_id, auth.uid()) OR EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = articles.club_id
          AND created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authors or club admins can update articles." ON public.articles;
CREATE POLICY "Authors or club admins can update articles."
  ON public.articles FOR UPDATE
  USING (
    auth.uid() = author_id OR
    public.is_club_admin(articles.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = articles.club_id
        AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors or club admins can delete articles." ON public.articles;
CREATE POLICY "Authors or club admins can delete articles."
  ON public.articles FOR DELETE
  USING (
    auth.uid() = author_id OR
    public.is_club_admin(articles.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = articles.club_id
        AND created_by = auth.uid()
    )
  );

-- Trigger function for calculating read time estimation
CREATE OR REPLACE FUNCTION public.calculate_article_read_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  raw_text TEXT;
  word_count INTEGER;
  img_count INTEGER;
  image_seconds INTEGER;
  total_seconds DOUBLE PRECISION;
BEGIN
  -- 1. Strip all HTML tags using regexp
  raw_text := regexp_replace(NEW.content, '<[^>]*>', '', 'g');

  -- 2. Normalize whitespace (trim and replace multiple spaces/newlines with a single space)
  raw_text := regexp_replace(trim(raw_text), '\s+', ' ', 'g');

  -- 3. Split by spaces to count words
  IF raw_text = '' THEN
    word_count := 0;
  ELSE
    word_count := array_length(regexp_split_to_array(raw_text, '\s+'), 1);
  END IF;

  -- 4. Count <img> tags in the HTML string
  img_count := (length(NEW.content) - length(replace(lower(NEW.content), '<img', ''))) / 4;

  -- 5. Calculate image seconds buffer
  -- 12s for 1st image, 11s for 2nd, etc. down to 3s per image.
  image_seconds := 0;
  IF img_count > 0 THEN
    FOR i IN 1..img_count LOOP
      IF i <= 10 THEN
        image_seconds := image_seconds + (13 - i);
      ELSE
        image_seconds := image_seconds + 3;
      END IF;
    END LOOP;
  END IF;

  -- 6. Calculate total seconds: 225 words per minute = (word_count / 225.0) * 60 seconds
  total_seconds := (word_count::double precision / 225.0) * 60.0 + image_seconds;

  -- 7. Round up to nearest minute using ceil()
  NEW.read_time_minutes := ceil(total_seconds / 60.0)::integer;

  -- Ensure at least 1 min read if content is not completely empty
  IF NEW.read_time_minutes = 0 AND trim(NEW.content) <> '' THEN
    NEW.read_time_minutes := 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_calculate_article_read_time ON public.articles;
CREATE TRIGGER trigger_calculate_article_read_time
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_article_read_time();
