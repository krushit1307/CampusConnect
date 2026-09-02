-- Migration: Fire Alarm Audio Fingerprinting → Emergency Evacuation (Issue #5279)
-- Bouncer iPad FFT T3 detection → EMERGENCY_EVACUATION → drop turnstile magnetic locks

-- 1. Extend events with evacuation state (if not exists from bouncer capacityControl expectations)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_physical_capacity INTEGER CHECK (venue_physical_capacity IS NULL OR venue_physical_capacity > 0);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_halt_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_halt_triggered_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_halt_triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_evacuation_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_evacuation_triggered_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS emergency_evacuation_triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS turnstile_magnetic_locks_dropped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS turnstile_unlocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_events_evacuation_active ON public.events(emergency_evacuation_active) WHERE emergency_evacuation_active = true;

-- 2. Turnstile devices (digital access control)
CREATE TABLE IF NOT EXISTS public.turnstile_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_identifier TEXT UNIQUE NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT true,
  magnetic_lock_dropped_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_turnstile_event ON public.turnstile_devices(event_id);
CREATE INDEX IF NOT EXISTS idx_turnstile_locked ON public.turnstile_devices(locked);

ALTER TABLE public.turnstile_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Turnstiles viewable by authenticated" ON public.turnstile_devices;
CREATE POLICY "Turnstiles viewable by authenticated" ON public.turnstile_devices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Bouncers and admins manage turnstiles" ON public.turnstile_devices;
CREATE POLICY "Bouncers and admins manage turnstiles" ON public.turnstile_devices FOR ALL TO authenticated USING (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_id) AND created_by = auth.uid())
  OR public.is_system_admin()
) WITH CHECK (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_id) AND created_by = auth.uid())
  OR public.is_system_admin()
);

CREATE OR REPLACE FUNCTION public.touch_turnstile_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_turnstile_touch ON public.turnstile_devices;
CREATE TRIGGER trg_turnstile_touch BEFORE UPDATE ON public.turnstile_devices FOR EACH ROW EXECUTE FUNCTION public.touch_turnstile_updated_at();

-- 3. Emergency evacuation log (audit trail)
CREATE TABLE IF NOT EXISTS public.emergency_evacuation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_duration_seconds NUMERIC(5,2) NOT NULL CHECK (detection_duration_seconds >= 5),
  t3_confirmed BOOLEAN NOT NULL DEFAULT true,
  turnstiles_unlocked_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evacuation_event ON public.emergency_evacuation_events(event_id);
CREATE INDEX IF NOT EXISTS idx_evacuation_triggered_at ON public.emergency_evacuation_events(triggered_at DESC);

ALTER TABLE public.emergency_evacuation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Evacuation events viewable by authenticated" ON public.emergency_evacuation_events;
CREATE POLICY "Evacuation events viewable by authenticated" ON public.emergency_evacuation_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Bouncers can insert evacuation events" ON public.emergency_evacuation_events;
CREATE POLICY "Bouncers can insert evacuation events" ON public.emergency_evacuation_events FOR INSERT TO authenticated WITH CHECK (true);

-- 4. RPC: trigger_emergency_evacuation — idempotent, high-priority
CREATE OR REPLACE FUNCTION public.trigger_emergency_evacuation(
  p_event_id UUID,
  p_bouncer_id UUID,
  p_detection_duration_seconds NUMERIC DEFAULT 5.5,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_already BOOLEAN;
  v_venue UUID;
  v_unlocked INTEGER := 0;
  v_t3 BOOLEAN := true;
BEGIN
  IF p_event_id IS NULL OR p_bouncer_id IS NULL THEN
    RAISE EXCEPTION 'event_id and bouncer_id required';
  END IF;
  IF p_detection_duration_seconds < 5 THEN
    RAISE EXCEPTION 'T3 pattern must be detected continuously for > 5 seconds (got %)', p_detection_duration_seconds;
  END IF;

  SELECT emergency_evacuation_active INTO v_already FROM public.events WHERE id = p_event_id;
  IF v_already THEN
    RETURN jsonb_build_object('success', true, 'already_evacuated', true, 'message', 'Evacuation already active — turnstiles already unlocked');
  END IF;

  SELECT venue_id INTO v_venue FROM public.events WHERE id = p_event_id;

  -- Mark event as evacuated and drop magnetic locks flag
  UPDATE public.events SET
    emergency_evacuation_active = true,
    emergency_evacuation_triggered_at = NOW(),
    emergency_evacuation_triggered_by = p_bouncer_id,
    turnstile_magnetic_locks_dropped = true,
    turnstile_unlocked_at = NOW(),
    emergency_halt_active = true,
    emergency_halt_triggered_at = NOW(),
    emergency_halt_triggered_by = p_bouncer_id
  WHERE id = p_event_id;

  -- Drop all turnstile magnetic locks for this event (free-flow)
  UPDATE public.turnstile_devices SET locked = false, magnetic_lock_dropped_at = NOW()
  WHERE event_id = p_event_id AND locked = true;
  GET DIAGNOSTICS v_unlocked = ROW_COUNT;

  -- If no turnstile rows exist, still succeed (venue may use badge-out turnstiles not yet registered)
  INSERT INTO public.emergency_evacuation_events(event_id, venue_id, triggered_by, detection_duration_seconds, t3_confirmed, turnstiles_unlocked_count, payload)
  VALUES (p_event_id, v_venue, p_bouncer_id, p_detection_duration_seconds, v_t3, v_unlocked, COALESCE(p_payload, '{}'::jsonb));

  INSERT INTO public.club_audit_logs(club_id, action_type, old_data, new_data)
  SELECT club_id, 'emergency_evacuation', jsonb_build_object('emergency_evacuation_active', false), jsonb_build_object('emergency_evacuation_active', true, 'triggered_by', p_bouncer_id, 'turnstiles_unlocked', v_unlocked, 'detection_seconds', p_detection_duration_seconds)
  FROM public.events WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'already_evacuated', false, 'turnstiles_unlocked', v_unlocked, 'event_id', p_event_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.trigger_emergency_evacuation(UUID,UUID,NUMERIC,JSONB) TO authenticated, service_role;

-- 5. Realtime publication for turnstile unlock (bouncer iPads subscribe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.turnstile_devices';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_evacuation_events';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
