-- Migration: 20260863000000_tax_exempt_irs_audit_exporter.sql
-- Description: Automated Tax-Exempt IRS Audit Trail Exporter compiling multi-asset ZIP discovery packages (#4667)

CREATE TABLE IF NOT EXISTS public.club_irs_audit_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL DEFAULT 2025,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  export_zip_filename TEXT NOT NULL,
  download_url TEXT DEFAULT NULL,
  download_expires_at TIMESTAMPTZ DEFAULT NULL,
  included_assets JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed', -- 'compiling', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for club audit export lookup
CREATE INDEX IF NOT EXISTS idx_club_irs_audit_exports_club ON public.club_irs_audit_exports(club_id, fiscal_year);

-- Enable RLS
ALTER TABLE public.club_irs_audit_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club officers read irs audit exports"
ON public.club_irs_audit_exports FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Club officers insert irs audit exports"
ON public.club_irs_audit_exports FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.club_irs_audit_exports TO authenticated, anon;
