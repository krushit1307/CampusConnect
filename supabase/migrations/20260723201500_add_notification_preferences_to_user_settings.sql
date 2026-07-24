-- Migration: Add notification_preferences column to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "assignedAt": "2026-07-23T05:34:32.948Z",
  "lastActivityAt": "2026-07-23T05:34:32.948Z",
  "reminder12SentAt": null,
  "reminder18SentAt": null,
  "expiredAt": null,
  "welcomeSentAt": "2026-07-23T05:34:32.948Z",
  "welcomeSource": "claim",
  "guidance": {},
  "processedClaimCommentIds": [5054847427],
  "processedUnclaimCommentIds": []
}'::jsonb;