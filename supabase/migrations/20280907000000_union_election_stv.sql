-- Issue #5013: Student Union Election Count (Single Transferable Vote)
--
-- Ballot weights are integers in millionths of a vote. Floating point drift
-- across a hundred transfers is indistinguishable from a real difference at the
-- point it decides a seat, so nothing here is a float.
--
-- The register and the nomination deadline are frozen on the election row. A
-- candidate who was a registered student on nomination day and has since
-- withdrawn from their course was validly nominated; evaluating that against
-- NOW() gets it wrong, so nothing here evaluates against NOW().
--
-- Count stages are stored rather than derived. The output that matters is not
-- the winner; it is the record that lets a losing candidate follow the
-- arithmetic and arrive at the same place, which means it has to survive the
-- process that produced it.

CREATE TABLE IF NOT EXISTS public.union_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats > 0),
  -- Voters who joined after this do not vote in this election.
  register_closes_at TIMESTAMPTZ NOT NULL,
  nomination_closes_at TIMESTAMPTZ NOT NULL,
  poll_opens_at TIMESTAMPTZ NOT NULL,
  poll_closes_at TIMESTAMPTZ NOT NULL,
  counted_at TIMESTAMPTZ,
  -- Droop quota over the valid poll, in millionths. Computed once and held.
  quota_scaled BIGINT CHECK (quota_scaled IS NULL OR quota_scaled > 0),
  valid_poll INTEGER CHECK (valid_poll IS NULL OR valid_poll >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (poll_closes_at > poll_opens_at),
  CHECK (nomination_closes_at <= poll_opens_at)
);

CREATE TABLE IF NOT EXISTS public.election_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.union_elections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  -- Re-opening nominations is a candidate. It can reach the quota and take a
  -- seat, and that is a different outcome from a seat nobody stood for.
  is_reopen_nominations BOOLEAN NOT NULL DEFAULT FALSE,
  nominated_at TIMESTAMPTZ NOT NULL,
  -- Evaluated on nomination day. Withdrawing from a course later does not
  -- retrospectively invalidate a nomination.
  eligible_on_nomination_day BOOLEAN NOT NULL DEFAULT TRUE,
  disqualified_at TIMESTAMPTZ,
  disqualification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (disqualified_at IS NULL OR disqualification_reason IS NOT NULL),
  CHECK (is_reopen_nominations = FALSE OR user_id IS NULL)
);

CREATE INDEX IF NOT EXISTS election_candidates_election_idx
  ON public.election_candidates (election_id);

-- Exactly one RON per election, and it is not optional to get this right: a
-- second RON row would split the vote that re-runs the position.
CREATE UNIQUE INDEX IF NOT EXISTS election_candidates_single_ron
  ON public.election_candidates (election_id)
  WHERE is_reopen_nominations;

