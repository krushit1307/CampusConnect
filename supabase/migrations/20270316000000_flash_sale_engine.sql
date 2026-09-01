-- Issue #4292: real-time flash-sale orchestration for event tickets.
-- Stripe Price objects remain immutable; the active Stripe price pointer on the
-- selected ticket tier is swapped to a newly created sale Price and restored
-- by the expiry worker.

ALTER TABLE public.ticket_tiers
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE TABLE IF NOT EXISTS public.event_flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_tier_id UUID REFERENCES public.ticket_tiers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
  original_price_cents INTEGER NOT NULL CHECK (original_price_cents > 0),
  sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents > 0 AND sale_price_cents < original_price_cents),
  original_stripe_price_id TEXT,
  sale_stripe_price_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_sent_at TIMESTAMPTZ,
  CHECK (expires_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_flash_sale_per_event
  ON public.event_flash_sales(event_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_event_flash_sales_expiry
  ON public.event_flash_sales(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_event_flash_sales_event
  ON public.event_flash_sales(event_id, created_at DESC);

ALTER TABLE public.event_flash_sales ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
ALTER TABLE public.event_flash_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_flash_sales FROM anon, authenticated;
GRANT ALL ON public.event_flash_sales TO service_role;

CREATE POLICY "Organizers can view their own flash sales"
  ON public.event_flash_sales FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "System admins can view flash sales"
  ON public.event_flash_sales FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- Public clients receive only non-sensitive active sale data. Stripe Price IDs
-- are intentionally excluded from this view; checkout resolves them server-side.
CREATE OR REPLACE VIEW public.active_event_flash_sales AS
SELECT
  id,
  event_id,
  ticket_tier_id,
  discount_percent,
  original_price_cents,
  sale_price_cents,
  starts_at,
  expires_at,
  status
FROM public.event_flash_sales
WHERE status = 'active'
  AND starts_at <= NOW()
  AND expires_at > NOW();

GRANT SELECT ON public.active_event_flash_sales TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_event_flash_sale(
  p_event_id UUID,
  p_discount_percent NUMERIC,
  p_duration_minutes INTEGER
)
RETURNS public.event_flash_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events;
  v_tier public.ticket_tiers;
  v_original_price INTEGER;
  v_sale_price INTEGER;
  v_sale public.event_flash_sales;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    v_event.created_by = auth.uid()
    OR public.is_club_admin(v_event.club_id, auth.uid())
    OR public.is_system_admin()
  ) THEN
    RAISE EXCEPTION 'Only the event organizer can start a flash sale.' USING ERRCODE = '42501';
  END IF;
  IF p_discount_percent IS NULL OR p_discount_percent <= 0 OR p_discount_percent > 90 THEN
    RAISE EXCEPTION 'Discount must be greater than 0 and no more than 90 percent.' USING ERRCODE = '22023';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 5 OR p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'Flash-sale duration must be between 5 minutes and 24 hours.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_flash_sales
    WHERE event_id = p_event_id AND status = 'active' AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'This event already has an active flash sale.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_tier
  FROM public.ticket_tiers
  WHERE event_id = p_event_id
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date > NOW())
    AND (capacity IS NULL OR (SELECT COUNT(*) FROM public.event_rsvps r WHERE r.ticket_tier_id = ticket_tiers.id) < capacity)
  ORDER BY start_date ASC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_original_price := v_tier.price;
  ELSE
    v_tier := NULL;
    SELECT base_price INTO v_original_price FROM public.events WHERE id = p_event_id;
  END IF;

  IF v_original_price IS NULL OR v_original_price <= 0 THEN
    RAISE EXCEPTION 'A paid ticket tier is required to start a flash sale.' USING ERRCODE = '22023';
  END IF;

  v_sale_price := GREATEST(1, FLOOR(v_original_price * (1 - p_discount_percent / 100))::INTEGER);
  IF v_sale_price >= v_original_price THEN
    RAISE EXCEPTION 'Discount does not reduce the ticket price.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_flash_sales (
    event_id, ticket_tier_id, created_by, discount_percent,
    original_price_cents, sale_price_cents,
    original_stripe_price_id, starts_at, expires_at, status
  ) VALUES (
    p_event_id,
    v_tier.id,
    auth.uid(),
    p_discount_percent,
    v_original_price,
    v_sale_price,
    v_tier.stripe_price_id,
    NOW(),
    NOW() + make_interval(mins => p_duration_minutes),
    'pending'
  )
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_event_flash_sale(
  p_sale_id UUID,
  p_sale_stripe_price_id TEXT
)
RETURNS public.event_flash_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.event_flash_sales;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_flash_sales
  SET sale_stripe_price_id = NULLIF(BTRIM(p_sale_stripe_price_id), ''),
      status = 'active',
      updated_at = NOW()
  WHERE id = p_sale_id
    AND status = 'pending'
    AND starts_at <= NOW()
    AND expires_at > NOW()
  RETURNING * INTO v_sale;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flash sale is no longer eligible for activation.' USING ERRCODE = 'P0002';
  END IF;

  IF v_sale.ticket_tier_id IS NOT NULL THEN
    UPDATE public.ticket_tiers
    SET stripe_price_id = v_sale.sale_stripe_price_id
    WHERE id = v_sale.ticket_tier_id;
  END IF;
  RETURN v_sale;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_event_flash_sale(p_sale_id UUID)
