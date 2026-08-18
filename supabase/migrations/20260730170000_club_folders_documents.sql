-- Migration: Create club_folders and club_documents tables for deeply nested document management
-- Issue: #1956

-- ─── 1. club_folders table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_folders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.club_folders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS club_folders_club_id_idx ON public.club_folders(club_id);
CREATE INDEX IF NOT EXISTS club_folders_parent_id_idx ON public.club_folders(parent_id);
CREATE INDEX IF NOT EXISTS club_folders_order_idx ON public.club_folders(club_id, parent_id, order_index);

-- ─── 2. club_documents table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_documents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  folder_id   UUID REFERENCES public.club_folders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   BIGINT NOT NULL DEFAULT 0,
  mime_type   TEXT NOT NULL DEFAULT 'application/octet-stream',
  order_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS club_documents_club_id_idx ON public.club_documents(club_id);
CREATE INDEX IF NOT EXISTS club_documents_folder_id_idx ON public.club_documents(folder_id);
CREATE INDEX IF NOT EXISTS club_documents_order_idx ON public.club_documents(club_id, folder_id, order_index);

-- ─── 3. Triggers for updated_at ─────────────────────────────────────────────

CREATE TRIGGER set_updated_at_club_folders
BEFORE UPDATE ON public.club_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_club_documents
BEFORE UPDATE ON public.club_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 4. Circular reference prevention ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_folder_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A folder cannot be its own parent';
  END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM public.club_folders WHERE id = NEW.parent_id
      UNION ALL
      SELECT cf.id, cf.parent_id FROM public.club_folders cf
      INNER JOIN ancestors a ON a.parent_id = cf.id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Circular reference detected in folder hierarchy';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_club_folders_check_cycle
BEFORE INSERT OR UPDATE OF parent_id ON public.club_folders
FOR EACH ROW EXECUTE FUNCTION public.check_folder_cycle();

-- ─── 5. Row-Level Security ──────────────────────────────────────────────────

ALTER TABLE public.club_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_documents ENABLE ROW LEVEL SECURITY;

-- club_folders: members can read
CREATE POLICY "club_members_read_folders" ON public.club_folders
  FOR SELECT
  USING (public.is_club_member(club_id, auth.uid()) OR EXISTS (
    SELECT 1 FROM public.clubs WHERE id = club_folders.club_id AND created_by = auth.uid()
  ));

-- club_folders: admins can insert
CREATE POLICY "club_admins_create_folders" ON public.club_folders
  FOR INSERT
  WITH CHECK (
    public.is_club_admin(club_folders.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_folders.club_id AND created_by = auth.uid()
    )
  );

-- club_folders: admins can update
CREATE POLICY "club_admins_update_folders" ON public.club_folders
  FOR UPDATE
  USING (
    public.is_club_admin(club_folders.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_folders.club_id AND created_by = auth.uid()
    )
  );

-- club_folders: admins can delete
CREATE POLICY "club_admins_delete_folders" ON public.club_folders
  FOR DELETE
  USING (
    public.is_club_admin(club_folders.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_folders.club_id AND created_by = auth.uid()
    )
  );

-- club_documents: members can read
CREATE POLICY "club_members_read_documents" ON public.club_documents
  FOR SELECT
  USING (public.is_club_member(club_id, auth.uid()) OR EXISTS (
    SELECT 1 FROM public.clubs WHERE id = club_documents.club_id AND created_by = auth.uid()
  ));

-- club_documents: admins can insert
CREATE POLICY "club_admins_create_documents" ON public.club_documents
  FOR INSERT
  WITH CHECK (
    public.is_club_admin(club_documents.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_documents.club_id AND created_by = auth.uid()
    )
  );

-- club_documents: admins can update
CREATE POLICY "club_admins_update_documents" ON public.club_documents
  FOR UPDATE
  USING (
    public.is_club_admin(club_documents.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_documents.club_id AND created_by = auth.uid()
    )
  );

-- club_documents: admins can delete
CREATE POLICY "club_admins_delete_documents" ON public.club_documents
  FOR DELETE
  USING (
    public.is_club_admin(club_documents.club_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.clubs WHERE id = club_documents.club_id AND created_by = auth.uid()
    )
  );
