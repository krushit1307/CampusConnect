ALTER TABLE profiles
ADD COLUMN notification_preferences JSONB
NOT NULL
DEFAULT '{"rsvps": true, "digest": true, "certs": true}'::jsonb;

ALTER TABLE profiles
ADD CONSTRAINT profiles_notification_preferences_valid
CHECK (
    jsonb_typeof(notification_preferences) = 'object'
    AND notification_preferences ? 'rsvps'
    AND notification_preferences ? 'digest'
    AND notification_preferences ? 'certs'
    AND jsonb_typeof(notification_preferences->'rsvps') = 'boolean'
    AND jsonb_typeof(notification_preferences->'digest') = 'boolean'
    AND jsonb_typeof(notification_preferences->'certs') = 'boolean'
);