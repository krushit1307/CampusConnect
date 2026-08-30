-- Migration: 20260866000000_wallet_agenda_push_sync.sql
-- Description: Interactive Event Schedule Custom Agenda Push Sync for Apple Wallet / Google Wallet passes (#4671)

CREATE TABLE IF NOT EXISTS public.user_wallet_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pass_type_identifier TEXT NOT NULL DEFAULT 'pass.com.campusconnect.event',
  serial_number TEXT NOT NULL UNIQUE,
  push_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_pass_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pass_serial TEXT NOT NULL REFERENCES public.user_wallet_passes(serial_number) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'added', 'removed', 'updated'
  apns_payload_sent JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for wallet pass search and sync logs
CREATE INDEX IF NOT EXISTS idx_user_wallet_passes_user ON public.user_wallet_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_pass_sync_logs_serial ON public.wallet_pass_sync_logs(pass_serial);

-- Enable RLS
ALTER TABLE public.user_wallet_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_pass_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read user wallet passes"
ON public.user_wallet_passes FOR SELECT
USING (true);

CREATE POLICY "Public read wallet pass sync logs"
ON public.wallet_pass_sync_logs FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage user wallet passes"
ON public.user_wallet_passes FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated manage wallet pass sync logs"
ON public.wallet_pass_sync_logs FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.user_wallet_passes TO authenticated, anon;
GRANT ALL ON public.wallet_pass_sync_logs TO authenticated, anon;
