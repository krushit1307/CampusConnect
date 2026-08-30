-- ============================================================
-- CampusConnect – Carpool / Ride-Share Matchmaker (Issue #3663)
-- supabase/migrations/012_carpool_tables.sql
-- ============================================================

-- carpools table: drivers offer seats for a specific event
CREATE TABLE IF NOT EXISTS carpools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seats_offered INTEGER NOT NULL CHECK (seats_offered > 0 AND seats_offered <= 8),
  seats_taken   INTEGER NOT NULL DEFAULT 0,
  departure_time TIMESTAMPTZ NOT NULL,
  location_string TEXT NOT NULL,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'full', 'completed', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_seats_taken_leq_offered CHECK (seats_taken <= seats_offered)
);

CREATE INDEX IF NOT EXISTS idx_carpools_event_id ON carpools(event_id);
CREATE INDEX IF NOT EXISTS idx_carpools_driver_user_id ON carpools(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_carpools_status ON carpools(status);

-- carpool_requests table: riders request seats; drivers accept/decline
CREATE TABLE IF NOT EXISTS carpool_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id    UUID NOT NULL REFERENCES carpools(id) ON DELETE CASCADE,
  rider_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  pickup_notes  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  UNIQUE(carpool_id, rider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_carpool_requests_carpool_id ON carpool_requests(carpool_id);
CREATE INDEX IF NOT EXISTS idx_carpool_requests_rider_user_id ON carpool_requests(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_carpool_requests_status ON carpool_requests(status);

-- RLS Policies
ALTER TABLE carpools ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpool_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carpools are viewable by authenticated users"
  ON carpools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Carpool requests are viewable by authenticated users"
  ON carpool_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create carpools"
  ON carpools FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can create carpool requests"
  ON carpool_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Drivers can update own carpools"
  ON carpools FOR UPDATE TO authenticated
  USING (driver_user_id = auth.uid());

CREATE POLICY "Drivers can update requests for their carpools"
  ON carpool_requests FOR UPDATE TO authenticated
  USING (carpool_id IN (SELECT id FROM carpools WHERE driver_user_id = auth.uid()));

CREATE POLICY "Riders can cancel own requests"
  ON carpool_requests FOR UPDATE TO authenticated
  USING (rider_user_id = auth.uid() AND status = 'pending');

-- Trigger: auto-update seats_taken when a request is accepted
CREATE OR REPLACE FUNCTION update_carpool_seats_taken()
RETURNS TRIGGER AS $$ BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
    UPDATE carpools SET seats_taken = seats_taken + 1, updated_at = NOW()
    WHERE id = NEW.carpool_id;
    UPDATE carpools SET status = 'full'
    WHERE id = NEW.carpool_id AND seats_taken >= seats_offered;
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'accepted') THEN
    UPDATE carpools SET seats_taken = GREATEST(seats_taken - 1, 0), updated_at = NOW()
    WHERE id = OLD.carpool_id;
    UPDATE carpools SET status = 'active'
    WHERE id = OLD.carpool_id AND seats_taken < seats_offered AND status = 'full';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_carpool_request_status_change
  AFTER UPDATE OR DELETE ON carpool_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_carpool_seats_taken();
