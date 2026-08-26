CREATE OR REPLACE FUNCTION get_recommended_events(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    relevance_score INT,
    recommendation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH UserData AS (
        -- Get the user's college/major to match against events
        SELECT college FROM profiles WHERE id = p_user_id
    ),
    UserFriends AS (
        -- Find people in the same clubs (Social Graph)
        SELECT DISTINCT user_id 
        FROM club_members 
        WHERE club_id IN (SELECT club_id FROM club_members WHERE user_id = p_user_id)
        AND user_id != p_user_id
    ),
    ScoredEvents AS (
        SELECT 
            e.id, 
            e.title, 
            e.description,
            (
                -- Base score
                0 
                -- +10 points if friends/club members are attending
                + COALESCE((SELECT 10 FROM event_rsvps er WHERE er.event_id = e.id AND er.user_id IN (SELECT user_id FROM UserFriends) LIMIT 1), 0)
                -- +5 points if the event is happening very soon (within 3 days)
                + CASE WHEN e.event_date <= (NOW() + INTERVAL '3 days') THEN 5 ELSE 0 END
            ) AS relevance_score,
            CASE 
                WHEN (SELECT COUNT(*) FROM event_rsvps er WHERE er.event_id = e.id AND er.user_id IN (SELECT user_id FROM UserFriends)) > 0 
                THEN 'Your club members are attending'::TEXT
                ELSE 'Popular on campus right now'::TEXT
            END AS recommendation_reason
        FROM events e
        WHERE e.event_date > NOW() 
        -- Don't recommend events they are already going to
        AND e.id NOT IN (SELECT event_id FROM event_rsvps WHERE user_id = p_user_id)
    )
    SELECT 
        se.id, 
        se.title, 
        se.description, 
        se.relevance_score, 
        se.recommendation_reason
    FROM ScoredEvents se
    WHERE se.relevance_score > 0
    ORDER BY se.relevance_score DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;
