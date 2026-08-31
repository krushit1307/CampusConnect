-- Migration for Real-Time "Accessibility Need" Closed Captioning Sync for VODs (#4994)

CREATE TABLE IF NOT EXISTS public.vod_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    raw_vtt_url TEXT, -- The out-of-sync live stream VTT
    synced_vtt_url TEXT, -- The highly accurate post-processed VTT
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vod_recordings_updated_at
BEFORE UPDATE ON public.vod_recordings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE public.vod_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ready VODs" ON public.vod_recordings 
FOR SELECT USING (status = 'ready');

