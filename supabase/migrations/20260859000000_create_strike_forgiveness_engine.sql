-- 1. Ensure club_probations table supports expiration timestamps and expunged status
ALTER TABLE club_probations
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '365 days') NOT NULL;

-- 2. Stored procedure to expunge expired strikes and update club standing
CREATE OR REPLACE FUNCTION execute_strike_forgiveness()
RETURNS TABLE (
    expunged_strike_id UUID,
    club_id UUID,
    club_name TEXT,
    president_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH expunged_records AS (
        UPDATE club_probations cp
        SET status = 'expunged',
            updated_at = NOW()
        WHERE cp.status = 'active'
          AND cp.expires_at <= NOW()
        RETURNING cp.id AS strike_id, cp.club_id
    )
    SELECT 
        er.strike_id AS expunged_strike_id,
        c.id AS club_id,
        c.name AS club_name,
        u.email AS president_email
    FROM expunged_records er
    JOIN clubs c ON c.id = er.club_id
    LEFT JOIN club_memberships cm ON cm.club_id = c.id AND cm.role = 'president'
    LEFT JOIN auth.users u ON u.id = cm.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RLS policies to ignore expunged strikes for venue bookings
CREATE OR REPLACE FUNCTION is_club_in_good_standing(p_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM club_probations
        WHERE club_id = p_club_id
          AND status = 'active'
          AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;