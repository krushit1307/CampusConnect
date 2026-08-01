-- Migration: 20260725240000_exports_storage_bucket.sql
-- Description: Create private storage bucket 'exports' for payment/rsvp data exports.

-- 1. Create the private exports bucket in storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup RLS policies for exports bucket
-- Allow service_role full control by default, and allow authenticated users to select
DROP POLICY IF EXISTS "Service role has full access to exports" ON storage.objects;
CREATE POLICY "Service role has full access to exports" ON storage.objects
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can select exports" ON storage.objects;
CREATE POLICY "Authenticated users can select exports" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'exports');
