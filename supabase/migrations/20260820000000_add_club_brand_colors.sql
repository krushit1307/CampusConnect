-- Migration: Add dynamic brand color columns to the clubs table
--
-- Per-club theming: each club can configure a Primary and Secondary brand
-- color shown on its public profile. NULL means "use the CampusConnect
-- defaults", so existing clubs keep rendering exactly as before.
--
-- The CHECK constraints are the authoritative backend validation: only strict
-- 3- or 6-digit hex values are ever stored, which prevents CSS injection
-- (e.g. `#FFF; display:none`) from reaching generated styles.

ALTER TABLE public.clubs
ADD COLUMN primary_color TEXT DEFAULT NULL,
ADD COLUMN secondary_color TEXT DEFAULT NULL;

ALTER TABLE public.clubs
ADD CONSTRAINT check_clubs_primary_color
CHECK (primary_color IS NULL OR primary_color ~ '^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$');

ALTER TABLE public.clubs
ADD CONSTRAINT check_clubs_secondary_color
CHECK (secondary_color IS NULL OR secondary_color ~ '^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$');
