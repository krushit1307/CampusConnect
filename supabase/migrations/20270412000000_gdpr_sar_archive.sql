-- =============================================================================
-- Issue #4733 - Automated GDPR Subject Access Request (SAR)
-- Queue a 1-click archive, fan-out the legally required tables, and deliver
-- an encrypted download link that expires within 30 days.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gdpr_sar_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  storage_path TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_by TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  download_expires_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_gdpr_sar_requests_pending
  ON public.gdpr_sar_requests (status, requested_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.gdpr_sar_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own SAR requests" ON public.gdpr_sar_requests;
CREATE POLICY "Users can view their own SAR requests"
  ON public.gdpr_sar_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own SAR requests" ON public.gdpr_sar_requests;
CREATE POLICY "Users can create their own SAR requests"
  ON public.gdpr_sar_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.gdpr_sar_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.gdpr_sar_table_rows(p_user_id UUID, p_table TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  where_sql TEXT;
  cols TEXT[] := ARRAY[]::TEXT[];
  col TEXT;
BEGIN
  IF p_table IS NULL OR p_table !~ '^[a-z_][a-z0-9_]*$' THEN
    RETURN result;
  END IF;
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN result;
  END IF;

  FOREACH col IN ARRAY ARRAY['user_id', 'member_id', 'author_id', 'reviewer_id', 'sender_id', 'receiver_id']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = col
    ) THEN
      cols := cols || col;
    END IF;
  END LOOP;

  IF p_table IN ('users', 'profiles') AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'id'
  ) THEN
    cols := cols || 'id';
  END IF;

  IF array_length(cols, 1) IS NULL THEN
    RETURN result;
  END IF;

  SELECT string_agg(format('%I = $1', c), ' OR ') INTO where_sql FROM unnest(cols) AS c;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE %s',
    p_table,
    where_sql
  ) INTO result USING p_user_id;

  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.gdpr_sar_merge(VARIADIC parts JSONB[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
  FROM unnest(parts) AS part,
  LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(part) = 'array' THEN part ELSE '[]'::jsonb END
  ) AS elem;
$$;

CREATE OR REPLACE FUNCTION public.compile_gdpr_sar_dataset(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dues JSONB := '[]'::jsonb;
BEGIN
  IF to_regclass('public.club_dues_payments') IS NOT NULL
     AND to_regclass('public.club_dues_invoices') IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      INTO dues
    FROM public.club_dues_payments p
    JOIN public.club_dues_invoices i ON i.id = p.invoice_id
    WHERE i.member_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'users', public.gdpr_sar_merge(
      public.gdpr_sar_table_rows(p_user_id, 'users'),
      public.gdpr_sar_table_rows(p_user_id, 'profiles')
    ),
    'event_rsvps', public.gdpr_sar_table_rows(p_user_id, 'event_rsvps'),
    'payments', public.gdpr_sar_merge(
      public.gdpr_sar_table_rows(p_user_id, 'payments'),
      coalesce(dues, '[]'::jsonb)
    ),
    'chat_logs', public.gdpr_sar_merge(
      public.gdpr_sar_table_rows(p_user_id, 'chat_logs'),
      public.gdpr_sar_table_rows(p_user_id, 'event_chat_messages'),
      public.gdpr_sar_table_rows(p_user_id, 'chat_messages')
    ),
    'support_tickets', public.gdpr_sar_merge(
      public.gdpr_sar_table_rows(p_user_id, 'support_tickets'),
      public.gdpr_sar_table_rows(p_user_id, 'event_live_tickets')
    ),
    'reviews', public.gdpr_sar_merge(
      public.gdpr_sar_table_rows(p_user_id, 'reviews'),
      public.gdpr_sar_table_rows(p_user_id, 'event_feedbacks'),
      public.gdpr_sar_table_rows(p_user_id, 'event_feedback'),
      public.gdpr_sar_table_rows(p_user_id, 'vendor_portfolio_reviews')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_sar_table_rows(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compile_gdpr_sar_dataset(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compile_gdpr_sar_dataset(UUID) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'data-exports',
  'data-exports',
  false,
  524288000,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(coalesce(allowed_mime_types, ARRAY[]::TEXT[]) || ARRAY['application/octet-stream'])
)
WHERE id = 'data-exports';
