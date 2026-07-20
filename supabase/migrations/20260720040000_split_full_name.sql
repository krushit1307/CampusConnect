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

-- 2. Migrate existing data only if the old full_name column still exists
--    (fresh DBs created from schema.sql already have first_name/last_name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) THEN
    UPDATE profiles
    SET
      first_name = CASE
        WHEN full_name IS NULL OR full_name = '' THEN 'User'
        WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM 1 FOR POSITION(' ' IN full_name) - 1)
        ELSE full_name
      END,
      last_name = CASE
        WHEN full_name IS NULL OR full_name = '' THEN ''
        WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
        ELSE ''
      END;

    ALTER TABLE profiles DROP COLUMN full_name;
  END IF;
END $$;

-- 3. Add NOT NULL constraint after migration (ensures all rows have values)
ALTER TABLE profiles
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;
