-- ============================================================
-- Migration: 20260720040000_split_full_name.sql
-- Description:
-- Splits profiles.full_name into first_name and last_name columns,
-- migrates existing data, then drops the full_name column.
-- ============================================================

-- 1. Add new columns (nullable initially to avoid constraint issues)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Migrate existing data:
--    - first_name: text before first space (or the whole string if no space)
--    - last_name:  text after first space (or NULL if no space)
UPDATE profiles
SET
  first_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM 1 FOR POSITION(' ' IN full_name) - 1)
    ELSE full_name
  END,
  last_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND full_name != '';

-- 3. Drop the old full_name column
ALTER TABLE profiles
DROP COLUMN IF EXISTS full_name;

-- 4. Add NOT NULL constraint after migration (since we migrated all data)
--    Future inserts via trigger will always provide both values
ALTER TABLE profiles
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;