RETURNS public.event_flash_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.event_flash_sales;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_flash_sales
  SET status = 'expired', updated_at = NOW()
  WHERE id = p_sale_id
    AND status = 'active'
    AND expires_at <= NOW()
  RETURNING * INTO v_sale;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_sale.ticket_tier_id IS NOT NULL THEN
    UPDATE public.ticket_tiers
    SET stripe_price_id = v_sale.original_stripe_price_id
    WHERE id = v_sale.ticket_tier_id;
  END IF;
  RETURN v_sale;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_event_flash_sale(p_event_id UUID)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  ticket_tier_id UUID,
  discount_percent NUMERIC,
  original_price_cents INTEGER,
  sale_price_cents INTEGER,
  sale_stripe_price_id TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.event_id, s.ticket_tier_id, s.discount_percent,
         s.original_price_cents, s.sale_price_cents,
         s.sale_stripe_price_id, s.expires_at
  FROM public.event_flash_sales s
  WHERE s.event_id = p_event_id
    AND s.status = 'active'
    AND s.starts_at <= NOW()
    AND s.expires_at > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.create_event_flash_sale(UUID, NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_event_flash_sale(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.revert_event_flash_sale(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_event_flash_sale(UUID) TO service_role;

-- Realtime public pricing updates. The client listens to broadcast messages from
-- the Edge Functions and can also read the sanitized active-sale view on reload.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-event-flash-sales') THEN
      PERFORM cron.unschedule('expire-event-flash-sales');
    END IF;
    PERFORM cron.schedule(
      'expire-event-flash-sales',
      '* * * * *',
      $flash_job$
        SELECT net.http_post(
          url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321') || '/functions/v1/expire-flash-sales',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
          ),
          body := '{}'::jsonb
        );
      $flash_job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule flash-sale expiry: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_flash_sale_notifications(p_sale_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.event_flash_sales;
  v_event_title TEXT;
  v_count INTEGER := 0;
  v_user_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_flash_sales
  SET notification_sent_at = NOW(), updated_at = NOW()
  WHERE id = p_sale_id
    AND status = 'active'
    AND notification_sent_at IS NULL
  RETURNING * INTO v_sale;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT e.title INTO v_event_title FROM public.events e WHERE e.id = v_sale.event_id;

  FOR v_user_id IN
    SELECT DISTINCT recipient_id
    FROM (
      SELECT w.user_id AS recipient_id
      FROM public.event_waitlist w
      WHERE w.event_id = v_sale.event_id
      UNION
      SELECT cs.user_id AS recipient_id
      FROM public.club_subscriptions cs
      JOIN public.events e ON e.club_id = cs.club_id
      WHERE e.id = v_sale.event_id AND cs.notify_events = TRUE
    ) recipients
    WHERE recipient_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (
      user_id, type, title, message, link, entity_id, entity_type, actor_id, actor_name
    ) VALUES (
      v_user_id,
      'flash_sale',
      'Flash Sale: ' || COALESCE(v_event_title, 'Event tickets'),
      RTRIM(RTRIM(v_sale.discount_percent::TEXT, '0'), '.') || '% off tickets is live now for a limited time.',
      '/events/' || v_sale.event_id,
      v_sale.event_id,
      'event_flash_sale',
      v_sale.created_by,
      NULL
    );
    BEGIN
      PERFORM net.http_post(
        url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321') || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
        ),
        body := jsonb_build_object(
          'user_id', v_user_id,
          'title', 'Flash Sale: ' || COALESCE(v_event_title, 'Event tickets'),
          'message', RTRIM(RTRIM(v_sale.discount_percent::TEXT, '0'), '.') || '% off tickets is live now for a limited time.',
          'url', '/events/' || v_sale.event_id,
          'type', 'flash_sale',
          'priority', 'urgent'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_flash_sale_notifications(UUID) TO service_role;
