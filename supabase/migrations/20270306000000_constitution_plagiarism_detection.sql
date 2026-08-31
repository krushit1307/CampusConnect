-- Issue #4033: Automated plagiarism detection for club constitutions.
-- Similarity results are stored on the existing review record so only authorized
-- reviewers can inspect source-document matches through existing RLS policies.

ALTER TABLE public.constitution_documents
  ADD COLUMN IF NOT EXISTS plagiarism_score NUMERIC NOT NULL DEFAULT 0
    CHECK (plagiarism_score >= 0 AND plagiarism_score <= 1),
  ADD COLUMN IF NOT EXISTS plagiarism_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plagiarism_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS plagiarism_scanned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_constitution_plagiarism_review
  ON public.constitution_documents (plagiarism_review_required, created_at DESC)
  WHERE plagiarism_review_required = TRUE;

COMMENT ON COLUMN public.constitution_documents.plagiarism_score IS
  'Highest cosine similarity to another active constitution, from 0 to 1.';
COMMENT ON COLUMN public.constitution_documents.plagiarism_matches IS
  'Reviewer-only JSON matches containing source document IDs and duplicated paragraphs.';
COMMENT ON COLUMN public.constitution_documents.plagiarism_review_required IS
  'True when the highest similarity is at or above the 85% review threshold.';

-- The scanner runs with the service role and writes these fields after upload;
-- existing constitution-document RLS controls who can read them.
