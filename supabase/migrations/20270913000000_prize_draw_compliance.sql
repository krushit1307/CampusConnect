-- Issue #4925: Prize Draw Compliance
--
-- A raffle is a lottery. The exemption that makes a small one legal depends on
-- quantitative limits measured against numbers a committee does not track: the
-- market value of the prizes rather than the cash spent on them, and where the
-- tickets were sold rather than how many.
--
-- Prizes carry a market value and a donated flag. A prize donated by a local
-- business costs nothing and counts at full value, so there is nowhere here to
-- record a prize as free.
--
-- The entrant set is frozen into a snapshot before anything is drawn, and the
-- snapshot is append-only: the whole point is that it cannot have changed
-- between the draw and the question about the draw.
--
-- Money is integer pence throughout.

CREATE TABLE IF NOT EXISTS public.prize_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  draw_type TEXT NOT NULL CHECK (draw_type IN ('INCIDENTAL', 'PRIVATE_SOCIETY', 'SPLIT_POT')),
  label TEXT NOT NULL,
  ticket_price_pence BIGINT NOT NULL CHECK (ticket_price_pence >= 0),
  sales_open_at TIMESTAMPTZ NOT NULL,
  sales_close_at TIMESTAMPTZ NOT NULL,
  draw_at TIMESTAMPTZ NOT NULL,
  -- How long a winner has to come forward before a redraw becomes possible.
  claim_window_ms BIGINT NOT NULL CHECK (claim_window_ms > 0),
  -- The person running the draw, who cannot be in it.
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- The event an incidental lottery is incidental to. Selling to people who are
  -- not there is what ends the exemption, so the link is required for that type.
  host_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DRAWN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sales_close_at > sales_open_at),
  CHECK (draw_at >= sales_close_at),
  CHECK (draw_type <> 'INCIDENTAL' OR host_event_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.draw_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES public.prize_draws(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  -- What it is worth, not what it cost.
  market_value_pence BIGINT NOT NULL CHECK (market_value_pence >= 0),
  donated BOOLEAN NOT NULL DEFAULT FALSE,
  -- Set when the prize arrived from a previous draw that went undrawn. A
  -- rollover lands on top of the receiving pool rather than instead of it.
  rolled_over_from_draw_id UUID REFERENCES public.prize_draws(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A valuation can be corrected, and a correction is a fact rather than a
-- choice, so it is never refused. The breach surfaces at the draw instead.
CREATE TABLE IF NOT EXISTS public.draw_prize_revaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id UUID NOT NULL REFERENCES public.draw_prizes(id) ON DELETE CASCADE,
  previous_value_pence BIGINT NOT NULL,
  new_value_pence BIGINT NOT NULL CHECK (new_value_pence >= 0),
  reason TEXT,
  revalued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revalued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.draw_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES public.prize_draws(id) ON DELETE CASCADE,
  entrant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  price_paid_pence BIGINT NOT NULL CHECK (price_paid_pence >= 0),
  -- False for a comped ticket or one whose cash never reached the account.
  -- Tickets issued are not revenue.
  banked BOOLEAN NOT NULL DEFAULT TRUE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The entrant set as it stood at the draw instant. One per draw, and nothing
-- updates it: an entry created afterwards cannot be folded in by re-running.
CREATE TABLE IF NOT EXISTS public.draw_snapshots (
  draw_id UUID PRIMARY KEY REFERENCES public.prize_draws(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL,
  -- Lexicographically sorted, so the ordering does not depend on insertion.
  entry_ids UUID[] NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count > 0),
  -- A fingerprint of the frozen list. Not a cryptographic commitment; enough
  -- that an auditor can see the set drawn from is the set that was frozen.
  digest TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.draw_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES public.prize_draws(id) ON DELETE CASCADE,
  -- 1 for the original draw, 2 and up for each redraw. A redraw is recorded as
  -- a new round rather than overwriting the first result, because the first
  -- result is the evidence that the original winner was given their chance.
  round INTEGER NOT NULL CHECK (round >= 1),
  winning_entry_id UUID NOT NULL REFERENCES public.draw_entries(id) ON DELETE RESTRICT,
  winner_entrant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- Stored so the selection can be reproduced from the snapshot.
  seed TEXT NOT NULL,
  snapshot_digest TEXT NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL,
  claim_deadline TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  superseded_by_round INTEGER,
  -- Split-pot only, from banked revenue. The odd penny goes to the society so
  -- the two shares reconstruct the total exactly.
  winner_share_pence BIGINT,
  society_share_pence BIGINT,
  UNIQUE (draw_id, round),
  CHECK (claim_deadline > drawn_at),
  CHECK (superseded_by_round IS NULL OR superseded_by_round > round)
);

-- One standing result per draw. Everything else has been superseded.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_standing_result_per_draw
  ON public.draw_results(draw_id)
  WHERE superseded_by_round IS NULL;

CREATE INDEX IF NOT EXISTS idx_draw_entries_draw
  ON public.draw_entries(draw_id, entrant_id);

CREATE INDEX IF NOT EXISTS idx_draw_prizes_draw
  ON public.draw_prizes(draw_id);

CREATE INDEX IF NOT EXISTS idx_prize_draws_society_status
  ON public.prize_draws(society_id, status, draw_at DESC);

-- The compliance position of every draw in one place: pool value counting
-- donated prizes at market value, banked revenue counting only cash that
-- arrived, and how far over the incidental cap the pool sits.
CREATE OR REPLACE VIEW public.prize_draw_compliance AS
SELECT
  d.id AS draw_id,
  d.society_id,
  d.draw_type,
  d.label,
  d.status,
  COALESCE(p.pool_value_pence, 0) AS pool_value_pence,
  COALESCE(p.donated_value_pence, 0) AS donated_value_pence,
  COALESCE(e.banked_revenue_pence, 0) AS banked_revenue_pence,
  COALESCE(e.entry_count, 0) AS entry_count,
  CASE
    WHEN d.draw_type = 'INCIDENTAL' THEN GREATEST(COALESCE(p.pool_value_pence, 0) - 50000, 0)
    ELSE 0
  END AS over_cap_pence
FROM public.prize_draws d
LEFT JOIN (
  SELECT
    draw_id,
    SUM(market_value_pence) AS pool_value_pence,
    SUM(CASE WHEN donated THEN market_value_pence ELSE 0 END) AS donated_value_pence
  FROM public.draw_prizes
  GROUP BY draw_id
) p ON p.draw_id = d.id
LEFT JOIN (
  SELECT
    draw_id,
    COUNT(*) AS entry_count,
    SUM(CASE WHEN banked THEN price_paid_pence ELSE 0 END) AS banked_revenue_pence
  FROM public.draw_entries
  GROUP BY draw_id
) e ON e.draw_id = d.id;

ALTER TABLE public.prize_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_prize_revaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_results ENABLE ROW LEVEL SECURITY;

-- A draw and its prizes are public: an entrant is entitled to know what they
-- are buying a ticket for before they buy it.
DROP POLICY IF EXISTS "Draws are readable" ON public.prize_draws;
CREATE POLICY "Draws are readable"
  ON public.prize_draws FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Prizes are readable" ON public.draw_prizes;
CREATE POLICY "Prizes are readable"
  ON public.draw_prizes FOR SELECT TO authenticated
  USING (TRUE);

-- The snapshot and the result are the audit trail, and an audit trail nobody
-- outside the committee can read is not an audit trail.
DROP POLICY IF EXISTS "Snapshots are readable" ON public.draw_snapshots;
CREATE POLICY "Snapshots are readable"
  ON public.draw_snapshots FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Results are readable" ON public.draw_results;
CREATE POLICY "Results are readable"
  ON public.draw_results FOR SELECT TO authenticated
  USING (TRUE);

-- Who bought which ticket is not. An entrant sees their own entries; the
-- society's committee sees the draw's.
DROP POLICY IF EXISTS "Entrants read their own entries" ON public.draw_entries;
CREATE POLICY "Entrants read their own entries"
  ON public.draw_entries FOR SELECT TO authenticated
  USING (
    entrant_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.prize_draws d
      JOIN public.club_members cm ON cm.club_id = d.society_id
      WHERE d.id = draw_entries.draw_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::TEXT IN ('admin', 'system_admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Revaluations are visible to the committee" ON public.draw_prize_revaluations;
CREATE POLICY "Revaluations are visible to the committee"
  ON public.draw_prize_revaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.draw_prizes pr
      JOIN public.prize_draws d ON d.id = pr.draw_id
      JOIN public.club_members cm ON cm.club_id = d.society_id
      WHERE pr.id = draw_prize_revaluations.prize_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND cm.role = 'admin'
    )
  );

-- Entry, the draw, and every redraw run server side. Each depends on the state
-- of the whole draw, and the snapshot has to be written before the selection.
REVOKE INSERT, UPDATE, DELETE ON public.prize_draws FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.draw_prizes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.draw_prize_revaluations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.draw_entries FROM anon, authenticated;
-- Nothing may update or delete a snapshot, ever. Its immutability is the whole
-- reason the record answers the question a losing entrant is asking.
REVOKE INSERT, UPDATE, DELETE ON public.draw_snapshots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.draw_results FROM anon, authenticated;
REVOKE ALL ON public.prize_draw_compliance FROM anon;
