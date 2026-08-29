-- Issue #4295: Interactive Vendor Bidding Portfolio Viewer.
-- CampusConnect stores account profiles in public.profiles rather than a users table.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vendor_portfolio JSONB NOT NULL DEFAULT '{"tagline":"","specialties":[],"audio_embeds":[],"gallery":[]}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_vendor_portfolio_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_vendor_portfolio_shape   CHECK (
    jsonb_typeof(vendor_portfolio) = 'object'
    AND COALESCE(jsonb_typeof(vendor_portfolio->'audio_embeds'), 'array') = 'array'
    AND COALESCE(jsonb_typeof(vendor_portfolio->'gallery'), 'array') = 'array'
    AND CASE WHEN COALESCE(jsonb_typeof(vendor_portfolio->'audio_embeds'), 'array') = 'array'
             THEN jsonb_array_length(COALESCE(vendor_portfolio->'audio_embeds', '[]'::jsonb)) ELSE 0 END <= 3
    AND CASE WHEN COALESCE(jsonb_typeof(vendor_portfolio->'gallery'), 'array') = 'array'
             THEN jsonb_array_length(COALESCE(vendor_portfolio->'gallery', '[]'::jsonb)) ELSE 0 END <= 10
  );


ALTER TABLE public.rfp_bids
  ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rfp_bids_vendor_user ON public.rfp_bids(vendor_user_id);

DROP POLICY IF EXISTS "Public read and insert bids" ON public.rfp_bids;
CREATE POLICY "Public read vendor bids"
  ON public.rfp_bids FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users submit linked vendor bids"
  ON public.rfp_bids FOR INSERT TO authenticated
  WITH CHECK (vendor_user_id = auth.uid());
CREATE POLICY "Anonymous users submit external bids"
  ON public.rfp_bids FOR INSERT TO anon
  WITH CHECK (vendor_user_id IS NULL);

CREATE OR REPLACE FUNCTION public.submit_vendor_rfp_bid(
  p_rfp_id UUID,
  p_vendor_name TEXT,
  p_vendor_email TEXT,
  p_quoted_price NUMERIC,
  p_proposal_pdf_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.rfp_bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid public.rfp_bids;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for a student vendor bid.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_vendor_name), '') IS NULL
     OR NULLIF(BTRIM(p_vendor_email), '') IS NULL
     OR p_quoted_price IS NULL OR p_quoted_price < 0
     OR NOT EXISTS (SELECT 1 FROM public.vendor_rfps WHERE id = p_rfp_id AND status = 'open') THEN
    RAISE EXCEPTION 'A valid open RFP and vendor bid are required.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.rfp_bids (
    rfp_id, vendor_user_id, vendor_name, vendor_email, quoted_price, proposal_pdf_url, notes
  ) VALUES (
    p_rfp_id, auth.uid(), BTRIM(p_vendor_name), BTRIM(p_vendor_email), p_quoted_price,
    NULLIF(BTRIM(p_proposal_pdf_url), ''), NULLIF(BTRIM(p_notes), '')
  )
  RETURNING * INTO v_bid;
  RETURN v_bid;
END;
$$;

