-- Migration: 20260730181000_club_audit_logs.sql
-- Description: Add full auditing/history tracking for clubs table via Postgres Triggers

-- 1. Create the club_audit_logs table
CREATE TABLE IF NOT EXISTS public.club_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the trigger function with SECURITY DEFINER to bypass RLS for inserts
CREATE OR REPLACE FUNCTION public.audit_club_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    old_json JSONB := '{}'::jsonb;
    new_json JSONB := '{}'::jsonb;
    has_changes BOOLEAN := FALSE;
BEGIN
    -- Audit UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        -- 1. name
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            old_json := old_json || jsonb_build_object('name', OLD.name);
            new_json := new_json || jsonb_build_object('name', NEW.name);
            has_changes := TRUE;
        END IF;

        -- 2. slug
        IF OLD.slug IS DISTINCT FROM NEW.slug THEN
            old_json := old_json || jsonb_build_object('slug', OLD.slug);
            new_json := new_json || jsonb_build_object('slug', NEW.slug);
            has_changes := TRUE;
        END IF;

        -- 3. description
        IF OLD.description IS DISTINCT FROM NEW.description THEN
            old_json := old_json || jsonb_build_object('description', OLD.description);
            new_json := new_json || jsonb_build_object('description', NEW.description);
            has_changes := TRUE;
        END IF;

        -- 4. banner_url
        IF OLD.banner_url IS DISTINCT FROM NEW.banner_url THEN
            old_json := old_json || jsonb_build_object('banner_url', OLD.banner_url);
            new_json := new_json || jsonb_build_object('banner_url', NEW.banner_url);
            has_changes := TRUE;
        END IF;

        -- 5. logo_url
        IF OLD.logo_url IS DISTINCT FROM NEW.logo_url THEN
            old_json := old_json || jsonb_build_object('logo_url', OLD.logo_url);
            new_json := new_json || jsonb_build_object('logo_url', NEW.logo_url);
            has_changes := TRUE;
        END IF;

        -- 6. github_repo_url
        IF OLD.github_repo_url IS DISTINCT FROM NEW.github_repo_url THEN
            old_json := old_json || jsonb_build_object('github_repo_url', OLD.github_repo_url);
            new_json := new_json || jsonb_build_object('github_repo_url', NEW.github_repo_url);
            has_changes := TRUE;
        END IF;

        -- 7. visibility
        IF OLD.visibility IS DISTINCT FROM NEW.visibility THEN
            old_json := old_json || jsonb_build_object('visibility', OLD.visibility);
            new_json := new_json || jsonb_build_object('visibility', NEW.visibility);
            has_changes := TRUE;
        END IF;

        -- 8. social_links
        IF OLD.social_links IS DISTINCT FROM NEW.social_links THEN
            old_json := old_json || jsonb_build_object('social_links', OLD.social_links);
            new_json := new_json || jsonb_build_object('social_links', NEW.social_links);
            has_changes := TRUE;
        END IF;

        -- Log if any tracked fields changed
        IF has_changes THEN
            INSERT INTO public.club_audit_logs (club_id, action_type, old_data, new_data)
            VALUES (NEW.id, 'UPDATE', old_json, new_json);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Create and attach trigger to public.clubs table
DROP TRIGGER IF EXISTS clubs_audit_trigger ON public.clubs;
CREATE TRIGGER clubs_audit_trigger
    AFTER UPDATE ON public.clubs
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_club_changes();

-- 4. Enable Row Level Security (RLS) on club_audit_logs
ALTER TABLE public.club_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy for system admins to read logs
CREATE POLICY "System admins can read club audit logs"
ON public.club_audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'system_admin'::public.user_role
    )
);

-- 6. Grants
GRANT ALL ON TABLE public.club_audit_logs TO postgres;
GRANT SELECT ON TABLE public.club_audit_logs TO authenticated;
