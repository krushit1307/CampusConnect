-- Migration: 20260808190000_strict_jsonb_schema_validation.sql
-- Description: Enforce strict JSONB schema validation on profiles/users settings using Postgres CHECK constraints (#2157)

-- 1. Ensure settings column exists on public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"theme": "dark", "email_notifications": true}'::jsonb;

-- 2. Preliminary Sanitization & Backfill
-- Clean up any existing corrupted or malformed JSON payloads before adding the strict constraint.
UPDATE public.profiles
SET settings = jsonb_build_object(
    'theme', CASE 
        WHEN settings IS NOT NULL AND jsonb_typeof(settings->'theme') = 'string' THEN settings->>'theme'
        ELSE 'dark'
    END,
    'email_notifications', CASE 
        WHEN settings IS NOT NULL AND jsonb_typeof(settings->'email_notifications') = 'boolean' THEN (settings->'email_notifications')::boolean
        WHEN settings IS NOT NULL AND (settings->>'email_notifications') IN ('true', '1') THEN true
        ELSE true
    END
)
WHERE settings IS NULL 
   OR jsonb_typeof(settings) != 'object' 
   OR NOT (settings ? 'theme') 
   OR NOT (settings ? 'email_notifications') 
   OR jsonb_typeof(settings->'theme') != 'string' 
   OR jsonb_typeof(settings->'email_notifications') != 'boolean';

-- 3. Add strict CHECK constraint enforcing required keys and value types
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_settings_schema;

ALTER TABLE public.profiles
ADD CONSTRAINT check_settings_schema CHECK (
    settings IS NULL OR (
        jsonb_typeof(settings) = 'object'
        AND settings ? 'email_notifications'
        AND settings ? 'theme'
        AND jsonb_typeof(settings->'email_notifications') = 'boolean'
        AND jsonb_typeof(settings->'theme') = 'string'
    )
);
