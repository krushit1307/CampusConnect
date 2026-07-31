-- Add image_url column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Recreate trending_posts materialized view to capture column changes (keeping original pinned column)
DROP MATERIALIZED VIEW IF EXISTS public.trending_posts CASCADE;

CREATE MATERIALIZED VIEW public.trending_posts AS
SELECT
    p.*,
    (
        (COALESCE(lc.like_count, 0) + COALESCE(cc.comment_count, 0) * 2)::numeric
        /
        POWER(
            ((EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) + 2),
            1.5
        )
    ) AS hotness_score
FROM public.posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) as like_count
    FROM public.post_reactions
    GROUP BY post_id
) lc ON p.id = lc.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as comment_count
    FROM public.comments
    GROUP BY post_id
) cc ON p.id = cc.post_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id ON public.trending_posts(id);
CREATE INDEX IF NOT EXISTS idx_trending_posts_hotness ON public.trending_posts(hotness_score DESC);

-- Create post-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-attachments', 'post-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for post-attachments storage bucket
CREATE POLICY "Public Access Post Attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'post-attachments');

CREATE POLICY "Authenticated users can upload post attachments" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'post-attachments'
);

CREATE POLICY "Users can delete their own post attachments" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'post-attachments' AND
  auth.uid() = owner
);
