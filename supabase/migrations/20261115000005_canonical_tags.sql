-- =============================================================================
-- Migration: Automated "Event Tag" Standardization
-- Issue: #3711 - Implement 'Automated "Event Tag" Standardization'
-- Description: Maintains a canonical tag dictionary with aliases. Novel tags
-- that fail fuzzy matching are queued for admin review instead of polluting
-- the taxonomy.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Canonical tag dictionary
CREATE TABLE IF NOT EXISTS public.canonical_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_name TEXT NOT NULL UNIQUE,
    aliases TEXT [] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 2. Pending novel tags awaiting admin approval
CREATE TABLE IF NOT EXISTS public.pending_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_tag TEXT NOT NULL,
    suggested_by UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        context_event_id UUID REFERENCES public.events(id) ON DELETE
    SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (raw_tag)
);
-- GIN indexes for fast alias/term lookups
CREATE INDEX IF NOT EXISTS idx_canonical_tags_aliases ON public.canonical_tags USING GIN (aliases);
-- Seed a few canonical tags + aliases
INSERT INTO public.canonical_tags (tag_name, aliases)
VALUES (
        'Computer Science',
        ARRAY ['cs', 'compsci', 'software', 'programming', 'coding']
    ),
    (
        'Engineering',
        ARRAY ['eng', 'mech', 'mechanical', 'electrical']
    ),
    (
        'Art',
        ARRAY ['arts', 'fine arts', 'design', 'creative']
    ),
    (
        'Business',
        ARRAY ['biz', 'finance', 'entrepreneurship', 'startup']
    ),
    ('Music', ARRAY ['band', 'concert', 'audio']) ON CONFLICT (tag_name) DO NOTHING;
ALTER TABLE public.canonical_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_tags ENABLE ROW LEVEL SECURITY;
-- Dictionary is public read; only admins write
CREATE POLICY "Public read canonical tags" ON public.canonical_tags FOR
SELECT USING (true);
CREATE POLICY "Admins manage canonical tags" ON public.canonical_tags FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
CREATE POLICY "Authenticated users queue pending tags" ON public.pending_tags FOR
INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins review pending tags" ON public.pending_tags FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'admin'
    )
);
