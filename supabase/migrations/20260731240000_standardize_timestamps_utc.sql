-- Migration: Standardize all timestamps to timestamptz (UTC)
-- Timestamp: 20260731240000

-- 1. Explicitly standardize columns in events table if they exist as raw timestamp
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'start_time' AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE public.events ALTER COLUMN start_time TYPE timestamptz USING start_time AT TIME ZONE 'UTC';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'start_date' AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE public.events ALTER COLUMN start_date TYPE timestamptz USING start_date AT TIME ZONE 'UTC';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'end_date' AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE public.events ALTER COLUMN end_date TYPE timestamptz USING end_date AT TIME ZONE 'UTC';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'event_date' AND data_type = 'timestamp without time zone'
    ) THEN
        ALTER TABLE public.events ALTER COLUMN event_date TYPE timestamptz USING event_date AT TIME ZONE 'UTC';
    END IF;
END $$;

-- 2. Dynamically scan and convert every table and column of type 'timestamp without time zone' in the public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND data_type = 'timestamp without time zone'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', 
            r.table_name, r.column_name, r.column_name
        );
    END LOOP;
END $$;
