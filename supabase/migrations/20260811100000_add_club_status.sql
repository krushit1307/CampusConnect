-- 1. Create the new Enum type for the status
CREATE TYPE club_status AS ENUM ('active', 'pending_renewal', 'suspended');

-- 2. Add the column to the existing clubs table and set 'active' as default
ALTER TABLE clubs 
ADD COLUMN status club_status DEFAULT 'active';
