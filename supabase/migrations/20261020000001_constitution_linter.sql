-- =============================================================================
-- Migration: Club Constitution Conflict Resolver
-- Issue: #3536 - Implement 'Club Constitution Conflict Resolver'
-- Description: Creates tables to store uploaded club constitutions and the 
-- AI-detected policy violations. Includes RLS policies to ensure only club 
-- admins can upload, and Student Union admins can review flagged documents.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Constitution Documents Table
CREATE TYPE constitution_status AS ENUM (
    'pending_review',
    'approved',
    'rejected',
    'requires_revision'
);
CREATE TABLE IF NOT EXISTS public.constitution_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    file_url TEXT NOT NULL,
    raw_text TEXT,
    status constitution_status NOT NULL DEFAULT 'pending_review',
    overall_risk_score NUMERIC DEFAULT 0,
    -- 0.0 to 1.0
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_constitution_club ON public.constitution_documents(club_id);
CREATE INDEX IF NOT EXISTS idx_constitution_status ON public.constitution_documents(status);
-- 2. Constitution Violations Table
CREATE TYPE violation_severity AS ENUM ('info', 'warning', 'severe');
CREATE TABLE IF NOT EXISTS public.constitution_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.constitution_documents(id) ON DELETE CASCADE,
    clause_reference TEXT,
    -- e.g., "Article 4, Section 2"
    quote TEXT NOT NULL,
    -- The exact text from the PDF
    reason TEXT NOT NULL,
    -- Why it violates the Master Rules
    severity violation_severity NOT NULL DEFAULT 'warning',
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_document ON public.constitution_violations(document_id);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON public.constitution_violations(severity);
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.constitution_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_violations ENABLE ROW LEVEL SECURITY;
-- Club Admins can view and insert their own club's constitutions
CREATE POLICY "Club admins can manage own constitutions" ON public.constitution_documents FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = constitution_documents.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = constitution_documents.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
);
-- Student Union Admins can view and update ALL constitutions
CREATE POLICY "Student Union admins can review all constitutions" ON public.constitution_documents FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
            AND role = 'student_union_admin'
    )
);
-- Violations inherit document permissions
CREATE POLICY "Users can view violations for accessible documents" ON public.constitution_violations FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.constitution_documents cd
            WHERE cd.id = constitution_violations.document_id
                AND (
                    EXISTS (
                        SELECT 1
                        FROM public.club_members cm
                        WHERE cm.club_id = cd.club_id
                            AND cm.user_id = auth.uid()
                            AND cm.role = 'admin'
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM public.profiles
                        WHERE id = auth.uid()
                            AND role = 'student_union_admin'
                    )
                )
        )
    );
