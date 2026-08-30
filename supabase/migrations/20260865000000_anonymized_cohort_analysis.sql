-- Migration: 20260865000000_anonymized_cohort_analysis.sql
-- Description: Automated Data Privacy Anonymized Cohort Analysis with cryptographic RSVP re-parenting before PII destruction (#4670)

CREATE TABLE IF NOT EXISTS public.anonymized_cohorts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_hash TEXT NOT NULL UNIQUE,
  major TEXT NOT NULL,
  graduation_year INT NOT NULL,
  anonymized_users_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.anonymized_cohort_event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.anonymized_cohorts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cohort search and research analytics
CREATE INDEX IF NOT EXISTS idx_anonymized_cohorts_hash ON public.anonymized_cohorts(cohort_hash);
CREATE INDEX IF NOT EXISTS idx_anonymized_cohort_rsvps_cohort ON public.anonymized_cohort_event_rsvps(cohort_id, event_id);

-- Enable RLS
ALTER TABLE public.anonymized_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymized_cohort_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read anonymized cohorts"
ON public.anonymized_cohorts FOR SELECT
USING (true);

CREATE POLICY "Public read anonymized cohort event rsvps"
ON public.anonymized_cohort_event_rsvps FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage anonymized cohorts"
ON public.anonymized_cohorts FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated manage anonymized cohort rsvps"
ON public.anonymized_cohort_event_rsvps FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.anonymized_cohorts TO authenticated, anon;
GRANT ALL ON public.anonymized_cohort_event_rsvps TO authenticated, anon;
