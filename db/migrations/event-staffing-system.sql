

-- Volunteer status tracking
CREATE TABLE IF NOT EXISTS volunteer_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL 
        CHECK (status IN ('available', 'busy', 'on_break', 'off_duty', 'checking_in', 'checking_out')),
    
    -- Location tracking
    current_location VARCHAR(255),
    current_zone VARCHAR(100),
    assigned_station VARCHAR(255),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Shift details
    shift_start TIMESTAMP,
    shift_end TIMESTAMP,
    shift_duration_hours INTEGER,
    is_overtime BOOLEAN DEFAULT FALSE,
    
    -- Contact
    phone_number VARCHAR(50),
    emergency_contact VARCHAR(255),
    
    -- Additional
    current_task_id UUID,
    current_task_description TEXT,
    notes TEXT,
    
    UNIQUE(event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Task assignments
CREATE TABLE IF NOT EXISTS volunteer_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    assigned_to UUID,
    assigned_by UUID,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    task_priority VARCHAR(50) DEFAULT 'medium' 
        CHECK (task_priority IN ('low', 'medium', 'high', 'urgent')),
    task_type VARCHAR(50) CHECK (task_type IN ('errand', 'station', 'cleanup', 'setup', 'break', 'other')),
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    
    -- Location
    location VARCHAR(255),
    zone VARCHAR(100),
    
    -- Timing
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    due_by TIMESTAMP,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    
    -- Feedback
    volunteer_rating INTEGER CHECK (volunteer_rating >= 1 AND volunteer_rating <= 5),
    organizer_notes TEXT,
    completion_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Event zones
CREATE TABLE IF NOT EXISTS event_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    zone_color VARCHAR(7) DEFAULT '#3B82F6',
    zone_description TEXT,
    capacity INTEGER,
    current_staff_count INTEGER DEFAULT 0,
    min_staff_required INTEGER DEFAULT 0,
    max_staff_allowed INTEGER DEFAULT 0,
    
    -- Staffing status
    is_staffed BOOLEAN DEFAULT FALSE,
    last_staff_check TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(event_id, zone_name),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Shift schedules
CREATE TABLE IF NOT EXISTS volunteer_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    shift_name VARCHAR(100),
    shift_start TIMESTAMP NOT NULL,
    shift_end TIMESTAMP NOT NULL,
    shift_type VARCHAR(50) CHECK (shift_type IN ('morning', 'afternoon', 'evening', 'night', 'full_day', 'custom')),
    zone_id UUID,
    
    -- Status
    clocked_in_at TIMESTAMP,
    clocked_out_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'clocked_in', 'on_break', 'clocked_out', 'no_show', 'cancelled')),
    
    -- Break tracking
    break_taken_at TIMESTAMP,
    break_returned_at TIMESTAMP,
    break_duration_minutes INTEGER DEFAULT 0,
    total_break_minutes INTEGER DEFAULT 30, -- Allotted break time
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES event_zones(id) ON DELETE SET NULL
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_volunteer_status_event ON volunteer_status(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_status_user ON volunteer_status(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_status_status ON volunteer_status(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_status_last_updated ON volunteer_status(last_updated);
CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_event ON volunteer_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_assigned_to ON volunteer_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_status ON volunteer_tasks(status);
CREATE INDEX IF NOT EXISTS idx_event_zones_event ON event_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_event ON volunteer_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_user ON volunteer_shifts(user_id);

-- ============================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update status timestamp
CREATE OR REPLACE FUNCTION update_volunteer_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_volunteer_last_updated_trigger
    BEFORE UPDATE ON volunteer_status
    FOR EACH ROW
    EXECUTE FUNCTION update_volunteer_last_updated();

-- Function to automatically check-in volunteers
CREATE OR REPLACE FUNCTION auto_check_in_volunteer(
    p_event_id UUID,
    p_user_id UUID,
    p_zone_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    shift_record RECORD;
    status_record RECORD;
BEGIN
    -- Check if volunteer has a shift today
    SELECT * INTO shift_record
    FROM volunteer_shifts
    WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND DATE(shift_start) = CURRENT_DATE
    AND status NOT IN ('clocked_out', 'no_show', 'cancelled')
    ORDER BY shift_start ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No active shift found for today'::TEXT;
        RETURN;
    END IF;
    
    -- Check if already clocked in
    SELECT * INTO status_record
    FROM volunteer_status
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    IF FOUND AND status_record.status IN ('available', 'busy', 'on_break') THEN
        RETURN QUERY SELECT FALSE, 'Already checked in'::TEXT;
        RETURN;
    END IF;
    
    -- Update or insert status
    INSERT INTO volunteer_status (
        event_id,
        user_id,
        status,
        check_in_time,
        shift_start,
        shift_end,
        assigned_station,
        current_zone
    ) VALUES (
        p_event_id,
        p_user_id,
        'available',
        CURRENT_TIMESTAMP,
        shift_record.shift_start,
        shift_record.shift_end,
        NULL,
        (SELECT zone_name FROM event_zones WHERE id = p_zone_id)
    ) ON CONFLICT (event_id, user_id) DO UPDATE SET
        status = 'available',
        check_in_time = CURRENT_TIMESTAMP,
        shift_start = shift_record.shift_start,
        shift_end = shift_record.shift_end,
        last_updated = CURRENT_TIMESTAMP;
    
    -- Update shift status
    UPDATE volunteer_shifts
    SET 
        clocked_in_at = CURRENT_TIMESTAMP,
        status = 'clocked_in'
    WHERE id = shift_record.id;
    
    -- Update zone staffing count
    IF p_zone_id IS NOT NULL THEN
        UPDATE event_zones
        SET 
            current_staff_count = current_staff_count + 1,
            last_staff_check = CURRENT_TIMESTAMP
        WHERE id = p_zone_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Successfully checked in'::TEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to update volunteer status
CREATE OR REPLACE FUNCTION update_volunteer_status(
    p_event_id UUID,
    p_user_id UUID,
    p_status VARCHAR(50),
    p_task_id UUID DEFAULT NULL,
    p_current_location VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    current_status VARCHAR(50);
BEGIN
    -- Check if volunteer exists
    SELECT status INTO current_status
    FROM volunteer_status
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Volunteer not found for this event'::TEXT;
        RETURN;
    END IF;
    
    -- If marking as off_duty, auto check-out
    IF p_status = 'off_duty' THEN
        UPDATE volunteer_status
        SET 
            status = p_status,
            check_out_time = CURRENT_TIMESTAMP,
            last_updated = CURRENT_TIMESTAMP,
            current_task_id = NULL
        WHERE event_id = p_event_id AND user_id = p_user_id;
        
        -- Update shift
        UPDATE volunteer_shifts
        SET 
            clocked_out_at = CURRENT_TIMESTAMP,
            status = 'clocked_out'
        WHERE event_id = p_event_id 
        AND user_id = p_user_id
        AND DATE(shift_start) = CURRENT_DATE
        AND status = 'clocked_in';
        
        RETURN QUERY SELECT TRUE, 'Successfully checked out'::TEXT;
        RETURN;
    END IF;
    
    -- Update status
    UPDATE volunteer_status
    SET 
        status = p_status,
        current_task_id = p_task_id,
        current_location = COALESCE(p_current_location, current_location),
        last_updated = CURRENT_TIMESTAMP
    WHERE event_id = p_event_id AND user_id = p_user_id;
    
    -- If break, update shift break time
    IF p_status = 'on_break' THEN
        UPDATE volunteer_shifts
        SET 
            break_taken_at = CURRENT_TIMESTAMP,
            status = 'on_break'
        WHERE event_id = p_event_id 
        AND user_id = p_user_id
        AND DATE(shift_start) = CURRENT_DATE
        AND status = 'clocked_in';
    END IF;
    
    -- If returning from break
    IF p_status = 'available' AND current_status = 'on_break' THEN
        UPDATE volunteer_shifts
        SET 
            break_returned_at = CURRENT_TIMESTAMP,
            break_duration_minutes = EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP - break_taken_at)),
            status = 'clocked_in'
        WHERE event_id = p_event_id 
        AND user_id = p_user_id
        AND DATE(shift_start) = CURRENT_DATE
        AND status = 'on_break';
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Status updated successfully'::TEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to assign task to volunteer
CREATE OR REPLACE FUNCTION assign_task_to_volunteer(
    p_event_id UUID,
    p_volunteer_id UUID,
    p_organizer_id UUID,
    p_task_title TEXT,
    p_task_description TEXT,
    p_priority VARCHAR(50) DEFAULT 'medium'
)
RETURNS TABLE (
    task_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    new_task_id UUID;
    volunteer_status VARCHAR(50);
BEGIN
    -- Check if volunteer is available
    SELECT status INTO volunteer_status
    FROM volunteer_status
    WHERE event_id = p_event_id AND user_id = p_volunteer_id;
    
    IF volunteer_status != 'available' THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Volunteer is not available'::TEXT;
        RETURN;
    END IF;
    
    -- Create task
    INSERT INTO volunteer_tasks (
        event_id,
        assigned_to,
        assigned_by,
        task_title,
        task_description,
        task_priority,
        status,
        assigned_at
    ) VALUES (
        p_event_id,
        p_volunteer_id,
        p_organizer_id,
        p_task_title,
        p_task_description,
        p_priority,
        'assigned',
        CURRENT_TIMESTAMP
    ) RETURNING id INTO new_task_id;
    
    -- Update volunteer status to busy
    UPDATE volunteer_status
    SET 
        status = 'busy',
        current_task_id = new_task_id,
        current_task_description = p_task_title,
        last_updated = CURRENT_TIMESTAMP
    WHERE event_id = p_event_id AND user_id = p_volunteer_id;
    
    -- Send notification (via trigger)
    PERFORM pg_notify(
        'task_assigned',
        jsonb_build_object(
            'task_id', new_task_id,
            'volunteer_id', p_volunteer_id,
            'event_id', p_event_id
        )::TEXT
    );
    
    RETURN QUERY SELECT new_task_id, TRUE, 'Task assigned successfully'::TEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to get staffing matrix
CREATE OR REPLACE FUNCTION get_staffing_matrix(
    p_event_id UUID
)
RETURNS TABLE (
    user_id UUID,
    full_name VARCHAR(255),
    profile_picture VARCHAR(500),
    status VARCHAR(50),
    status_color VARCHAR(20),
    current_location VARCHAR(255),
    current_zone VARCHAR(100),
    current_task VARCHAR(255),
    last_updated TIMESTAMP,
    shift_start TIMESTAMP,
    shift_end TIMESTAMP,
    is_active BOOLEAN,
    time_since_update TEXT,
    rating FLOAT,
    total_tasks_completed BIGINT,
    cell_style JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.user_id,
        p.full_name,
        p.avatar_url,
        vs.status,
        CASE 
            WHEN vs.status = 'available' THEN '#22c55e'  -- Green
            WHEN vs.status = 'busy' THEN '#ef4444'       -- Red
            WHEN vs.status = 'on_break' THEN '#eab308'   -- Yellow
            WHEN vs.status = 'off_duty' THEN '#94a3b8'   -- Gray
            WHEN vs.status = 'checking_in' THEN '#3b82f6' -- Blue
            ELSE '#8b5cf6'                               -- Purple
        END,
        vs.current_location,
        vs.current_zone,
        COALESCE(vs.current_task_description, 'No task'),
        vs.last_updated,
        vs.shift_start,
        vs.shift_end,
        CASE 
            WHEN vs.status IN ('available', 'busy', 'on_break') THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN vs.last_updated > (CURRENT_TIMESTAMP - INTERVAL '5 minutes') THEN 'Just now'
            WHEN vs.last_updated > (CURRENT_TIMESTAMP - INTERVAL '15 minutes') THEN '5-15 minutes ago'
            WHEN vs.last_updated > (CURRENT_TIMESTAMP - INTERVAL '30 minutes') THEN '15-30 minutes ago'
            ELSE 'Over 30 minutes ago'
        END,
        COALESCE((
            SELECT AVG(volunteer_rating) 
            FROM volunteer_tasks 
            WHERE assigned_to = vs.user_id 
            AND volunteer_rating IS NOT NULL
        ), 0),
        COALESCE((
            SELECT COUNT(*) 
            FROM volunteer_tasks 
            WHERE assigned_to = vs.user_id 
            AND status = 'completed'
        ), 0),
        jsonb_build_object(
            'backgroundColor', 
            CASE 
                WHEN vs.status = 'available' THEN '#dcfce7'
                WHEN vs.status = 'busy' THEN '#fee2e2'
                WHEN vs.status = 'on_break' THEN '#fef9c3'
                WHEN vs.status = 'off_duty' THEN '#f1f5f9'
                ELSE '#f3e8ff'
            END,
            'borderColor',
            CASE 
                WHEN vs.status = 'available' THEN '#22c55e'
                WHEN vs.status = 'busy' THEN '#ef4444'
                WHEN vs.status = 'on_break' THEN '#eab308'
                WHEN vs.status = 'off_duty' THEN '#94a3b8'
                ELSE '#8b5cf6'
            END,
            'statusIcon',
            CASE 
                WHEN vs.status = 'available' THEN '🟢'
                WHEN vs.status = 'busy' THEN '🔴'
                WHEN vs.status = 'on_break' THEN '🟡'
                WHEN vs.status = 'off_duty' THEN '⚫'
                ELSE '🟣'
            END
        )
    FROM volunteer_status vs
    JOIN profiles p ON vs.user_id = p.id
    WHERE vs.event_id = p_event_id
    AND vs.status != 'off_duty'
    ORDER BY 
        CASE vs.status
            WHEN 'available' THEN 1
            WHEN 'busy' THEN 2
            WHEN 'on_break' THEN 3
            ELSE 4
        END,
        p.full_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get volunteer stats
CREATE OR REPLACE FUNCTION get_volunteer_stats(
    p_event_id UUID
)
RETURNS TABLE (
    total_volunteers BIGINT,
    available_count BIGINT,
    busy_count BIGINT,
    on_break_count BIGINT,
    off_duty_count BIGINT,
    checkin_count BIGINT,
    average_rating FLOAT,
    total_tasks_completed BIGINT,
    total_tasks_pending BIGINT,
    zones_staffed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) AS total_volunteers,
        COUNT(CASE WHEN status = 'available' THEN 1 END) AS available_count,
        COUNT(CASE WHEN status = 'busy' THEN 1 END) AS busy_count,
        COUNT(CASE WHEN status = 'on_break' THEN 1 END) AS on_break_count,
        COUNT(CASE WHEN status = 'off_duty' THEN 1 END) AS off_duty_count,
        COUNT(CASE WHEN status = 'checking_in' THEN 1 END) AS checkin_count,
        COALESCE((
            SELECT AVG(volunteer_rating) 
            FROM volunteer_tasks 
            WHERE event_id = p_event_id 
            AND volunteer_rating IS NOT NULL
        ), 0) AS average_rating,
        COALESCE((
            SELECT COUNT(*) 
            FROM volunteer_tasks 
            WHERE event_id = p_event_id 
            AND status = 'completed'
        ), 0) AS total_tasks_completed,
        COALESCE((
            SELECT COUNT(*) 
            FROM volunteer_tasks 
            WHERE event_id = p_event_id 
            AND status IN ('pending', 'assigned', 'in_progress')
        ), 0) AS total_tasks_pending,
        COALESCE((
            SELECT COUNT(*) 
            FROM event_zones 
            WHERE event_id = p_event_id 
            AND current_staff_count > 0
        ), 0) AS zones_staffed
    FROM volunteer_status
    WHERE event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VIEWS
-- ============================================

-- View for command center
CREATE OR REPLACE VIEW command_center AS
SELECT 
    vs.event_id,
    e.title AS event_title,
    COUNT(vs.id) AS total_volunteers,
    COUNT(CASE WHEN vs.status = 'available' THEN 1 END) AS available,
    COUNT(CASE WHEN vs.status = 'busy' THEN 1 END) AS busy,
    COUNT(CASE WHEN vs.status = 'on_break' THEN 1 END) AS on_break,
    COUNT(CASE WHEN vs.status = 'off_duty' THEN 1 END) AS off_duty,
    MAX(vs.last_updated) AS latest_activity,
    AVG(vt.volunteer_rating) AS avg_rating,
    COUNT(DISTINCT vt.id) AS tasks_completed
FROM volunteer_status vs
JOIN events e ON vs.event_id = e.id
LEFT JOIN volunteer_tasks vt ON vs.user_id = vt.assigned_to AND vt.status = 'completed'
GROUP BY vs.event_id, e.title;

-- ============================================
-- 5. SAMPLE DATA
-- ============================================

-- Insert sample event zones
INSERT INTO event_zones (event_id, zone_name, zone_color, zone_description, capacity, min_staff_required, max_staff_allowed)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Registration Desk', '#3B82F6', 'Main check-in and registration area', 10, 3, 5),
    ('11111111-1111-1111-1111-111111111111', 'Auditorium', '#10B981', 'Main event space', 50, 5, 10),
    ('11111111-1111-1111-1111-111111111111', 'VIP Lounge', '#8B5CF6', 'Exclusive area for VIPs', 5, 1, 2),
    ('11111111-1111-1111-1111-111111111111', 'Networking Zone', '#F59E0B', 'Networking and social area', 20, 2, 4);

-- Insert sample volunteer shifts
INSERT INTO volunteer_shifts (event_id, user_id, shift_start, shift_end, shift_type, zone_id)
SELECT 
    '11111111-1111-1111-1111-111111111111',
    user_id,
    CURRENT_DATE + '08:00:00'::TIME,
    CURRENT_DATE + '17:00:00'::TIME,
    'full_day',
    (SELECT id FROM event_zones WHERE event_id = '11111111-1111-1111-1111-111111111111' LIMIT 1)
FROM (
    SELECT user_id FROM profiles LIMIT 10
) t;

-- Insert sample volunteer statuses
INSERT INTO volunteer_status (event_id, user_id, status, check_in_time, shift_start, shift_end, current_zone)
SELECT 
    '11111111-1111-1111-1111-111111111111',
    user_id,
    CASE (EXTRACT(MINUTE FROM now())::INT % 3)
        WHEN 0 THEN 'available'
        WHEN 1 THEN 'busy'
        ELSE 'on_break'
    END,
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_DATE + '08:00:00'::TIME,
    CURRENT_DATE + '17:00:00'::TIME,
    (SELECT zone_name FROM event_zones WHERE event_id = '11111111-1111-1111-1111-111111111111' LIMIT 1)
FROM (
    SELECT user_id FROM profiles LIMIT 10
) t
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Insert sample tasks
INSERT INTO volunteer_tasks (event_id, assigned_to, assigned_by, task_title, task_description, task_priority, status, assigned_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'user-001', 'organizer-001', 'Set up registration desk', 'Arrange tables, chairs, and registration materials', 'high', 'assigned', NOW()),
    ('11111111-1111-1111-1111-111111111111', 'user-002', 'organizer-001', 'Get coffee for VIPs', 'Pick up coffee from the cafeteria for VIP lounge', 'medium', 'assigned', NOW());

-- ============================================
-- 6. USAGE EXAMPLES
-- ============================================

-- Get staffing matrix
/*
SELECT * FROM get_staffing_matrix('your-event-id-here');
*/

-- Get volunteer stats
/*
SELECT * FROM get_volunteer_stats('your-event-id-here');
*/

-- Update volunteer status
/*
SELECT * FROM update_volunteer_status(
    'event-id-here',
    'user-id-here',
    'available'
);
*/

-- Assign task to volunteer
/*
SELECT * FROM assign_task_to_volunteer(
    'event-id-here',
    'volunteer-id-here',
    'organizer-id-here',
    'Get more water bottles',
    'Go to storage room and bring 20 water bottles to registration desk',
    'high'
);
*/

-- Auto check-in volunteer
/*
SELECT * FROM auto_check_in_volunteer(
    'event-id-here',
    'user-id-here',
    'zone-id-here'
);
*/

-- ============================================
-- 7. CLEANUP
-- ============================================

/*
DROP VIEW IF EXISTS command_center;
DROP TABLE IF EXISTS volunteer_shifts;
DROP TABLE IF EXISTS event_zones;
DROP TABLE IF EXISTS volunteer_tasks;
DROP TABLE IF EXISTS volunteer_status;
DROP FUNCTION IF EXISTS get_staffing_matrix(UUID);
DROP FUNCTION IF EXISTS get_volunteer_stats(UUID);
DROP FUNCTION IF EXISTS assign_task_to_volunteer(UUID, UUID, UUID, TEXT, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS update_volunteer_status(UUID, UUID, VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS auto_check_in_volunteer(UUID, UUID, UUID);
*/
