ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_profiles_handle_format;

ALTER TABLE public.profiles
ADD CONSTRAINT check_profiles_handle_format
CHECK (handle ~ '^[a-z0-9_]{3,15}$');
