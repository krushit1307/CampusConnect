-- Enable btree_gist extension for exclusion constraints on scalar + range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Create resources inventory table
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'PA System', 'Projector', 'Folding Table', 'Room'
    quantity INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create resource_bookings table
CREATE TABLE IF NOT EXISTS resource_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT check_booking_times CHECK (end_time > start_time)
);

-- 3. GiST Exclusion Constraint to prevent double-booking APPROVED resources for overlapping tsranges
ALTER TABLE resource_bookings 
ADD CONSTRAINT prevent_resource_double_booking 
EXCLUDE USING gist (
    resource_id WITH =,
    tsrange(start_time, end_time) WITH &&
) WHERE (status = 'APPROVED');

-- Indexes for fast query lookups
CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON resource_bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_club ON resource_bookings(club_id);

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view resources" ON resources FOR SELECT USING (true);
CREATE POLICY "Clubs can view and create bookings" ON resource_bookings FOR ALL USING (true);