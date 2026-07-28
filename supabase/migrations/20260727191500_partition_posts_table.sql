-- Migration: Convert posts table to partition by range on created_at (monthly)

-- 1. Drop foreign key constraints from child tables referencing posts
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_fkey;

-- 2. Rename old table
ALTER TABLE public.posts RENAME TO posts_old;

-- 3. Create partitioned table
CREATE TABLE public.posts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 4. Create partition generator function
CREATE OR REPLACE FUNCTION public.create_post_partition(target_date TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_name := 'posts_' || to_char(target_date, 'YYYY_MM');
    start_date := to_char(date_trunc('month', target_date), 'YYYY-MM-01');
    end_date := to_char(date_trunc('month', target_date) + INTERVAL '1 month', 'YYYY-MM-01');

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
        EXECUTE format(
            'CREATE TABLE public.%I PARTITION OF public.posts FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create BEFORE INSERT trigger on posts to dynamically auto-create partitions
CREATE OR REPLACE FUNCTION public.tr_before_insert_posts_partition()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.create_post_partition(NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_insert_posts_partition
BEFORE INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.tr_before_insert_posts_partition();

-- 6. Create DEFAULT catch-all partition
CREATE TABLE public.posts_default PARTITION OF public.posts DEFAULT;

-- 7. Dynamically pre-create partitions for historical data in posts_old
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'posts_old') THEN
        FOR r IN SELECT DISTINCT date_trunc('month', created_at) AS m FROM public.posts_old LOOP
            PERFORM public.create_post_partition(r.m);
        END LOOP;
    END IF;
END;
$$;

-- 8. Migrate data from posts_old to posts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'posts_old') THEN
        INSERT INTO public.posts (id, club_id, author_id, content, created_at, updated_at, deleted_at, pinned, like_count)
        SELECT id, club_id, author_id, content, created_at, updated_at, deleted_at, pinned, like_count
        FROM public.posts_old;
    END IF;
END;
$$;

-- 9. Drop posts_old
DROP TABLE IF EXISTS public.posts_old CASCADE;

-- 10. Re-create cascade deletes via trigger on posts
CREATE OR REPLACE FUNCTION public.cascade_delete_post_relations()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.comments WHERE post_id = OLD.id;
    DELETE FROM public.post_likes WHERE post_id = OLD.id;
    DELETE FROM public.post_reactions WHERE post_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cascade_delete_post_relations
AFTER DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_post_relations();

-- 11. Re-create auto_updated_at trigger
CREATE TRIGGER set_updated_at_posts
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Re-create pin permission check trigger
CREATE TRIGGER before_post_pin_check
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.check_post_pin_permission();

-- 13. Re-create soft delete cascade trigger
CREATE TRIGGER trigger_cascade_post_soft_delete
AFTER UPDATE OF deleted_at
ON public.posts
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION public.cascade_post_soft_delete();

-- 14. Enable RLS and re-create RLS policies on partitioned posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts." ON public.posts;
CREATE POLICY "Anyone can read posts." ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club members can insert posts." ON public.posts;
CREATE POLICY "Club members can insert posts." ON public.posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = posts.club_id AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = posts.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Authors can update own posts." ON public.posts;
CREATE POLICY "Authors can update own posts." ON public.posts FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own posts." ON public.posts;
CREATE POLICY "Authors can delete own posts." ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- 15. Re-create indexes
CREATE INDEX IF NOT EXISTS idx_posts_club_id ON public.posts (club_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON public.posts (created_at DESC);
