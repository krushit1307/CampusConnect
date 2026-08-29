-- =============================================================================
-- Migration: User tag subscriptions + event publish fan-out
-- Issue: #4427 - Dynamic "Club Tag" Subscription Alert
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_tag_subscriptions (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.club_tag_labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tag_subscriptions_tag_id
    ON public.user_tag_subscriptions (tag_id);

ALTER TABLE public.user_tag_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tag subscriptions" ON public.user_tag_subscriptions;
CREATE POLICY "Users can read own tag subscriptions"
    ON public.user_tag_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can subscribe to tags" ON public.user_tag_subscriptions;
CREATE POLICY "Users can subscribe to tags"
    ON public.user_tag_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsubscribe from tags" ON public.user_tag_subscriptions;
CREATE POLICY "Users can unsubscribe from tags"
    ON public.user_tag_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_tag_subscriptions TO authenticated;

-- Recipients for a newly published event's tags (matched case-insensitively).
CREATE OR REPLACE FUNCTION public.get_tag_subscription_recipients(p_tags TEXT[])
RETURNS TABLE (user_id UUID, tag_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT uts.user_id, ctl.name AS tag_name
    FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw(tag)
    JOIN public.club_tag_labels ctl
      ON lower(ctl.name) = lower(btrim(trim(both '#' FROM raw.tag)))
    JOIN public.user_tag_subscriptions uts
      ON uts.tag_id = ctl.id
    WHERE btrim(raw.tag) <> '';
$$;

GRANT EXECUTE ON FUNCTION public.get_tag_subscription_recipients(TEXT[]) TO service_role;

COMMENT ON TABLE public.user_tag_subscriptions IS
    'Users subscribed to standard taxonomy tags for new-event alerts. Issue #4427.';