CREATE TABLE IF NOT EXISTS public.vendor_portfolio_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rfp_bid_id UUID NOT NULL REFERENCES public.rfp_bids(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  reviewer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfp_bid_id, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_portfolio_reviews_vendor
  ON public.vendor_portfolio_reviews(vendor_user_id, created_at DESC);

ALTER TABLE public.vendor_portfolio_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendor_portfolio_reviews FROM anon, authenticated;
GRANT ALL ON public.vendor_portfolio_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.save_vendor_portfolio(p_portfolio JSONB)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_portfolio JSONB := COALESCE(p_portfolio, '{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_portfolio) <> 'object'
     OR COALESCE(jsonb_typeof(v_portfolio->'audio_embeds'), 'array') <> 'array'
     OR COALESCE(jsonb_typeof(v_portfolio->'gallery'), 'array') <> 'array'
     OR CASE WHEN COALESCE(jsonb_typeof(v_portfolio->'audio_embeds'), 'array') = 'array'
             THEN jsonb_array_length(COALESCE(v_portfolio->'audio_embeds', '[]'::jsonb)) ELSE 0 END > 3
     OR CASE WHEN COALESCE(jsonb_typeof(v_portfolio->'gallery'), 'array') = 'array'
             THEN jsonb_array_length(COALESCE(v_portfolio->'gallery', '[]'::jsonb)) ELSE 0 END > 10
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(
         CASE WHEN COALESCE(jsonb_typeof(v_portfolio->'audio_embeds'), 'array') = 'array'
              THEN COALESCE(v_portfolio->'audio_embeds', '[]'::jsonb) ELSE '[]'::jsonb END
       ) AS sample
       WHERE jsonb_typeof(sample) <> 'object'
          OR sample->>'provider' NOT IN ('spotify', 'soundcloud')
          OR (
            sample->>'provider' = 'spotify'
            AND COALESCE(sample->>'url', '') !~ '^https://(www[.])?open[.]spotify[.]com/(track|album|playlist|episode|show)/[A-Za-z0-9]+$'
          )
          OR (
            sample->>'provider' = 'soundcloud'
            AND COALESCE(sample->>'url', '') !~ '^https://(www[.])?soundcloud[.]com/[^/]+/[^/]+/?$'
          )
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(
         CASE WHEN COALESCE(jsonb_typeof(v_portfolio->'gallery'), 'array') = 'array'
              THEN COALESCE(v_portfolio->'gallery', '[]'::jsonb) ELSE '[]'::jsonb END
       ) AS image
       WHERE jsonb_typeof(image) <> 'object'
          OR COALESCE(image->>'url', '') !~ '^https://'
          OR COALESCE(image->>'alt', '') = ''
     ) THEN
    RAISE EXCEPTION 'Portfolio contains invalid media or exceeds the media limits.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
  SET vendor_portfolio = v_portfolio, updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_portfolio_for_bid(p_bid_id UUID)
RETURNS TABLE (
  bid_id UUID,
  vendor_user_id UUID,
  vendor_name TEXT,
  vendor_email TEXT,
  vendor_portfolio JSONB,
  average_rating NUMERIC,
  rating_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.rfp_bids b
    JOIN public.vendor_rfps r ON r.id = b.rfp_id
    WHERE b.id = p_bid_id
      AND r.event_id IS NOT NULL
      AND public.is_event_admin(r.event_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only the event organizer can view a vendor portfolio.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.id,
    b.vendor_user_id,
    COALESCE(NULLIF(p.full_name, ''), b.vendor_name),
    b.vendor_email,
    COALESCE(p.vendor_portfolio, '{"tagline":"","specialties":[],"audio_embeds":[],"gallery":[]}'::jsonb),
    COALESCE(AVG(v.rating), 0)::NUMERIC,
    COUNT(v.id)::BIGINT
  FROM public.rfp_bids b
  LEFT JOIN public.profiles p ON p.id = b.vendor_user_id
  LEFT JOIN public.vendor_portfolio_reviews v ON v.vendor_user_id = b.vendor_user_id
  WHERE b.id = p_bid_id
  GROUP BY b.id, b.vendor_user_id, p.full_name, b.vendor_name, b.vendor_email, p.vendor_portfolio;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_vendor_portfolio_review(
  p_bid_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.vendor_portfolio_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid public.rfp_bids;
  v_rfp public.vendor_rfps;
  v_event public.events;
  v_review public.vendor_portfolio_reviews;
BEGIN
  IF auth.uid() IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Authenticated reviewer and a rating from 1 to 5 are required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_bid FROM public.rfp_bids WHERE id = p_bid_id;
  SELECT * INTO v_rfp FROM public.vendor_rfps WHERE id = v_bid.rfp_id;
  SELECT * INTO v_event FROM public.events WHERE id = v_rfp.event_id;
  IF v_bid.id IS NULL OR v_bid.vendor_user_id IS NULL OR v_rfp.event_id IS NULL
     OR v_event.id IS NULL
     OR COALESCE(v_event.status, 'scheduled') IN ('cancelled', 'canceled')
     OR COALESCE(v_event.end_date, v_event.start_date, v_event.event_date) IS NULL
     OR COALESCE(v_event.end_date, v_event.start_date, v_event.event_date) >= NOW()
     OR NOT public.is_event_admin(v_rfp.event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the event organizer can review a student vendor.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.vendor_portfolio_reviews (vendor_user_id, rfp_bid_id, event_id, reviewer_user_id, rating, comment)
  VALUES (v_bid.vendor_user_id, v_bid.id, v_rfp.event_id, auth.uid(), p_rating, NULLIF(BTRIM(p_comment), ''))
  ON CONFLICT (rfp_bid_id, reviewer_user_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
  RETURNING * INTO v_review;
  RETURN v_review;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_vendor_rfp_bid(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_vendor_portfolio(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_portfolio_for_bid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_vendor_portfolio_review(UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON COLUMN public.profiles.vendor_portfolio IS
  'Validated vendor portfolio JSON: tagline, specialties, up to 3 audio embeds, and up to 10 gallery images.';
