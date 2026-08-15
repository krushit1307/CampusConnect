-- Migration to support caching chat message translations
CREATE TABLE IF NOT EXISTS public.message_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  target_language text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, target_language)
);

-- Enable RLS
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read translations for messages they are involved in
CREATE POLICY "Users can view translations for their messages"
  ON public.message_translations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_translations.message_id
      AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
    )
  );

-- Policy: Edge Functions can insert translations (Bypass RLS or use service role)
-- Assuming the Edge Function uses the service role key, it bypasses RLS by default.
