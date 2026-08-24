-- Migration: 20270314000000_dynamic_resource_conflict_resolver.sql
-- Description: Schema and functions for Dynamic Resource Conflict Resolver (#4281)

-- 1. Create university_resources table for scarce assets
CREATE TABLE IF NOT EXISTS university_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'Projector_A1', 'Main_Auditorium_PA'
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'AV_EQUIPMENT', 'VENUE_SPACE', 'LAB_GEAR'
  alternative_resource_id UUID REFERENCES university_resources(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create resource_bookings table for tracking temporal reservations
CREATE TABLE IF NOT EXISTS resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES university_resources(id) ON DELETE CASCADE,
  event_id UUID,
  organizer_club_name VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'PENDING'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast temporal range intersection queries
CREATE INDEX IF NOT EXISTS idx_resource_bookings_range 
ON resource_bookings USING GIST (
  resource_id WITH =, 
  tstzrange(start_time, end_time) WITH &&
);

-- 3. Stored Procedure: Check Resource Temporal Conflicts & Suggest Alternative Asset
CREATE OR REPLACE FUNCTION check_resource_conflict(
  p_resource_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflicting_club VARCHAR(255),
  conflict_start TIMESTAMPTZ,
  conflict_end TIMESTAMPTZ,
  alternative_asset_id UUID,
  alternative_asset_name VARCHAR(255),
  alternative_asset_tag VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict RECORD;
  v_alt RECORD;
BEGIN
  -- Query intersecting temporal boundary
  SELECT b.organizer_club_name, b.start_time, b.end_time
  INTO v_conflict
  FROM resource_bookings b
  WHERE b.resource_id = p_resource_id
    AND b.status = 'CONFIRMED'
    AND tstzrange(b.start_time, b.end_time) && tstzrange(p_start_time, p_end_time)
  LIMIT 1;

  IF FOUND THEN
    -- Find available alternative resource
    SELECT r.id, r.name, r.asset_tag
    INTO v_alt
    FROM university_resources r
    WHERE r.id != p_resource_id
      AND r.category = (SELECT category FROM university_resources WHERE id = p_resource_id)
      AND NOT EXISTS (
        SELECT 1 FROM resource_bookings rb
        WHERE rb.resource_id = r.id
          AND rb.status = 'CONFIRMED'
          AND tstzrange(rb.start_time, rb.end_time) && tstzrange(p_start_time, p_end_time)
      )
    LIMIT 1;

    RETURN QUERY SELECT 
      TRUE, 
      v_conflict.organizer_club_name, 
      v_conflict.start_time, 
      v_conflict.end_time, 
      v_alt.id, 
      v_alt.name, 
      v_alt.asset_tag;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::VARCHAR, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR;
  END IF;
END;
$$;
