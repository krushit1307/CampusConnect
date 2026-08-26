-- Add CHECK constraint on profiles.handle to enforce url-friendly format
ALTER TABLE profiles
ADD CONSTRAINT check_profiles_handle_format
CHECK (handle ~ '^[a-z0-9_]{3,15}$');
