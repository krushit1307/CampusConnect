-- Migration: 20260801000000_normalize_club_tags.sql
-- Description: Add strict relational tags for clubs (Many-to-Many)
-- Note: named "club_tag_labels" instead of "tags" to avoid colliding
-- with the existing public.tags table used for event ltree tags.

CREATE TABLE IF NOT EXISTS public.club_tag_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.club_tags (
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.club_tag_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_club_tags_tag_id ON public.club_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_club_tags_club_id ON public.club_tags(club_id);

ALTER TABLE public.club_tag_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club tag labels are viewable by everyone" ON public.club_tag_labels FOR SELECT USING (true);
CREATE POLICY "Club tag labels can be created by authenticated users" ON public.club_tag_labels FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.club_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club tags are viewable by everyone" ON public.club_tags FOR SELECT USING (true);
CREATE POLICY "Club admins can manage their club's tags" ON public.club_tags FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_tags.club_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
);

GRANT SELECT ON public.club_tag_labels TO anon, authenticated;
GRANT SELECT ON public.club_tags TO anon, authenticated;