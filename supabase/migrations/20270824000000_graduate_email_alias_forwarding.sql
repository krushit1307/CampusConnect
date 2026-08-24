-- Migration: 20270824000000_graduate_email_alias_forwarding.sql
-- Description: Schema for the Automated "Graduating Senior" Email Forwarding
--              system (#4425).
--
-- When a graduating officer held a role that receives external mail
-- (president@..., treasurer@...), the audit_graduates pass must be able to:
--   1. see which public alias that officer was holding,
--   2. offer the incoming officer the chance to inherit it, and
--   3. re-map where inbound mail is delivered -- same address, new inbox --
--      without sponsors ever noticing a handover happened.
--
-- Two tables carry that story:
--   email_alias_routes            the stable routing rules (one per alias)
--   email_alias_inheritance_offers  prompts issued to successors during the
--                                 graduation audit, and their outcomes
--
-- The public alias address NEVER changes across a handover; only
-- forward_to_inbox / holder_user_id do. `generation` increments on every
-- successful re-map so operators can tell at a glance how many times an alias
-- has changed hands.

-- 1. Routing rules backing external aliases.
CREATE TABLE IF NOT EXISTS email_alias_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  alias_address TEXT NOT NULL,
  role_title TEXT NOT NULL,
  holder_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  forward_to_inbox TEXT NOT NULL CHECK (forward_to_inbox ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  provider TEXT NOT NULL DEFAULT 'mock'
    CHECK (provider IN ('sendgrid', 'mailgun', 'mock')),
  provider_route_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING_HANDOVER', 'RELEASED')),
  generation INTEGER NOT NULL DEFAULT 0 CHECK (generation >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN email_alias_routes.alias_address IS
  'The public address sponsors write to; never changes across handovers.';
COMMENT ON COLUMN email_alias_routes.forward_to_inbox IS
  'Personal inbox currently receiving forwarded mail (#4425).';
COMMENT ON COLUMN email_alias_routes.generation IS
  'Incremented on every successful re-map; cheap handover audit counter.';

-- One routing rule per alias; case-insensitive uniqueness without CITEXT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_alias_routes_address
  ON email_alias_routes (LOWER(alias_address));

CREATE INDEX IF NOT EXISTS idx_email_alias_routes_club_status
  ON email_alias_routes (club_id, status);

CREATE INDEX IF NOT EXISTS idx_email_alias_routes_holder
  ON email_alias_routes (holder_user_id)
  WHERE status = 'ACTIVE';

-- 2. Inheritance offers produced by the audit pass.
CREATE TABLE IF NOT EXISTS email_alias_inheritance_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_route_id UUID NOT NULL REFERENCES email_alias_routes(id) ON DELETE CASCADE,
  outgoing_holder_user_id UUID NOT NULL REFERENCES auth.users(id),
  successor_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  CONSTRAINT offer_expiry_follows_creation CHECK (expires_at > created_at),
  -- A response timestamp requires a terminal status.
  CONSTRAINT offer_response_requires_terminal_state CHECK (
    (responded_at IS NULL) OR (status IN ('ACCEPTED', 'DECLINED', 'EXPIRED'))
  )
);

CREATE INDEX IF NOT EXISTS idx_email_alias_offers_successor_pending
  ON email_alias_inheritance_offers (successor_user_id, status)
  WHERE status = 'PENDING';

-- 3. Row-level security: club members can read routing state; a successor may
--    answer their own prompt; nobody else writes offers directly.
ALTER TABLE email_alias_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_alias_inheritance_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alias routes readable by authenticated users"
  ON email_alias_routes;
CREATE POLICY "alias routes readable by authenticated users"
  ON email_alias_routes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "offers readable by involved parties"
  ON email_alias_inheritance_offers;
CREATE POLICY "offers readable by involved parties"
  ON email_alias_inheritance_offers FOR SELECT
  TO authenticated
  USING (
    successor_user_id = auth.uid()
    OR outgoing_holder_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "successors respond to their own offers"
  ON email_alias_inheritance_offers;
CREATE POLICY "successors respond to their own offers"
  ON email_alias_inheritance_offers FOR UPDATE
  TO authenticated
  USING (successor_user_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (successor_user_id = auth.uid());

-- Offers are created exclusively by the audit_graduates job, which runs with
-- elevated privileges (service role) and therefore needs no INSERT policy.
