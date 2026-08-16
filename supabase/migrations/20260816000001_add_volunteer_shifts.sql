-- 1. Create the Event Shifts table
CREATE TABLE event_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the Shift Assignments table
CREATE TABLE shift_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  -- This constraint prevents the same user from claiming the same shift twice
  UNIQUE(shift_id, user_id) 
);

-- 3. Create a function to securely claim a shift and prevent overbooking
CREATE OR REPLACE FUNCTION claim_volunteer_shift(p_shift_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INT;
    shift_capacity INT;
BEGIN
    -- Lock the shift row temporarily to prevent race conditions (2 users clicking at the exact same time)
    SELECT capacity INTO shift_capacity FROM event_shifts WHERE id = p_shift_id FOR UPDATE;
    
    -- Count how many people already claimed this shift
    SELECT COUNT(*) INTO current_count FROM shift_assignments WHERE shift_id = p_shift_id;
    
    -- Enforce the capacity limit
    IF current_count >= shift_capacity THEN
        RAISE EXCEPTION 'Shift is already at full capacity';
    END IF;
    
    -- If there is room, insert the assignment
    INSERT INTO shift_assignments (shift_id, user_id) VALUES (p_shift_id, p_user_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
