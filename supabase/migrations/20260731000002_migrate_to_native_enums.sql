-- 1. Create custom Postgres ENUM types
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin', 'moderator');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled');

-- 2. Alter existing table columns to use native ENUMs with explicit casting
ALTER TABLE users 
  ALTER COLUMN role TYPE user_role 
  USING role::user_role;

ALTER TABLE events 
  ALTER COLUMN status TYPE event_status 
  USING status::event_status;