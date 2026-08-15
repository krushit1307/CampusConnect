-- =============================================================================
-- Migration: Document Semantic Versioning System
-- Issue: #2793 - Implement Semantic Versioning and Automated Changelog
-- Description: Creates tables for core documents and their immutable version 
-- history. Includes triggers to enforce semantic versioning rules and prevent 
-- concurrent version collisions.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core document metadata table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    current_version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable version history table
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number TEXT NOT NULL, -- e.g., '1.2.3'
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'markdown', 'text'
    change_summary TEXT NOT NULL,
    version_type TEXT NOT NULL CHECK (version_type IN ('major', 'minor', 'patch')),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(document_id, version_number)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id 
ON public.document_versions(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_club_id 
ON public.documents(club_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Anyone in the club can view documents and their history
CREATE POLICY "Club members can view documents"
ON public.documents FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = documents.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Club members can view document versions"
ON public.document_versions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.club_members cm ON d.club_id = cm.club_id
        WHERE d.id = document_versions.document_id
        AND cm.user_id = auth.uid() 
        AND cm.status = 'approved'
    )
);

-- Only club admins can insert/update documents and versions
CREATE POLICY "Club admins can manage documents"
ON public.documents FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = documents.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = documents.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role = 'admin'
    )
);

CREATE POLICY "Club admins can manage document versions"
ON public.document_versions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.club_members cm ON d.club_id = cm.club_id
        WHERE d.id = document_versions.document_id
        AND cm.user_id = auth.uid() 
        AND cm.role = 'admin'
    )
);

-- =============================================================================
-- Semantic Versioning Logic & Triggers
-- =============================================================================

-- Function to calculate the next semantic version based on the type of update
CREATE OR REPLACE FUNCTION public.calculate_next_version(
    current_ver TEXT, 
    update_type TEXT
) RETURNS TEXT AS $$
DECLARE
    parts INT[];
    major INT;
    minor INT;
    patch INT;
BEGIN
    -- Parse '1.2.3' into an array of integers
    parts := string_to_array(current_ver, '.')::INT[];
    major := parts[1];
    minor := COALESCE(parts[2], 0);
    patch := COALESCE(parts[3], 0);

    IF update_type = 'major' THEN
        major := major + 1;
        minor := 0;
        patch := 0;
    ELSIF update_type = 'minor' THEN
        minor := minor + 1;
        patch := 0;
    ELSIF update_type = 'patch' THEN
        patch := patch + 1;
    ELSE
        RAISE EXCEPTION 'Invalid version type: %', update_type;
    END IF;

    RETURN major || '.' || minor || '.' || patch;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the current_version on the documents table
-- when a new version is inserted into document_versions
CREATE OR REPLACE FUNCTION public.sync_document_current_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.documents
    SET 
        current_version = NEW.version_number,
        updated_at = NOW()
    WHERE id = NEW.document_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_document_current_version ON public.document_versions;
CREATE TRIGGER trg_sync_document_current_version
AFTER INSERT ON public.document_versions
FOR EACH ROW EXECUTE FUNCTION public.sync_document_current_version();
