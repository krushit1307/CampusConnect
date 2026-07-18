CREATE INDEX
IF NOT EXISTS idx_club_members_club_id
ON club_members
(club_id);

CREATE INDEX
IF NOT EXISTS idx_club_members_user_id
ON club_members
(user_id);

CREATE INDEX
IF NOT EXISTS idx_event_rsvps_event_id
ON event_rsvps
(event_id);

CREATE INDEX
IF NOT EXISTS idx_event_rsvps_user_id
ON event_rsvps
(user_id);

CREATE INDEX
IF NOT EXISTS idx_posts_club_id
ON posts
(club_id);

CREATE INDEX
IF NOT EXISTS idx_comments_post_id
ON comments
(post_id);