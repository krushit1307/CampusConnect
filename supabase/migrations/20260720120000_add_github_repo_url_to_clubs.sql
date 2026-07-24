-- Migration: Add github_repo_url column to clubs table with check constraint
-- Ensures github_repo_url starts with https://github.com/ if provided

ALTER TABLE public.clubs
ADD COLUMN github_repo_url TEXT;

ALTER TABLE public.clubs
ADD CONSTRAINT check_clubs_github_repo_url
CHECK (github_repo_url IS NULL OR github_repo_url LIKE 'https://github.com/%');
