-- Migration: Cross-Platform Dark Mode Preference Sync (#2800)
-- Description: Adds theme_preference enum & column to profiles/user_profiles with realtime sync capability.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_preference_enum') THEN
        CREATE TYPE public.theme_preference_enum AS ENUM ('light', 'dark', 'system');
    END IF;
END $$;

-- 1. Add theme_preference column to profiles table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'theme_preference'
        ) THEN
            ALTER TABLE public.profiles 
            ADD COLUMN theme_preference public.theme_preference_enum NOT NULL DEFAULT 'system';
        END IF;
    END IF;
END $$;

-- 2. Create user_profiles view / table alias if not exists to support both table naming conventions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        CREATE VIEW public.user_profiles AS SELECT * FROM public.profiles;
    END IF;
END $$;

-- 3. Ensure profiles table is in supabase_realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 4. Helper RPC to update user theme preference atomically
CREATE OR REPLACE FUNCTION public.update_theme_preference(p_theme TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_theme NOT IN ('light', 'dark', 'system') THEN
        RAISE EXCEPTION 'Invalid theme preference: %', p_theme;
    END IF;

    UPDATE public.profiles
    SET theme_preference = p_theme::public.theme_preference_enum,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', TRUE, 'theme_preference', p_theme);
END;
$$;
