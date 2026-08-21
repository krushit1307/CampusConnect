-- Lost & Found Board
-- Allows students to post items they've lost or found on campus.

CREATE TABLE IF NOT EXISTS public.lost_found_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('lost', 'found')),
  title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description  TEXT        NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  category     TEXT        NOT NULL DEFAULT 'Other'
                 CHECK (category IN (
                   'Electronics', 'Documents', 'Keys', 'Clothing',
                   'Accessories', 'Books', 'Sports', 'Other'
                 )),
  location     TEXT,                               -- "Where was it lost/found?"
  image_url    TEXT,                               -- optional photo
  contact_info TEXT,                               -- optional contact (email / phone)
  status       TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update timestamp
CREATE OR REPLACE TRIGGER lost_found_items_updated_at
  BEFORE UPDATE ON public.lost_found_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS lost_found_items_user_id_idx  ON public.lost_found_items (user_id);
CREATE INDEX IF NOT EXISTS lost_found_items_type_idx     ON public.lost_found_items (type);
CREATE INDEX IF NOT EXISTS lost_found_items_status_idx   ON public.lost_found_items (status);
CREATE INDEX IF NOT EXISTS lost_found_items_created_idx  ON public.lost_found_items (created_at DESC);

-- Enable RLS
ALTER TABLE public.lost_found_items ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active items
CREATE POLICY "lost_found_select"
  ON public.lost_found_items FOR SELECT
  TO authenticated
  USING (status = 'active' OR user_id = auth.uid());

-- Only the owner can insert
CREATE POLICY "lost_found_insert"
  ON public.lost_found_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owner can update/resolve their own items
CREATE POLICY "lost_found_update"
  ON public.lost_found_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner can delete their own items
CREATE POLICY "lost_found_delete"
  ON public.lost_found_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_found_items;
