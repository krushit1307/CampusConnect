-- Issue #3891: Interactive Club Constitution Ratification System
-- Active members must ratify the current constitution version after every upload.

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS constitution_ratification_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_club_members_ratification_required
  ON public.club_members (club_id, constitution_ratification_required)
  WHERE constitution_ratification_required = TRUE;

CREATE TABLE IF NOT EXISTS public.constitution_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  constitution_version INTEGER NOT NULL CHECK (constitution_version > 0),
  legal_name TEXT NOT NULL CHECK (char_length(btrim(legal_name)) BETWEEN 2 AND 200),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  signature_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id, constitution_version)
);

CREATE INDEX IF NOT EXISTS idx_constitution_signatures_club_version
  ON public.constitution_signatures (club_id, constitution_version);

CREATE INDEX IF NOT EXISTS idx_constitution_signatures_user
  ON public.constitution_signatures (user_id, club_id);

COMMENT ON TABLE public.constitution_signatures IS
  'Immutable member ratifications of a specific club constitution version.';
COMMENT ON COLUMN public.constitution_signatures.signature_hash IS
  'SHA-256 digest of the immutable ratification fields captured by the signing edge function.';

CREATE OR REPLACE FUNCTION public.block_constitution_signature_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'constitution_signatures rows are immutable and cannot be changed or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_constitution_signature_update
  ON public.constitution_signatures;
CREATE TRIGGER trg_block_constitution_signature_update
  BEFORE UPDATE ON public.constitution_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.block_constitution_signature_mutation();

DROP TRIGGER IF EXISTS trg_block_constitution_signature_delete
  ON public.constitution_signatures;
CREATE TRIGGER trg_block_constitution_signature_delete
  BEFORE DELETE ON public.constitution_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.block_constitution_signature_mutation();

ALTER TABLE public.constitution_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own constitution signatures"
  ON public.constitution_signatures;
CREATE POLICY "Members can view their own constitution signatures"
  ON public.constitution_signatures
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = constitution_signatures.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

-- A new uploaded version invalidates every active member's previous ratification.
CREATE OR REPLACE FUNCTION public.require_constitution_ratification_for_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.club_members
  SET constitution_ratification_required = TRUE
  WHERE club_id = NEW.club_id
    AND status = 'approved';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_constitution_ratification_for_upload
  ON public.club_documents;
CREATE TRIGGER trg_require_constitution_ratification_for_upload
  AFTER INSERT ON public.club_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.require_constitution_ratification_for_upload();

-- Newly approved members must ratify the current version before accessing member surfaces.
CREATE OR REPLACE FUNCTION public.require_constitution_ratification_for_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved')
    OR (TG_OP = 'UPDATE'
      AND NEW.status = 'approved'
      AND OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.constitution_ratification_required := EXISTS (
      SELECT 1
      FROM public.clubs
      WHERE id = NEW.club_id
        AND constitution_url IS NOT NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_constitution_ratification_for_new_member
  ON public.club_members;
CREATE TRIGGER trg_require_constitution_ratification_for_new_member
  BEFORE INSERT OR UPDATE OF status ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.require_constitution_ratification_for_new_member();
