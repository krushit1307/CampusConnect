-- Migration: Create event_seats table and seat reservation functions
-- Issue: #1945 - Interactive SVG Seating Chart

-- ─── 1. event_seats table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_seats (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  row_label   TEXT NOT NULL,
  section     TEXT NOT NULL DEFAULT 'main',
  x           DOUBLE PRECISION NOT NULL,
  y           DOUBLE PRECISION NOT NULL,
  width       DOUBLE PRECISION NOT NULL DEFAULT 24,
  height      DOUBLE PRECISION NOT NULL DEFAULT 24,
  shape       TEXT NOT NULL DEFAULT 'rect',
  status      TEXT NOT NULL DEFAULT 'available',
  reserved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(event_id, label)
);

CREATE INDEX IF NOT EXISTS event_seats_event_id_idx ON public.event_seats(event_id);
CREATE INDEX IF NOT EXISTS event_seats_status_idx ON public.event_seats(event_id, status);

-- ─── 2. Trigger for updated_at ─────────────────────────────────────────────

CREATE TRIGGER set_updated_at_event_seats
BEFORE UPDATE ON public.event_seats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. Seat reservation RPC with advisory lock ────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_seat(
  p_seat_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_status TEXT;
  v_version INTEGER;
  v_effective_user_id UUID;
  v_lock_key INT;
  v_rsvp_exists BOOLEAN;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  IF v_effective_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'Not authenticated');
  END IF;

  v_lock_key := ('x' || substr(md5('reserve_seat_' || p_seat_id::text), 1, 8))::bit(32)::int;

  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object('success', false, 'code', 'BUSY', 'message', 'Server busy, please retry');
  END IF;

  SELECT status, version, event_id INTO v_status, v_version, v_event_id
  FROM public.event_seats WHERE id = p_seat_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Seat not found');
  END IF;

  IF v_status = 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_RESERVED', 'message', 'Seat is already reserved');
  END IF;

  IF v_status = 'maintenance' THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAVAILABLE', 'message', 'Seat is unavailable');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = v_event_id AND user_id = v_effective_user_id
  ) INTO v_rsvp_exists;

  IF NOT v_rsvp_exists THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_RSVP', 'message', 'You must RSVP before reserving a seat');
  END IF;

  UPDATE public.event_seats
  SET status = 'reserved', reserved_by = v_effective_user_id, version = version + 1
  WHERE id = p_seat_id AND version = v_version;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'RESERVED',
    'message', 'Seat reserved successfully',
    'seat_id', p_seat_id::text,
    'version', v_version + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_seat(
  p_seat_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user_id UUID;
  v_current_reserved_by UUID;
BEGIN
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  IF v_effective_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'Not authenticated');
  END IF;

  SELECT reserved_by INTO v_current_reserved_by
  FROM public.event_seats WHERE id = p_seat_id FOR UPDATE;

  IF v_current_reserved_by IS DISTINCT FROM v_effective_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_OWNER', 'message', 'Seat is not reserved by you');
  END IF;

  UPDATE public.event_seats
  SET status = 'available', reserved_by = NULL, version = version + 1
  WHERE id = p_seat_id;

  RETURN jsonb_build_object('success', true, 'code', 'RELEASED', 'message', 'Seat released');
END;
$$;

-- ─── 4. Generate default seating layout RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_event_seating_layout(
  p_event_id UUID,
  p_rows INT DEFAULT 10,
  p_seats_per_row INT DEFAULT 12,
  p_start_x DOUBLE PRECISION DEFAULT 50,
  p_start_y DOUBLE PRECISION DEFAULT 80,
  p_row_spacing DOUBLE PRECISION DEFAULT 36,
  p_seat_spacing DOUBLE PRECISION DEFAULT 28
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_letter TEXT;
  v_seat_num INT;
  v_x DOUBLE PRECISION;
  v_y DOUBLE PRECISION;
  v_section TEXT;
  v_inserted INT := 0;
  v_row_idx INT;
BEGIN
  FOR v_row_idx IN 0..(p_rows - 1) LOOP
    v_row_letter := chr(65 + v_row_idx);
    v_y := p_start_y + (v_row_idx * p_row_spacing);

    FOR v_seat_num IN 1..p_seats_per_row LOOP
      v_x := p_start_x + ((v_seat_num - 1) * p_seat_spacing);

      IF v_seat_num <= p_seats_per_row / 3 THEN
        v_section := 'left';
      ELSIF v_seat_num <= (p_seats_per_row * 2) / 3 THEN
        v_section := 'center';
      ELSE
        v_section := 'right';
      END IF;

      INSERT INTO public.event_seats (event_id, label, row_label, section, x, y, shape)
      VALUES (
        p_event_id,
        v_row_letter || v_seat_num,
        v_row_letter,
        v_section,
        v_x,
        v_y,
        'rect'
      );
      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'seats_generated', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_seat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_seat(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_seat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_seat(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_event_seating_layout(UUID, INT, INT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_event_seating_layout(UUID, INT, INT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;

-- ─── 5. RLS policies ───────────────────────────────────────────────────────

ALTER TABLE public.event_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_seats_select" ON public.event_seats
  FOR SELECT USING (true);

CREATE POLICY "event_seats_insert" ON public.event_seats
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_seats.event_id
        AND public.is_club_admin(e.club_id, auth.uid())
    )
  );

CREATE POLICY "event_seats_update" ON public.event_seats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_seats.event_id
        AND public.is_club_admin(e.club_id, auth.uid())
    )
  );

CREATE POLICY "event_seats_delete" ON public.event_seats
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_seats.event_id
        AND public.is_club_admin(e.club_id, auth.uid())
    )
  );
