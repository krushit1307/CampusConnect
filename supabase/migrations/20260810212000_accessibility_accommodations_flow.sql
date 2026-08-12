-- Migration: Accessibility Accommodations Flow Security + Database Foundation
-- Timestamp: 20260810212000

-- 1. Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add columns to event_rsvps and events tables
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS accommodations_requested TEXT;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS accommodation_deadline TIMESTAMPTZ;

-- 3. Add check constraint to events ensuring deadline is in the future/logical order
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_events_accommodation_deadline'
          AND conrelid = 'public.events'::regclass
    ) THEN
        ALTER TABLE public.events
        ADD CONSTRAINT chk_events_accommodation_deadline
        CHECK (accommodation_deadline IS NULL OR (
          (start_date IS NULL OR accommodation_deadline <= start_date) AND
          (event_date IS NULL OR accommodation_deadline <= event_date)
        ));
    END IF;
END $$;

-- 4. Create the accommodation_audit_logs table
CREATE TABLE IF NOT EXISTS public.accommodation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rsvp_id UUID NOT NULL,
    event_id UUID,
    club_id UUID,
    action TEXT NOT NULL DEFAULT 'VIEW_ACCOMMODATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security on accommodation_audit_logs
ALTER TABLE public.accommodation_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policy for viewing accommodation audit logs
DROP POLICY IF EXISTS "Admins can view accommodation audit logs" ON public.accommodation_audit_logs;
CREATE POLICY "Admins can view accommodation audit logs"
ON public.accommodation_audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'::public.user_role
  ) OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE clubs.id = accommodation_audit_logs.club_id
      AND clubs.created_by = auth.uid()
  )
);

-- Access control for inserting: Only through SECURITY DEFINER functions (which run as postgres/owner)
-- No explicit policy is needed for postgres/owner as it bypasses RLS.

-- 7. Define trigger function to encrypt accommodations_requested on save
CREATE OR REPLACE FUNCTION public.encrypt_accommodation_on_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
  v_encrypted BYTEA;
BEGIN
  -- Handle empty string conversions to NULL
  IF NEW.accommodations_requested = '' THEN
    NEW.accommodations_requested := NULL;
  END IF;

  -- Only encrypt if not null and doesn't already have prefix 'cipher:'
  IF NEW.accommodations_requested IS NOT NULL AND NEW.accommodations_requested NOT LIKE 'cipher:%' THEN
    BEGIN
      SELECT value INTO v_encryption_key FROM secrets.decrypted_secrets WHERE name = 'ACCOMMODATION_ENCRYPTION_KEY' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_encryption_key := NULL;
    END;

    IF v_encryption_key IS NULL THEN
      v_encryption_key := 'campus_connect_secret_default_key_2026';
    END IF;

    v_encrypted := pgp_sym_encrypt(NEW.accommodations_requested, v_encryption_key);
    NEW.accommodations_requested := 'cipher:' || encode(v_encrypted, 'base64');
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Bind trigger to public.event_rsvps table
DROP TRIGGER IF EXISTS trg_encrypt_accommodation ON public.event_rsvps;
CREATE TRIGGER trg_encrypt_accommodation
BEFORE INSERT OR UPDATE OF accommodations_requested ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_accommodation_on_save();

-- 9. Create RPC function to securely decrypt accommodations_requested
CREATE OR REPLACE FUNCTION public.get_decrypted_accommodation(p_rsvp_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted TEXT;
  v_user_id UUID;
  v_club_id UUID;
  v_event_id UUID;
  v_club_owner_id UUID;
  v_decrypted TEXT;
  v_encryption_key TEXT;
BEGIN
  -- Retrieve the encrypted accommodation and association IDs
  SELECT r.accommodations_requested, r.user_id, e.id, e.club_id, c.created_by
  INTO v_encrypted, v_user_id, v_event_id, v_club_id, v_club_owner_id
  FROM public.event_rsvps r
  JOIN public.events e ON r.event_id = e.id
  JOIN public.clubs c ON e.club_id = c.id
  WHERE r.id = p_rsvp_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RSVP record not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  -- Access Control:
  -- 1. The student who owns the RSVP
  -- 2. The primary Club President (creator of the club)
  IF auth.uid() IS NULL OR (auth.uid() <> v_user_id AND auth.uid() <> v_club_owner_id) THEN
    RAISE EXCEPTION 'Permission Denied: You are not authorized to view this accommodation request' USING ERRCODE = '42501';
  END IF;

  -- Retrieve encryption key
  BEGIN
    SELECT value INTO v_encryption_key FROM secrets.decrypted_secrets WHERE name = 'ACCOMMODATION_ENCRYPTION_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_encryption_key := NULL;
  END;

  IF v_encryption_key IS NULL THEN
    v_encryption_key := 'campus_connect_secret_default_key_2026';
  END IF;

  -- Decrypt
  IF v_encrypted NOT LIKE 'cipher:%' THEN
    v_decrypted := v_encrypted;
  ELSE
    BEGIN
      v_decrypted := pgp_sym_decrypt(decode(substring(v_encrypted from 8), 'base64'), v_encryption_key);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Decryption failed: could not decrypt stored request' USING ERRCODE = 'P0001';
    END;
  END IF;

  -- Record audit trail
  INSERT INTO public.accommodation_audit_logs (viewer_id, rsvp_id, event_id, club_id, action)
  VALUES (auth.uid(), p_rsvp_id, v_event_id, v_club_id, 'VIEW_ACCOMMODATION');

  RETURN v_decrypted;
END;
$$;

-- 10. Grant execution permissions on the decryption RPC
GRANT EXECUTE ON FUNCTION public.get_decrypted_accommodation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_accommodation(UUID) TO service_role;
