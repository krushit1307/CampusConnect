-- 1. Add gamification_points to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gamification_points') THEN
    ALTER TABLE public.profiles ADD COLUMN gamification_points INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- 2. Create sponsors table
CREATE TABLE public.sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX idx_sponsors_event_id ON public.sponsors(event_id);

-- 3. Create sponsor_bounties table
CREATE TABLE public.sponsor_bounties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    points_reward INTEGER NOT NULL CHECK (points_reward > 0),
    claim_code TEXT NOT NULL UNIQUE,
    max_claims INTEGER NOT NULL DEFAULT 0, -- 0 means unlimited
    current_claims INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);
CREATE INDEX idx_sponsor_bounties_sponsor_id ON public.sponsor_bounties(sponsor_id);
-- Unique constraint to prevent duplicate case-insensitive claim codes could be helpful, but normal unqiue is fine.

-- 4. Create sponsor_bounty_claims table
CREATE TABLE public.sponsor_bounty_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id UUID NOT NULL REFERENCES public.sponsor_bounties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(bounty_id, user_id)
);
CREATE INDEX idx_bounty_claims_user_id ON public.sponsor_bounty_claims(user_id);
CREATE INDEX idx_bounty_claims_bounty_id ON public.sponsor_bounty_claims(bounty_id);

-- 5. RLS Policies
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_bounty_claims ENABLE ROW LEVEL SECURITY;

-- Sponsors are viewable by everyone
CREATE POLICY "Sponsors are viewable by everyone." 
  ON public.sponsors FOR SELECT 
  USING (true);

-- Event organizers can manage sponsors
CREATE POLICY "Event organizers can insert sponsors." 
  ON public.sponsors FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e 
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE e.id = event_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

CREATE POLICY "Event organizers can update sponsors." 
  ON public.sponsors FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE e.id = event_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

CREATE POLICY "Event organizers can delete sponsors." 
  ON public.sponsors FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE e.id = event_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

-- Sponsor Bounties are viewable by everyone
CREATE POLICY "Sponsor bounties are viewable by everyone."
  ON public.sponsor_bounties FOR SELECT
  USING (true);

-- Event organizers can manage bounties
CREATE POLICY "Event organizers can insert bounties." 
  ON public.sponsor_bounties FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.events e ON s.event_id = e.id
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE s.id = sponsor_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

CREATE POLICY "Event organizers can update bounties." 
  ON public.sponsor_bounties FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.events e ON s.event_id = e.id
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE s.id = sponsor_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

CREATE POLICY "Event organizers can delete bounties." 
  ON public.sponsor_bounties FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsors s
      JOIN public.events e ON s.event_id = e.id
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE s.id = sponsor_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );

-- Claims
CREATE POLICY "Users can see their own claims"
  ON public.sponsor_bounty_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Event organizers can see all claims for their bounties"
  ON public.sponsor_bounty_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sponsor_bounties sb
      JOIN public.sponsors s ON sb.sponsor_id = s.id
      JOIN public.events e ON s.event_id = e.id
      JOIN public.clubs c ON e.club_id = c.id 
      WHERE sb.id = bounty_id AND (c.created_by = auth.uid() OR public.is_club_admin(c.id, auth.uid()))
    )
  );
  
-- Inserts happen via the RPC function which bypasses RLS (since it's SECURITY DEFINER)
-- We don't define INSERT policy to restrict direct insertions, requiring users to use the RPC.

-- 6. Claim RPC Function
CREATE OR REPLACE FUNCTION public.claim_sponsor_bounty(p_claim_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bounty_id UUID;
  v_points_reward INTEGER;
  v_max_claims INTEGER;
  v_current_claims INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_user_id UUID := auth.uid();
  v_has_claimed BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- fetch bounty
  SELECT id, points_reward, max_claims, current_claims, expires_at
  INTO v_bounty_id, v_points_reward, v_max_claims, v_current_claims, v_expires_at
  FROM public.sponsor_bounties
  WHERE claim_code = p_claim_code
  FOR UPDATE;

  IF v_bounty_id IS NULL THEN
    RAISE EXCEPTION 'Invalid claim code';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RAISE EXCEPTION 'Bounty has expired';
  END IF;

  IF v_max_claims > 0 AND v_current_claims >= v_max_claims THEN
    RAISE EXCEPTION 'Bounty claim limit reached';
  END IF;

  -- check if already claimed
  SELECT EXISTS(
    SELECT 1 FROM public.sponsor_bounty_claims 
    WHERE bounty_id = v_bounty_id AND user_id = v_user_id
  ) INTO v_has_claimed;

  IF v_has_claimed THEN
    RAISE EXCEPTION 'You have already claimed this bounty';
  END IF;

  -- Perform claim
  INSERT INTO public.sponsor_bounty_claims (bounty_id, user_id)
  VALUES (v_bounty_id, v_user_id);

  UPDATE public.sponsor_bounties
  SET current_claims = current_claims + 1
  WHERE id = v_bounty_id;

  UPDATE public.profiles
  SET gamification_points = gamification_points + v_points_reward
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'points_awarded', v_points_reward);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_sponsor_bounty(TEXT) TO authenticated;
