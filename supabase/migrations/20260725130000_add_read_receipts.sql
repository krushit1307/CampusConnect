ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_direct_messages_read_at
ON public.direct_messages (read_at)
WHERE read_at IS NULL;
