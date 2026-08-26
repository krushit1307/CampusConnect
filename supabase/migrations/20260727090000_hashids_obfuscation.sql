-- ============================================================
-- Migration: 20260727090000_hashids_obfuscation.sql
-- Description:
-- Enables pg_hashids extension, creates obfuscation helper functions,
-- defines an optimized_posts table with bigint keys, and constructs a
-- v_optimized_posts view with INSTEAD OF triggers for CRUD translation.
-- ============================================================

-- 1. Enable pg_hashids extension (pg_hashids is supported by Supabase)
CREATE EXTENSION IF NOT EXISTS pg_hashids;

-- 2. Create helper functions for ID encoding & decoding
CREATE OR REPLACE FUNCTION public.obfuscate_id(p_id bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_id IS NULL THEN
        RETURN NULL;
    END IF;
    -- Uses secure salt and minimum hash length of 8
    RETURN id_encode(p_id, 'campus_connect_secret_salt_2026', 8);
END;
$$;

CREATE OR REPLACE FUNCTION public.deobfuscate_id(p_hash text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_decoded bigint[];
BEGIN
    IF p_hash IS NULL OR p_hash = '' THEN
        RETURN NULL;
    END IF;
    -- Decodes hash using the matching salt and min length
    v_decoded := id_decode(p_hash, 'campus_connect_secret_salt_2026', 8);
    IF array_length(v_decoded, 1) > 0 THEN
        RETURN v_decoded[1];
    END IF;
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.obfuscate_id(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deobfuscate_id(text) TO anon, authenticated, service_role;

-- 3. Create the optimized_posts table using BigInt sequence internally
CREATE TABLE IF NOT EXISTS public.optimized_posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on public.optimized_posts
ALTER TABLE public.optimized_posts ENABLE ROW LEVEL SECURITY;

-- Define RLS policies on public.optimized_posts
DROP POLICY IF EXISTS "Anyone can select optimized_posts" ON public.optimized_posts;
CREATE POLICY "Anyone can select optimized_posts" ON public.optimized_posts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert optimized_posts" ON public.optimized_posts;
CREATE POLICY "Authenticated users can insert optimized_posts" ON public.optimized_posts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update optimized_posts" ON public.optimized_posts;
CREATE POLICY "Authors can update optimized_posts" ON public.optimized_posts
    FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete optimized_posts" ON public.optimized_posts;
CREATE POLICY "Authors can delete optimized_posts" ON public.optimized_posts
    FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- 4. Create the view to expose obfuscated IDs to the API boundary
CREATE OR REPLACE VIEW public.v_optimized_posts AS
SELECT 
    public.obfuscate_id(id) AS id,
    title,
    content,
    author_id,
    created_at
FROM public.optimized_posts;

-- 5. Create INSTEAD OF triggers on the view to translate API requests back to BigInt

-- INSERT Trigger Function
CREATE OR REPLACE FUNCTION public.trg_v_optimized_posts_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_id bigint;
BEGIN
    INSERT INTO public.optimized_posts (title, content, author_id, created_at)
    VALUES (NEW.title, NEW.content, NEW.author_id, COALESCE(NEW.created_at, now()))
    RETURNING id INTO v_new_id;

    -- Return the new row with the obfuscated ID populated
    NEW.id := public.obfuscate_id(v_new_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v_optimized_posts_insert_trigger ON public.v_optimized_posts;
CREATE TRIGGER v_optimized_posts_insert_trigger
INSTEAD OF INSERT ON public.v_optimized_posts
FOR EACH ROW
EXECUTE FUNCTION public.trg_v_optimized_posts_insert();

-- UPDATE Trigger Function
CREATE OR REPLACE FUNCTION public.trg_v_optimized_posts_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id bigint;
BEGIN
    -- Decode the obfuscated string ID back to the internal BigInt
    v_id := public.deobfuscate_id(OLD.id);
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or missing obfuscated ID';
    END IF;

    UPDATE public.optimized_posts
    SET 
        title = NEW.title,
        content = NEW.content,
        author_id = NEW.author_id,
        created_at = NEW.created_at
    WHERE id = v_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v_optimized_posts_update_trigger ON public.v_optimized_posts;
CREATE TRIGGER v_optimized_posts_update_trigger
INSTEAD OF UPDATE ON public.v_optimized_posts
FOR EACH ROW
EXECUTE FUNCTION public.trg_v_optimized_posts_update();

-- DELETE Trigger Function
CREATE OR REPLACE FUNCTION public.trg_v_optimized_posts_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id bigint;
BEGIN
    -- Decode the obfuscated string ID back to the internal BigInt
    v_id := public.deobfuscate_id(OLD.id);
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or missing obfuscated ID';
    END IF;

    DELETE FROM public.optimized_posts
    WHERE id = v_id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS v_optimized_posts_delete_trigger ON public.v_optimized_posts;
CREATE TRIGGER v_optimized_posts_delete_trigger
INSTEAD OF DELETE ON public.v_optimized_posts
FOR EACH ROW
EXECUTE FUNCTION public.trg_v_optimized_posts_delete();
