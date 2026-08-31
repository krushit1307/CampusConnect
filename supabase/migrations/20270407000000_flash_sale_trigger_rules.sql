-- =============================================================================
-- Issue #4725 - Real-Time "Dynamic Pricing" Flash Sale Trigger
-- Organizers define IFTTT rules (48h before event, or OpenWeather rain).
-- An hourly cron evaluates them, mutates the Stripe Price, and emails
-- bookmarked users who have not purchased yet.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flash_sale_trigger_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('hours_before_event', 'weather_rain')),
  hours_before INTEGER CHECK (hours_before IS NULL OR (hours_before > 0 AND hours_before <= 168)),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20
    CHECK (discount_percent > 0 AND discount_percent <= 90),
  duration_hours INTEGER NOT NULL DEFAULT 24
    CHECK (duration_hours > 0 AND duration_hours <= 24),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, trigger_type),
  CHECK (trigger_type <> 'hours_before_event' OR hours_before IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_trigger_rules_enabled
  ON public.flash_sale_trigger_rules (enabled, last_fired_at)
  WHERE enabled = TRUE;

ALTER TABLE public.flash_sale_trigger_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers manage flash sale trigger rules" ON public.flash_sale_trigger_rules;
CREATE POLICY "Organizers manage flash sale trigger rules"
  ON public.flash_sale_trigger_rules FOR ALL TO authenticated
  USING (public.is_event_organizer(event_id, auth.uid()))
  WITH CHECK (public.is_event_organizer(event_id, auth.uid()) AND created_by = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_sale_trigger_rules TO authenticated;
GRANT ALL ON public.flash_sale_trigger_rules TO service_role;

-- Pending flash sale created from a fired IFTTT rule (service role only).
CREATE OR REPLACE FUNCTION public.create_event_flash_sale_from_trigger(p_rule_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.flash_sale_trigger_rules%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_tier public.ticket_tiers%ROWTYPE;
  v_original_price INTEGER;
  v_sale_price INTEGER;
  v_sale public.event_flash_sales%ROWTYPE;
  v_duration_minutes INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rule FROM public.flash_sale_trigger_rules WHERE id = p_rule_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rule not found.');
  END IF;
  IF v_rule.enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'skipped', 'disabled');
  END IF;
  IF v_rule.last_fired_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'skipped', 'already_fired');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_flash_sales
    WHERE event_id = v_rule.event_id
      AND status IN ('pending', 'active')
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'skipped', 'sale_already_active');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_rule.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  SELECT * INTO v_tier
  FROM public.ticket_tiers
  WHERE event_id = v_rule.event_id
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date > NOW())
    AND (capacity IS NULL OR (
      SELECT COUNT(*) FROM public.event_rsvps r WHERE r.ticket_tier_id = ticket_tiers.id
    ) < capacity)
  ORDER BY start_date ASC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_original_price := v_tier.price;
  ELSE
    v_tier := NULL;
    SELECT base_price INTO v_original_price FROM public.events WHERE id = v_rule.event_id;
  END IF;

  IF v_original_price IS NULL OR v_original_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A paid ticket tier is required.');
  END IF;

  v_sale_price := GREATEST(1, FLOOR(v_original_price * (1 - v_rule.discount_percent / 100))::INTEGER);
  IF v_sale_price >= v_original_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discount does not reduce the ticket price.');
  END IF;

  v_duration_minutes := GREATEST(5, LEAST(1440, v_rule.duration_hours * 60));

  INSERT INTO public.event_flash_sales (
    event_id, ticket_tier_id, created_by, discount_percent,
    original_price_cents, sale_price_cents,
    original_stripe_price_id, starts_at, expires_at, status
  ) VALUES (
    v_rule.event_id,
    v_tier.id,
    v_rule.created_by,
    v_rule.discount_percent,
    v_original_price,
    v_sale_price,
    v_tier.stripe_price_id,
    NOW(),
    NOW() + make_interval(mins => v_duration_minutes),
    'pending'
  )
  RETURNING * INTO v_sale;

  RETURN jsonb_build_object('success', true, 'sale', to_jsonb(v_sale));
END;
$$;

-- Bookmarked users who have not purchased / RSVP'd this event.
CREATE OR REPLACE FUNCTION public.get_flash_sale_bookmark_recipients(p_event_id UUID)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.email
  FROM (
    SELECT se.user_id
    FROM public.saved_events se
    WHERE se.event_id = p_event_id
    UNION
    SELECT b.user_id
    FROM public.bookmarks b
    WHERE b.event_id = p_event_id
  ) bookmarked
  JOIN public.profiles p ON p.id = bookmarked.user_id
  WHERE p.email IS NOT NULL
    AND BTRIM(p.email) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_rsvps r
      WHERE r.event_id = p_event_id
        AND r.user_id = p.id
        AND r.status IN ('attending', 'approved', 'going', 'confirmed')
    );
$$;

GRANT EXECUTE ON FUNCTION public.create_event_flash_sale_from_trigger(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_flash_sale_bookmark_recipients(UUID) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evaluate-flash-sale-triggers') THEN
      PERFORM cron.unschedule('evaluate-flash-sale-triggers');
    END IF;
    PERFORM cron.schedule(
      'evaluate-flash-sale-triggers',
      '0 * * * *',
      $flash_trigger_job$
        SELECT net.http_post(
          url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321')
            || '/functions/v1/evaluate-flash-sale-triggers',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
          ),
          body := '{}'::jsonb
        );
      $flash_trigger_job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule flash-sale trigger evaluator: %', SQLERRM;
END;
$$;
