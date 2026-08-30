-- Track admin promotions and phishing simulations
CREATE TABLE IF NOT EXISTS public.admin_promotion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    phishing_triggered_at TIMESTAMPTZ,
    phishing_campaign_id UUID,
    INDEX idx_user_id (user_id),
    INDEX idx_promoted_at (promoted_at)
);

CREATE TABLE IF NOT EXISTS public.phishing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_promotion_id UUID NOT NULL REFERENCES public.admin_promotion_events(id) ON DELETE CASCADE,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('stripe_escrow', 'university_it', 'payment_processing', 'security_alert')),
    email_template TEXT NOT NULL,
    honey_pot_token TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'clicked', 'credentials_entered', 'completed')),
    sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    credentials_entered_at TIMESTAMPTZ,
    remediation_required_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_status (status),
    INDEX idx_token (honey_pot_token)
);

CREATE TABLE IF NOT EXISTS public.phishing_remediation_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.phishing_campaigns(id),
    course_start_at TIMESTAMPTZ NOT NULL,
    course_completion_at TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    modules_completed INTEGER DEFAULT 0,
    total_modules INTEGER DEFAULT 6,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

ALTER TABLE public.admin_promotion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phishing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phishing_remediation_courses ENABLE ROW LEVEL SECURITY;