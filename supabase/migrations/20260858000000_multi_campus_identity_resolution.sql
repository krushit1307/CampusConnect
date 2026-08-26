-- Migration: 20260858000000_multi_campus_identity_resolution.sql
-- Description: Dynamic Multi-Campus Identity Resolution & Cross-Instance Transfer with JWT cryptography (#4293)

CREATE TABLE IF NOT EXISTS public.multi_campus_identity_migrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_campus_id TEXT NOT NULL,
  target_campus_id TEXT NOT NULL,
  source_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  migration_token TEXT NOT NULL UNIQUE,
  transferred_points INT DEFAULT 0,
  transferred_rsvps_count INT DEFAULT 0,
  transferred_certificates_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued', -- 'issued', 'completed', 'disabled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for cross-campus identity migration lookup
CREATE INDEX IF NOT EXISTS idx_multi_campus_identity_token ON public.multi_campus_identity_migrations(migration_token);

-- Enable RLS
ALTER TABLE public.multi_campus_identity_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read multi campus identity migrations"
ON public.multi_campus_identity_migrations FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage multi campus identity migrations"
ON public.multi_campus_identity_migrations FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.multi_campus_identity_migrations TO authenticated, anon;
