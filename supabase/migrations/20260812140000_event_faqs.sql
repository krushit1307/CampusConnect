-- Migration: 20260812140000_event_faqs.sql

CREATE TABLE IF NOT EXISTS public.event_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  asked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false NOT NULL,
  is_published BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_event_faqs_updated_at
BEFORE UPDATE ON public.event_faqs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_faqs_event_id ON public.event_faqs(event_id);
-- Enable pg_trgm for question similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_event_faqs_question_trgm ON public.event_faqs USING gin (question gin_trgm_ops);

-- RLS
ALTER TABLE public.event_faqs ENABLE ROW LEVEL SECURITY;

-- 1. Public can read published FAQs
DROP POLICY IF EXISTS "Published FAQs are viewable by everyone." ON public.event_faqs;
CREATE POLICY "Published FAQs are viewable by everyone." 
ON public.event_faqs FOR SELECT 
USING (is_published = true);

-- 2. Organizers can view all FAQs
DROP POLICY IF EXISTS "Organizers can view all FAQs." ON public.event_faqs;
CREATE POLICY "Organizers can view all FAQs." ON public.event_faqs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND created_by = auth.uid())
);

-- 3. Authenticated users can insert their own questions
DROP POLICY IF EXISTS "Authenticated users can ask questions." ON public.event_faqs;
CREATE POLICY "Authenticated users can ask questions." ON public.event_faqs FOR INSERT WITH CHECK (
  auth.uid() = asked_by
);

-- 4. Organizers can update FAQs (answer, publish, etc)
DROP POLICY IF EXISTS "Organizers can update FAQs." ON public.event_faqs;
CREATE POLICY "Organizers can update FAQs." ON public.event_faqs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND created_by = auth.uid())
);

-- 5. Organizers can delete FAQs
DROP POLICY IF EXISTS "Organizers can delete FAQs." ON public.event_faqs;
CREATE POLICY "Organizers can delete FAQs." ON public.event_faqs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_faqs.event_id) AND created_by = auth.uid())
);

-- RPC for fetching public FAQs safely masking anonymous users
CREATE OR REPLACE FUNCTION public.get_public_event_faqs(p_event_id UUID)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  question TEXT,
  answer TEXT,
  asked_by UUID,
  is_anonymous BOOLEAN,
  is_published BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  author_name TEXT,
  author_avatar TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.event_id,
    f.question,
    f.answer,
    CASE WHEN f.is_anonymous THEN NULL ELSE f.asked_by END as asked_by,
    f.is_anonymous,
    f.is_published,
    f.created_at,
    f.updated_at,
    CASE WHEN f.is_anonymous THEN 'Anonymous Attendee' ELSE COALESCE(p.full_name, 'Unknown User') END as author_name,
    CASE WHEN f.is_anonymous THEN NULL ELSE p.avatar_url END as author_avatar
  FROM public.event_faqs f
  LEFT JOIN public.profiles p ON p.id = f.asked_by
  WHERE f.event_id = p_event_id AND f.is_published = true
  ORDER BY f.created_at ASC;
$$;

-- RPC for finding duplicate FAQs
CREATE OR REPLACE FUNCTION public.find_similar_published_faqs(p_event_id UUID, p_question TEXT)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  similarity REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.question,
    f.answer,
    similarity(f.question, p_question) as similarity
  FROM public.event_faqs f
  WHERE f.event_id = p_event_id 
    AND f.is_published = true
    AND similarity(f.question, p_question) > 0.4
  ORDER BY similarity DESC
  LIMIT 3;
$$;
