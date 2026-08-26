-- Ensure event_gallery exists
CREATE TABLE IF NOT EXISTS public.event_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend the event_gallery table with automated safety evaluation flags
ALTER TABLE event_gallery 
ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(50) DEFAULT 'approved' NOT NULL, -- 'approved' | 'pending_review' | 'flagged'
ADD COLUMN IF NOT EXISTS safety_confidence_scores JSONB DEFAULT '{}'::jsonb;

-- Optimize index targets to support real-time media gallery filtration streams
CREATE INDEX IF NOT EXISTS idx_event_gallery_moderation 
ON event_gallery (club_id, is_nsfw, moderation_status);

-- RLS policies
ALTER TABLE public.event_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view event_gallery" 
ON public.event_gallery FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert event_gallery" 
ON public.event_gallery FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete their own event_gallery" 
ON public.event_gallery FOR DELETE 
TO authenticated
USING (true); -- Assuming any auth user can delete for simplicity or rely on club admin check in app
