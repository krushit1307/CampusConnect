-- Migration: 20260812150000_seating_charts.sql

CREATE TYPE public.seat_status AS ENUM ('available', 'pending', 'sold');

CREATE TABLE IF NOT EXISTS public.seating_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE UNIQUE NOT NULL,
  layout_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE OR REPLACE TRIGGER update_seating_layouts_updated_at
BEFORE UPDATE ON public.seating_layouts
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES public.seating_layouts(id) ON DELETE CASCADE NOT NULL,
  table_name TEXT NOT NULL,
  seat_number TEXT NOT NULL,
  status public.seat_status DEFAULT 'available'::public.seat_status NOT NULL,
  locked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lock_expires_at TIMESTAMPTZ,
  order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(layout_id, table_name, seat_number)
);

CREATE OR REPLACE TRIGGER update_seats_updated_at
BEFORE UPDATE ON public.seats
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_seats_layout_status ON public.seats(layout_id, status);

-- RLS
ALTER TABLE public.seating_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Layouts: anyone can read. Only organizers can modify.
CREATE POLICY "Layouts are viewable by everyone." ON public.seating_layouts FOR SELECT USING (true);

CREATE POLICY "Organizers can modify layouts." ON public.seating_layouts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = (SELECT club_id FROM public.events WHERE id = event_id) AND user_id = auth.uid() AND role = 'admin' AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_id) AND created_by = auth.uid())
);

-- Seats: anyone can read. Only organizers can modify.
-- Note: users modify seats via the RPCs (security definer) so they don't need direct UPDATE access.
CREATE POLICY "Seats are viewable by everyone." ON public.seats FOR SELECT USING (true);

CREATE POLICY "Organizers can modify seats." ON public.seats FOR ALL USING (
  EXISTS (SELECT 1 FROM public.seating_layouts sl 
          JOIN public.events e ON e.id = sl.event_id
          LEFT JOIN public.club_members cm ON cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.role = 'admin' AND cm.status = 'approved'
          LEFT JOIN public.clubs c ON c.id = e.club_id AND c.created_by = auth.uid()
          WHERE sl.id = layout_id AND (cm.user_id IS NOT NULL OR c.created_by IS NOT NULL)
  )
);

-- Locking RPC
CREATE OR REPLACE FUNCTION public.lock_seats(p_layout_id UUID, p_seat_ids UUID[], p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat RECORD;
  v_locked_count INT := 0;
BEGIN
  -- We MUST lock all requested rows in a consistent order to prevent deadlocks
  FOR v_seat IN 
    SELECT id, status, locked_by, lock_expires_at 
    FROM public.seats 
    WHERE id = ANY(p_seat_ids) AND layout_id = p_layout_id
    ORDER BY id 
    FOR UPDATE
  LOOP
    -- Check if seat is sold
    IF v_seat.status = 'sold' THEN
      RAISE EXCEPTION 'Seat % is already sold', v_seat.id;
    END IF;

    -- Check if seat is pending and held by someone else and lock is valid
    IF v_seat.status = 'pending' AND v_seat.locked_by != p_user_id AND v_seat.lock_expires_at > NOW() THEN
      RAISE EXCEPTION 'Seat % is temporarily held by another user', v_seat.id;
    END IF;

    -- Update seat to pending
    UPDATE public.seats
    SET 
      status = 'pending',
      locked_by = p_user_id,
      lock_expires_at = NOW() + interval '10 minutes',
      updated_at = NOW()
    WHERE id = v_seat.id;

    v_locked_count := v_locked_count + 1;
  END LOOP;

  IF v_locked_count != array_length(p_seat_ids, 1) THEN
    RAISE EXCEPTION 'Could not find all requested seats to lock';
  END IF;

  RETURN TRUE;
END;
$$;

-- Release RPC
CREATE OR REPLACE FUNCTION public.release_seats(p_layout_id UUID, p_seat_ids UUID[], p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seats
  SET 
    status = 'available',
    locked_by = NULL,
    lock_expires_at = NULL,
    order_id = NULL,
    updated_at = NOW()
  WHERE id = ANY(p_seat_ids) 
    AND layout_id = p_layout_id 
    AND locked_by = p_user_id 
    AND status = 'pending';
    
  RETURN TRUE;
END;
$$;

-- Confirm Purchase RPC
CREATE OR REPLACE FUNCTION public.confirm_seat_purchase(p_seat_ids UUID[], p_order_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat RECORD;
  v_count INT := 0;
BEGIN
  FOR v_seat IN 
    SELECT id, status 
    FROM public.seats 
    WHERE id = ANY(p_seat_ids)
    ORDER BY id 
    FOR UPDATE
  LOOP
    IF v_seat.status = 'sold' THEN
      -- Already processed, idempotent webhook
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.seats
    SET 
      status = 'sold',
      order_id = p_order_id,
      lock_expires_at = NULL,
      updated_at = NOW()
    WHERE id = v_seat.id;
    
    v_count := v_count + 1;
  END LOOP;

  IF v_count != array_length(p_seat_ids, 1) THEN
    RAISE EXCEPTION 'Could not find all requested seats to confirm';
  END IF;

  RETURN TRUE;
END;
$$;
