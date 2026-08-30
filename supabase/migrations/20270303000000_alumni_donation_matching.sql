-- Issue #4041: Dynamic Alumni Donation Matching
-- Extends the existing crowdfunding campaign/donation tables with auditable,
-- one-to-one alumni match invitations. Raw recipient identities remain service-role-only.

CREATE TABLE IF NOT EXISTS public.campaign_donation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crowdfunding_campaigns(id) ON DELETE CASCADE,
  source_donation_id UUID NOT NULL REFERENCES public.campaign_donations(id) ON DELETE CASCADE,
  alumni_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_amount_cents INTEGER NOT NULL CHECK (requested_amount_cents > 0),
  match_donation_id UUID UNIQUE REFERENCES public.campaign_donations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'matched', 'declined', 'expired')),
  notification_attempts INTEGER NOT NULL DEFAULT 0 CHECK (notification_attempts >= 0),
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  UNIQUE (source_donation_id, alumni_user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_donation_matches_campaign
  ON public.campaign_donation_matches(campaign_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_donation_matches_source
  ON public.campaign_donation_matches(source_donation_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donation_matches_alumni
  ON public.campaign_donation_matches(alumni_user_id, status);

ALTER TABLE public.campaign_donation_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_donation_matches FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.campaign_donation_matches TO service_role;

-- Select up to ten opted-in alumni associated with the club. Alumni can be
-- represented by the dynamic per-club Alumni role or by an opted-in alumni
-- mentorship profile whose historical club roles include this club.
CREATE OR REPLACE FUNCTION public.create_campaign_donation_matches(
  p_donation_id UUID,
  p_pool_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  match_id UUID,
  alumni_user_id UUID,
  requested_amount_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_club_id UUID;
  v_donor_id UUID;
  v_donor_role TEXT;
  v_amount_cents INTEGER;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_pool_size, 10), 1), 10);
BEGIN
  SELECT d.campaign_id, c.club_id, d.donor_id, d.amount_cents, p.role::TEXT
    INTO v_campaign_id, v_club_id, v_donor_id, v_amount_cents, v_donor_role
  FROM public.campaign_donations d
  JOIN public.crowdfunding_campaigns c ON c.id = d.campaign_id
  LEFT JOIN public.profiles p ON p.id = d.donor_id
  WHERE d.id = p_donation_id
    AND d.status = 'succeeded';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Successful campaign donation not found';
  END IF;

  IF v_donor_id IS NULL OR v_donor_role IS DISTINCT FROM 'student' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH alumni_candidates AS (
    SELECT cm.user_id
    FROM public.club_members cm
    JOIN public.club_roles cr ON cr.id = cm.role_id AND cr.club_id = cm.club_id
    WHERE cm.club_id = v_club_id
      AND cm.status = 'approved'
      AND LOWER(cr.title) = 'alumni'

    UNION

    SELECT cm.user_id
    FROM public.club_members cm
    JOIN public.profiles profile ON profile.id = cm.user_id
    WHERE cm.club_id = v_club_id
      AND cm.status = 'approved'
      AND profile.role::TEXT = 'alumni'

    UNION

    SELECT amp.user_id
    FROM public.alumni_mentorship_profiles amp
    WHERE amp.is_opted_in = TRUE
      AND amp.past_club_roles @> jsonb_build_array(
        jsonb_build_object('club_id', v_club_id::TEXT)
      )
  ),
  eligible_alumni AS (
    SELECT ac.user_id
    FROM alumni_candidates ac
    JOIN auth.users au ON au.id = ac.user_id
    LEFT JOIN public.user_communication_preferences prefs
      ON prefs.user_id = ac.user_id AND prefs.club_id = v_club_id
    WHERE ac.user_id IS DISTINCT FROM v_donor_id
      AND au.email IS NOT NULL
      AND COALESCE(prefs.email_enabled, TRUE)
      AND NOT EXISTS (
        SELECT 1
        FROM public.campaign_donation_matches existing
        WHERE existing.source_donation_id = p_donation_id
          AND existing.alumni_user_id = ac.user_id
      )
    ORDER BY random()
    LIMIT v_limit
  )
  INSERT INTO public.campaign_donation_matches (
    campaign_id,
    source_donation_id,
    alumni_user_id,
    requested_amount_cents
  )
  SELECT v_campaign_id, p_donation_id, ea.user_id, v_amount_cents
  FROM eligible_alumni ea
  ON CONFLICT (source_donation_id, alumni_user_id) DO NOTHING
  RETURNING id, alumni_user_id, requested_amount_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.create_campaign_donation_matches(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_campaign_donation_matches(UUID, INTEGER) TO service_role;

-- Link a successful Stripe donation to its invitation atomically. The webhook
-- must provide the invited alumni user as the authenticated checkout owner.
CREATE OR REPLACE FUNCTION public.link_campaign_donation_match(
  p_match_id UUID,
  p_donation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.campaign_donation_matches%ROWTYPE;
  v_donation public.campaign_donations%ROWTYPE;
BEGIN
  SELECT * INTO v_match
  FROM public.campaign_donation_matches
  WHERE id = p_match_id AND status = 'invited'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation match invitation is no longer available';
  END IF;

  SELECT * INTO v_donation
  FROM public.campaign_donations
  WHERE id = p_donation_id
    AND campaign_id = v_match.campaign_id
    AND donor_id = v_match.alumni_user_id
    AND amount_cents = v_match.requested_amount_cents
    AND status = 'succeeded';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation does not satisfy this match invitation';
  END IF;

  UPDATE public.campaign_donation_matches
  SET match_donation_id = p_donation_id,
      status = 'matched',
      matched_at = NOW()
  WHERE id = p_match_id;

  UPDATE public.campaign_donation_matches
  SET status = 'expired'
  WHERE source_donation_id = v_match.source_donation_id
    AND id <> p_match_id
    AND status = 'invited';
END;
$$;

REVOKE ALL ON FUNCTION public.link_campaign_donation_match(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_campaign_donation_match(UUID, UUID) TO service_role;

-- Public-safe invitation preview. It exposes no recipient email or alumni user ID.
CREATE OR REPLACE VIEW public.campaign_match_invites AS
SELECT
  m.id AS match_id,
  m.campaign_id,
  m.requested_amount_cents,
  m.status,
  m.created_at,
  CASE
    WHEN source.is_anonymous THEN 'A student supporter'
    ELSE COALESCE(source.display_name, 'A student supporter')
  END AS source_display_name
FROM public.campaign_donation_matches m
JOIN public.campaign_donations source ON source.id = m.source_donation_id
WHERE m.status = 'invited'
  AND source.status = 'succeeded';

-- Public-safe matched activity for the campaign page.
CREATE OR REPLACE VIEW public.campaign_match_activity AS
SELECT
  m.id AS match_id,
  m.campaign_id,
  m.requested_amount_cents,
  m.created_at,
  m.matched_at,
  CASE
    WHEN source.is_anonymous THEN 'A student supporter'
    ELSE COALESCE(source.display_name, 'A student supporter')
  END AS source_display_name,
  CASE
    WHEN matched.is_anonymous THEN 'An alumnus'
    ELSE COALESCE(matched.display_name, 'An alumnus')
  END AS alumni_display_name
FROM public.campaign_donation_matches m
JOIN public.campaign_donations source ON source.id = m.source_donation_id
JOIN public.campaign_donations matched ON matched.id = m.match_donation_id
WHERE m.status = 'matched'
  AND source.status = 'succeeded'
  AND matched.status = 'succeeded';

GRANT SELECT ON public.campaign_match_invites TO anon, authenticated;
GRANT SELECT ON public.campaign_match_activity TO anon, authenticated;

-- Service-role-only email payload. This function deliberately keeps email
-- addresses out of public views and returns only pending invitations.
CREATE OR REPLACE FUNCTION public.get_campaign_match_notifications(p_donation_id UUID)
RETURNS TABLE (
  match_id UUID,
  campaign_title TEXT,
  club_name TEXT,
  club_slug TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  source_amount_cents INTEGER,
  requested_amount_cents INTEGER,
  source_display_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    m.id,
    c.title,
    cl.name,
    cl.slug,
    au.email::TEXT,
    COALESCE(p.full_name, p.first_name, 'Alumni supporter'),
    source.amount_cents,
    m.requested_amount_cents,
    CASE
      WHEN source.is_anonymous THEN 'A student supporter'
      ELSE COALESCE(source.display_name, 'A student supporter')
    END
  FROM public.campaign_donation_matches m
  JOIN public.campaign_donations source ON source.id = m.source_donation_id
  JOIN public.crowdfunding_campaigns c ON c.id = m.campaign_id
  JOIN public.clubs cl ON cl.id = c.club_id
  JOIN auth.users au ON au.id = m.alumni_user_id
  LEFT JOIN public.profiles p ON p.id = m.alumni_user_id
  WHERE m.source_donation_id = p_donation_id
    AND m.status = 'invited'
    AND m.notification_sent_at IS NULL
    AND source.status = 'succeeded'
    AND au.email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_match_notifications(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_campaign_match_notifications(UUID) TO service_role;

COMMENT ON TABLE public.campaign_donation_matches IS
  'Auditable alumni matching invitations linked to successful campaign donations.';
COMMENT ON VIEW public.campaign_match_activity IS
  'Public-safe matched donation activity without recipient email or user IDs.';
COMMENT ON FUNCTION public.create_campaign_donation_matches(UUID, INTEGER) IS
  'Selects up to ten opted-in alumni associated with a campaign club.';

-- Authenticated checkout lookup. The designated alumni is the only user who can
-- obtain the exact requested amount for an invitation.
CREATE OR REPLACE FUNCTION public.get_campaign_match_invitation(p_match_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  requested_amount_cents INTEGER,
  source_display_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    m.campaign_id,
    m.requested_amount_cents,
    CASE
      WHEN source.is_anonymous THEN 'A student supporter'
      ELSE COALESCE(source.display_name, 'A student supporter')
    END
  FROM public.campaign_donation_matches m
  JOIN public.campaign_donations source ON source.id = m.source_donation_id
  WHERE m.id = p_match_id
    AND m.alumni_user_id = auth.uid()
    AND m.status = 'invited'
    AND source.status = 'succeeded';
$$;

REVOKE ALL ON FUNCTION public.get_campaign_match_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_campaign_match_invitation(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_campaign_match_invitation(UUID) IS
  'Returns a pending match invitation only to its designated alumni recipient.';

CREATE OR REPLACE FUNCTION public.record_campaign_match_notification(
  p_match_id UUID,
  p_delivered BOOLEAN
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.campaign_donation_matches
  SET notification_attempts = notification_attempts + 1,
      notification_sent_at = CASE
        WHEN p_delivered THEN COALESCE(notification_sent_at, NOW())
        ELSE notification_sent_at
      END
  WHERE id = p_match_id;
$$;

REVOKE ALL ON FUNCTION public.record_campaign_match_notification(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_campaign_match_notification(UUID, BOOLEAN) TO service_role;

-- A student gift is doubled by one alumni match; the remaining invitations are
-- expired once the first valid matching payment is linked.
CREATE UNIQUE INDEX IF NOT EXISTS ux_campaign_donation_matches_one_success
  ON public.campaign_donation_matches(source_donation_id)
  WHERE status = 'matched';
