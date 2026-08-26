-- Create an RPC to recommend clubs based on collaborative filtering.
-- This function finds clubs joined by users who share memberships with the target user,
-- excluding any clubs the target user is already in.

CREATE OR REPLACE FUNCTION get_collaborative_club_recommendations(target_user_id UUID)
RETURNS TABLE (
    club_id UUID,
    recommendation_score BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH my_clubs AS (
    -- Step 1 & 2: Get all clubs the target user is actively a member of
    SELECT club_id
    FROM club_members
    WHERE user_id = target_user_id
      AND status = 'approved'
),
similar_users AS (
    -- Step 3: Find other users who share one or more of those memberships
    SELECT DISTINCT cm.user_id
    FROM club_members cm
    INNER JOIN my_clubs mc ON mc.club_id = cm.club_id
    WHERE cm.user_id != target_user_id
      AND cm.status = 'approved'
)
-- Step 4 & 5: Retrieve additional clubs those similar users belong to, excluding already joined clubs
SELECT
    cm.club_id,
    COUNT(*) AS recommendation_score
FROM club_members cm
INNER JOIN similar_users su ON su.user_id = cm.user_id
WHERE cm.status = 'approved'
  AND cm.club_id NOT IN (SELECT club_id FROM my_clubs)
-- Step 6: Rank recommendations by frequency using COUNT(*)
GROUP BY cm.club_id
-- Step 7: Return the top 5 recommendations
ORDER BY recommendation_score DESC, cm.club_id ASC
LIMIT 5;
$$;
