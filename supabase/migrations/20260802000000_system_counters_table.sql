-- =============================================================================
-- Migration: 20260802000000_system_counters_table.sql
-- Purpose: Optimize massive COUNT(*) queries by maintaining real-time counts 
--          via PostgreSQL triggers, avoiding full table scans on large tables.
-- =============================================================================

-- 1. Create the system_counters table
CREATE TABLE IF NOT EXISTS public.system_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    row_count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_table_names CHECK (table_name IN ('events', 'profiles', 'clubs'))
);

-- 2. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_counters_table_name 
ON public.system_counters(table_name);

-- 3. Seed the table with current absolute counts
INSERT INTO public.system_counters (table_name, row_count)
SELECT 'events', COUNT(*) FROM public.events
ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count;

INSERT INTO public.system_counters (table_name, row_count)
SELECT 'profiles', COUNT(*) FROM public.profiles
ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count;

INSERT INTO public.system_counters (table_name, row_count)
SELECT 'clubs', COUNT(*) FROM public.clubs
ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count;

-- 4. Create the trigger function
CREATE OR REPLACE FUNCTION public.update_table_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT operations
    IF TG_OP = 'INSERT' THEN
        UPDATE public.system_counters 
        SET row_count = row_count + 1, 
            updated_at = NOW()
        WHERE table_name = TG_TABLE_NAME;
        
        -- Fallback insert if the row doesn't exist yet (edge case protection)
        IF NOT FOUND THEN
            INSERT INTO public.system_counters (table_name, row_count)
            VALUES (TG_TABLE_NAME, 1)
            ON CONFLICT (table_name) DO UPDATE 
            SET row_count = system_counters.row_count + 1, updated_at = NOW();
        END IF;
        
        RETURN NEW;
        
    -- Handle DELETE operations
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.system_counters 
        SET row_count = GREATEST(0, row_count - 1), 
            updated_at = NOW()
        WHERE table_name = TG_TABLE_NAME;
        
        RETURN OLD;
        
    -- Handle UPDATE operations (no count change, but update timestamp)
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.system_counters 
        SET updated_at = NOW()
        WHERE table_name = TG_TABLE_NAME;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach triggers to target tables
-- Events table
DROP TRIGGER IF EXISTS trg_update_events_count ON public.events;
CREATE TRIGGER trg_update_events_count
AFTER INSERT OR DELETE OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_table_count();

-- Profiles table (representing users)
DROP TRIGGER IF EXISTS trg_update_profiles_count ON public.profiles;
CREATE TRIGGER trg_update_profiles_count
AFTER INSERT OR DELETE OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_table_count();

-- Clubs table
DROP TRIGGER IF EXISTS trg_update_clubs_count ON public.clubs;
CREATE TRIGGER trg_update_clubs_count
AFTER INSERT OR DELETE OR UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.update_table_count();

-- 6. Enable Row Level Security (RLS) and policies
ALTER TABLE public.system_counters ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read counts
CREATE POLICY "Allow authenticated users to read system counters"
ON public.system_counters
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to manage counters (for seeding/maintenance)
CREATE POLICY "Allow service role to manage system counters"
ON public.system_counters
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