-- The register, frozen. Membership is recorded with the moment it began so the
-- count can ask whether somebody was a member *then*.
CREATE TABLE IF NOT EXISTS public.election_register (
  election_id UUID NOT NULL REFERENCES public.union_elections(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (election_id, voter_id)
);

CREATE TABLE IF NOT EXISTS public.election_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.union_elections(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cast_at TIMESTAMPTZ NOT NULL,
  -- Set only for ballots that never entered the count. A ballot that merely
  -- exhausts later is a valid ballot and this column stays null for it.
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL
    OR rejection_reason IN (
      'NO_PREFERENCES', 'DUPLICATE_PREFERENCE', 'NON_SEQUENTIAL_PREFERENCES',
      'UNKNOWN_CANDIDATE', 'VOTER_NOT_ON_REGISTER', 'DUPLICATE_BALLOT_FROM_VOTER'
    )
  ),
  rejection_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One ballot per voter per election. The count also rejects a second ballot,
-- but a constraint that only lives in application code is a constraint that
-- holds until somebody writes a script.
CREATE UNIQUE INDEX IF NOT EXISTS election_ballots_one_per_voter
  ON public.election_ballots (election_id, voter_id);

CREATE TABLE IF NOT EXISTS public.ballot_preferences (
  ballot_id UUID NOT NULL REFERENCES public.election_ballots(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank > 0),
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE RESTRICT,
  PRIMARY KEY (ballot_id, rank),
  -- The same candidate cannot be ranked twice on one ballot.
  UNIQUE (ballot_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.election_count_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.union_elections(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL CHECK (stage_number > 0),
  action TEXT NOT NULL CHECK (
    action IN ('FIRST_PREFERENCES', 'SURPLUS_TRANSFER', 'ELIMINATION', 'FILL_REMAINING_SEATS')
  ),
  transferred_from UUID REFERENCES public.election_candidates(id) ON DELETE SET NULL,
  -- The fraction applied to every ballot in the pile, in millionths. Moving a
  -- selected subset whole instead would reorder the eliminations underneath.
  transfer_value_scaled BIGINT CHECK (transfer_value_scaled IS NULL OR transfer_value_scaled >= 0),
  eliminated_candidate_id UUID REFERENCES public.election_candidates(id) ON DELETE SET NULL,
  exhausted_this_stage_scaled BIGINT NOT NULL DEFAULT 0 CHECK (exhausted_this_stage_scaled >= 0),
  cumulative_exhausted_scaled BIGINT NOT NULL DEFAULT 0 CHECK (cumulative_exhausted_scaled >= 0),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, stage_number),
  CHECK (action <> 'SURPLUS_TRANSFER' OR transferred_from IS NOT NULL),
  CHECK (action <> 'ELIMINATION' OR eliminated_candidate_id IS NOT NULL),
  CHECK (cumulative_exhausted_scaled >= exhausted_this_stage_scaled)
);

CREATE TABLE IF NOT EXISTS public.election_stage_totals (
  stage_id UUID NOT NULL REFERENCES public.election_count_stages(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  total_scaled BIGINT NOT NULL CHECK (total_scaled >= 0),
  elected_at_this_stage BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (stage_id, candidate_id)
);

-- Which rule decided a tie is part of the result. "Pick one" is how a result
-- gets overturned, so a draw is recorded as a draw rather than as an ordering.
CREATE TABLE IF NOT EXISTS public.election_tie_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.election_count_stages(id) ON DELETE CASCADE,
  rule TEXT NOT NULL CHECK (rule IN ('COUNTBACK', 'RANDOM_DRAW')),
  -- The earliest stage at which the tied candidates were not level.
  separated_at_stage INTEGER,
  chosen_candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (rule = 'COUNTBACK' AND separated_at_stage IS NOT NULL)
    OR (rule = 'RANDOM_DRAW' AND separated_at_stage IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.election_tie_break_candidates (
  tie_break_id UUID NOT NULL REFERENCES public.election_tie_breaks(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE CASCADE,
  PRIMARY KEY (tie_break_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.election_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.union_elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.election_candidates(id) ON DELETE RESTRICT,
  -- Order of election, which is not the same as order of total.
  elected_position INTEGER NOT NULL CHECK (elected_position > 0),
  elected_at_stage INTEGER NOT NULL CHECK (elected_at_stage > 0),
  UNIQUE (election_id, candidate_id),
  UNIQUE (election_id, elected_position)
);

-- A ballot is secret. The count is not: stage totals, transfers and tie-breaks
-- are readable by anyone, and the preferences behind them are not.
ALTER TABLE public.union_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballot_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_count_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_stage_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_tie_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_tie_break_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY union_elections_public_read ON public.union_elections FOR SELECT USING (TRUE);
CREATE POLICY election_candidates_public_read ON public.election_candidates FOR SELECT USING (TRUE);
CREATE POLICY election_stages_public_read ON public.election_count_stages FOR SELECT USING (TRUE);
CREATE POLICY election_stage_totals_public_read ON public.election_stage_totals FOR SELECT USING (TRUE);
CREATE POLICY election_tie_breaks_public_read ON public.election_tie_breaks FOR SELECT USING (TRUE);
CREATE POLICY election_results_public_read ON public.election_results FOR SELECT USING (TRUE);

-- A voter may see that their own ballot was accepted or why it was not. Nobody,
-- including them, reads it back through this policy.
CREATE POLICY election_ballots_own_read ON public.election_ballots
  FOR SELECT USING (voter_id = auth.uid());

CREATE POLICY election_register_own_read ON public.election_register
  FOR SELECT USING (voter_id = auth.uid());
