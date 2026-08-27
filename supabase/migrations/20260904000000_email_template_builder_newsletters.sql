-- Migration: 20260904000000_email_template_builder_newsletters.sql
-- Description: Issue #2972 - Email Template Builder & Analytics for Club Newsletters

-- 1. Create newsletters table
CREATE TABLE IF NOT EXISTS public.newsletters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'sending', 'sent', 'failed')),
    sent_at TIMESTAMPTZ,
    total_recipients INT DEFAULT 0,
    successful_sends INT DEFAULT 0,
    failed_sends INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_club_id ON public.newsletters(club_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_status ON public.newsletters(status);

-- 2. Create newsletter_unsubscribes table (Per-club unsubscribe preferences)
CREATE TABLE IF NOT EXISTS public.newsletter_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribes_club_email ON public.newsletter_unsubscribes(club_id, email);

-- 3. Create newsletter_analytics table (Open and Click tracking)
CREATE TABLE IF NOT EXISTS public.newsletter_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
    target_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_analytics_newsletter_id ON public.newsletter_analytics(newsletter_id);

-- 4. Function: Retrieve eligible newsletter recipients excluding unsubscribed members
CREATE OR REPLACE FUNCTION public.get_eligible_newsletter_recipients(p_club_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        cm.user_id,
        p.email,
        p.first_name,
        p.last_name
    FROM public.club_members cm
    JOIN public.profiles p ON cm.user_id = p.id
    WHERE cm.club_id = p_club_id
      AND cm.status = 'approved'
      AND p.email IS NOT NULL
      AND p.email != ''
      AND NOT EXISTS (
          SELECT 1 FROM public.newsletter_unsubscribes nu
          WHERE nu.club_id = p_club_id
            AND LOWER(nu.email) = LOWER(p.email)
      );
$$;

-- 5. Row Level Security Policies
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_analytics ENABLE ROW LEVEL SECURITY;

-- Newsletters RLS
DROP POLICY IF EXISTS "Club admins can manage newsletters" ON public.newsletters;
CREATE POLICY "Club admins can manage newsletters"
ON public.newsletters FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = newsletters.club_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
          AND LOWER(cm.role) IN ('admin', 'organizer', 'president', 'officer')
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = newsletters.club_id AND c.created_by = auth.uid()
    )
);

-- Newsletter Unsubscribes RLS
DROP POLICY IF EXISTS "Anyone can insert unsubscribes" ON public.newsletter_unsubscribes;
CREATE POLICY "Anyone can insert unsubscribes"
ON public.newsletter_unsubscribes FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Club admins and owners can view unsubscribes" ON public.newsletter_unsubscribes;
CREATE POLICY "Club admins and owners can view unsubscribes"
ON public.newsletter_unsubscribes FOR SELECT
USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = newsletter_unsubscribes.club_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
          AND LOWER(cm.role) IN ('admin', 'organizer', 'president', 'officer')
    )
);

-- Newsletter Analytics RLS
DROP POLICY IF EXISTS "Club admins can view analytics" ON public.newsletter_analytics;
CREATE POLICY "Club admins can view analytics"
ON public.newsletter_analytics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.newsletters n
        JOIN public.club_members cm ON cm.club_id = n.club_id
        WHERE n.id = newsletter_analytics.newsletter_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
          AND LOWER(cm.role) IN ('admin', 'organizer', 'president', 'officer')
    )
);
