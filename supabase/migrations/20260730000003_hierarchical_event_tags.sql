-- Migration: 20260730000000_hierarchical_event_tags.sql
-- Description: Implement hierarchical event tags using ltree

-- 1. Enable ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    path ltree PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create event_tags associative table
CREATE TABLE IF NOT EXISTS public.event_tags (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    tag_path ltree REFERENCES public.tags(path) ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_path)
);

-- 4. Create GiST index on tags path
CREATE INDEX IF NOT EXISTS idx_tags_path_gist ON public.tags USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag_path ON public.event_tags(tag_path);
CREATE INDEX IF NOT EXISTS idx_event_tags_event_id ON public.event_tags(event_id);

-- 5. Helper function to normalize tags (ltree labels must be A-Za-z0-9_)
CREATE OR REPLACE FUNCTION public.normalize_ltree_tag(raw_tag TEXT)
RETURNS ltree AS $$
BEGIN
    -- Replace non-alphanumeric characters with underscores
    -- Keep periods as they are path separators in ltree
    RETURN NULLIF(regexp_replace(regexp_replace(raw_tag, '[^A-Za-z0-9_.]+', '_', 'g'), '^_+|_+$', '', 'g'), '')::ltree;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. RPC to sync tags for an event
CREATE OR REPLACE FUNCTION public.sync_event_tags(p_event_id UUID, p_tags TEXT[])
RETURNS void AS $$
DECLARE
    t TEXT;
    norm_tag ltree;
BEGIN
    -- Delete existing tags for this event
    DELETE FROM public.event_tags WHERE event_id = p_event_id;

    IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Insert new tags
    FOREACH t IN ARRAY p_tags
    LOOP
        norm_tag := public.normalize_ltree_tag(t);
        IF norm_tag IS NOT NULL THEN
            INSERT INTO public.tags (path) VALUES (norm_tag) ON CONFLICT (path) DO NOTHING;
            INSERT INTO public.event_tags (event_id, tag_path) VALUES (p_event_id, norm_tag) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger function to automatically sync tags on insert or update
CREATE OR REPLACE FUNCTION public.trg_sync_event_tags()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.tags IS DISTINCT FROM OLD.tags THEN
        PERFORM public.sync_event_tags(NEW.id, NEW.tags);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_event_tags_after_insert_update
AFTER INSERT OR UPDATE OF tags ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_event_tags();

-- 8. Migrate existing data from events.tags TEXT[]
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, tags FROM public.events WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    LOOP
        PERFORM public.sync_event_tags(r.id, r.tags);
    END LOOP;
END;
$$;

-- 9. RPC to get events by a tag (hierarchical search)
CREATE OR REPLACE FUNCTION public.get_events_by_tag(target_path ltree)
RETURNS SETOF public.events AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM public.events e
    JOIN public.event_tags et ON e.id = et.event_id
    WHERE et.tag_path <@ target_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags are viewable by everyone" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Tags can be created by authenticated users" ON public.tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.event_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event tags are viewable by everyone" ON public.event_tags FOR SELECT USING (true);
CREATE POLICY "Users can manage tags for events they created" ON public.event_tags FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.events
        WHERE id = event_tags.event_id
        AND created_by = auth.uid()
    )
);

-- Grant permissions to PostgREST roles
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT SELECT ON public.event_tags TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_events_by_tag(ltree) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_event_tags(UUID, TEXT[]) TO authenticated;
