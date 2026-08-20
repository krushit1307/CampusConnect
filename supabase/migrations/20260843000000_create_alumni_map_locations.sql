-- 1. Add city location and map opt-in preference fields to user_profiles table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS current_city TEXT,
ADD COLUMN IF NOT EXISTS city_latitude NUMERIC(8, 4), -- City-level precision (max 4 decimals)
ADD COLUMN IF NOT EXISTS city_longitude NUMERIC(8, 4),
ADD COLUMN IF NOT EXISTS is_visible_on_alumni_map BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_user_prefs_alumni_map 
ON user_preferences(is_visible_on_alumni_map) 
WHERE is_visible_on_alumni_map = TRUE;