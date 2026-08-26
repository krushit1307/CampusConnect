-- 1. Create the Supabase Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('club_vaults', 'club_vaults', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create vault_documents table
CREATE TABLE vault_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vault_documents_club ON vault_documents(club_id);
CREATE INDEX idx_vault_documents_category ON vault_documents(category);

-- 3. Create vault_audit_log table
CREATE TABLE vault_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on tables
ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. Vault Documents RLS Policies
-- Only club executives (president, vice_president, treasurer, secretary, admin) can view documents
CREATE POLICY "executives_can_view_vault"
ON vault_documents
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM club_members
        WHERE club_members.club_id = vault_documents.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- Only club executives can upload documents
CREATE POLICY "executives_can_upload"
ON vault_documents
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM club_members
        WHERE club_members.club_id = vault_documents.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- Executives can delete their club's documents
CREATE POLICY "executives_can_delete"
ON vault_documents
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM club_members
        WHERE club_members.club_id = vault_documents.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- 6. Storage Bucket RLS Policies
-- Executives can select objects in their club's folder
CREATE POLICY "Executives can view club vault objects"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'club_vaults' AND
    EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id::text = (string_to_array(name, '/'))[1]
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- Executives can upload objects to their club's folder
CREATE POLICY "Executives can insert club vault objects"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'club_vaults' AND
    EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id::text = (string_to_array(name, '/'))[1]
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- Executives can delete objects from their club's folder
CREATE POLICY "Executives can delete club vault objects"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'club_vaults' AND
    EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id::text = (string_to_array(name, '/'))[1]
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);
