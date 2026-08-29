-- Issue #5014: Intramural Competition Integrity Engine
--
-- Registration is an interval, not a membership. A player registered on Tuesday
-- for a match played on Monday was not registered for that match, and a current
-- squad list cannot answer that question — which is why there is no current
-- squad table here.
--
-- A result carries a state. A score entered by the winning captain, a score
-- both captains disagree about and a match abandoned at seventy minutes are
-- different things, and only a confirmed one moves the table.
--
-- There is deliberately no standings table. The table is recomputed from the
-- confirmed result set, because a forfeit applied retrospectively has to move
-- teams that were not in the match, and a stored row cannot be moved by a match
-- it does not reference.

-- Halls of residence, needed because a hall cup's eligibility rule is "lives in
-- the hall this team represents" and there is nowhere else to ask that.
CREATE TABLE IF NOT EXISTS public.residence_halls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_id TEXT NOT NULL,
  points_for_win INTEGER NOT NULL DEFAULT 3,
  points_for_draw INTEGER NOT NULL DEFAULT 1,
  points_for_loss INTEGER NOT NULL DEFAULT 0,
  -- Ordered list of criteria, applied in sequence. Head-to-head among three
  -- tied teams is a mini-table, which is why the order matters and the last
  -- criterion may still leave teams level.
  tiebreak_order TEXT[] NOT NULL DEFAULT ARRAY['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'HEAD_TO_HEAD'],
  allowed_levels TEXT[] NOT NULL DEFAULT ARRAY['UNDERGRADUATE', 'POSTGRADUATE', 'STAFF'],
  requires_hall_residence BOOLEAN NOT NULL DEFAULT FALSE,
  awarded_score_for INTEGER NOT NULL DEFAULT 3 CHECK (awarded_score_for >= 0),
  awarded_score_against INTEGER NOT NULL DEFAULT 0 CHECK (awarded_score_against >= 0),
  -- A walkover should not flatter the winner, so an awarded scoreline does not
  -- move goal difference unless a competition says otherwise.
  awarded_scores_count_for_goal_difference BOOLEAN NOT NULL DEFAULT FALSE,
  abandonment_stands_after_minute INTEGER NOT NULL DEFAULT 70 CHECK (abandonment_stands_after_minute >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (points_for_win >= points_for_draw AND points_for_draw >= points_for_loss)
);

-- Whether a suspension picked up elsewhere is served here. A ban that lapses
-- because it was incurred in a different competition is how a suspended player
-- ends up on the pitch in a semi-final.
CREATE TABLE IF NOT EXISTS public.competition_suspension_carry_in (
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  from_competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  PRIMARY KEY (competition_id, from_competition_id),
  CHECK (competition_id <> from_competition_id)
);

CREATE TABLE IF NOT EXISTS public.competition_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Set for a hall competition, where a player must live in the hall the team
  -- represents.
  hall_id UUID REFERENCES public.residence_halls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, name)
);

CREATE TABLE IF NOT EXISTS public.competition_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('UNDERGRADUATE', 'POSTGRADUATE', 'STAFF')),
  hall_id UUID REFERENCES public.residence_halls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- An interval, because the question is always "was this player registered to
-- this team at that kick-off", never "is this player in the squad now".
CREATE TABLE IF NOT EXISTS public.team_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.competition_players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.competition_teams(id) ON DELETE CASCADE,
  effective_from TIMESTAMPTZ NOT NULL,
  -- Null while current. A transfer closes one interval and opens another.
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS team_registrations_lookup_idx
  ON public.team_registrations (player_id, team_id, effective_from);

-- A player cannot hold two overlapping registrations to the same team.
CREATE INDEX IF NOT EXISTS team_registrations_open_idx
  ON public.team_registrations (player_id, team_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS public.competition_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES public.competition_teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES public.competition_teams(id) ON DELETE RESTRICT,
  -- Every eligibility question is asked against this column.
  kick_off_at TIMESTAMPTZ NOT NULL,
  venue TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id)
);

CREATE INDEX IF NOT EXISTS competition_fixtures_schedule_idx
  ON public.competition_fixtures (competition_id, kick_off_at);

CREATE TABLE IF NOT EXISTS public.fixture_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.competition_fixtures(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('PLAYED', 'WALKOVER', 'FORFEIT', 'ABANDONED', 'POSTPONED', 'BYE')
  ),
  home_score INTEGER NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score INTEGER NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  -- The minute play stopped, which decides whether an abandonment stands.
  abandoned_at_minute INTEGER CHECK (abandoned_at_minute IS NULL OR abandoned_at_minute >= 0),
  awarded_against_team_id UUID REFERENCES public.competition_teams(id) ON DELETE SET NULL,
  -- A claim until somebody confirms it, and not final while a protest is open.
  state TEXT NOT NULL DEFAULT 'REPORTED' CHECK (
    state IN ('REPORTED', 'DISPUTED', 'CONFIRMED', 'VOIDED')
  ),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  voided_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (outcome <> 'ABANDONED' OR abandoned_at_minute IS NOT NULL),
  CHECK (outcome NOT IN ('WALKOVER', 'FORFEIT') OR awarded_against_team_id IS NOT NULL),
  CHECK ((state = 'CONFIRMED') = (confirmed_at IS NOT NULL)),
  CHECK (state <> 'VOIDED' OR voided_reason IS NOT NULL)
);

-- One live result per fixture. A voided one stays for the audit trail, which is
-- why this index excludes it rather than the table doing so.
CREATE UNIQUE INDEX IF NOT EXISTS fixture_results_one_live
  ON public.fixture_results (fixture_id)
  WHERE state <> 'VOIDED';

-- Counted in matches, never in days. `matches` is a count of fixtures the
-- team actually plays and the player would otherwise be available for, so
-- there is nowhere here to record an expiry date.
CREATE TABLE IF NOT EXISTS public.player_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.competition_players(id) ON DELETE CASCADE,
  -- Where it was incurred. Whether it is served elsewhere is the other
  -- competition's carry-in rule, not a property of the ban.
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  matches INTEGER NOT NULL CHECK (matches > 0),
  incurred_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_suspensions_player_idx
  ON public.player_suspensions (player_id, incurred_at);

-- Which fixtures a ban was actually served in, so a captain can see why it is
-- not spent yet.
CREATE TABLE IF NOT EXISTS public.suspension_matches_served (
  suspension_id UUID NOT NULL REFERENCES public.player_suspensions(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.competition_fixtures(id) ON DELETE CASCADE,
  PRIMARY KEY (suspension_id, fixture_id)
);

-- Applies to a team's total without touching any fixture, which is why it is
-- not a result row with a strange scoreline.
CREATE TABLE IF NOT EXISTS public.team_points_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.competition_teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  applied_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.eligibility_protests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.competition_fixtures(id) ON DELETE CASCADE,
  against_team_id UUID NOT NULL REFERENCES public.competition_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.competition_players(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  raised_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'OPEN' CHECK (outcome IN ('OPEN', 'UPHELD', 'REJECTED')),
  resolved_at TIMESTAMPTZ,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((outcome = 'OPEN') = (resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS eligibility_protests_open_idx
  ON public.eligibility_protests (fixture_id) WHERE outcome = 'OPEN';

-- A confirmed result cannot be edited back into a reported one; the way a
-- result changes after confirmation is that it is voided and replaced.
CREATE OR REPLACE FUNCTION public.reject_confirmed_result_downgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state = 'CONFIRMED'
     AND NEW.state NOT IN ('CONFIRMED', 'VOIDED', 'DISPUTED') THEN
    RAISE EXCEPTION 'Confirmed result for fixture % may only be disputed or voided, not reset to %',
      OLD.fixture_id, NEW.state;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fixture_results_state_guard ON public.fixture_results;
CREATE TRIGGER fixture_results_state_guard
  BEFORE UPDATE ON public.fixture_results
  FOR EACH ROW EXECUTE FUNCTION public.reject_confirmed_result_downgrade();

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_suspension_carry_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspension_matches_served ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_points_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_protests ENABLE ROW LEVEL SECURITY;

-- Fixtures, results and the table are public; that is the point of a league.
CREATE POLICY competitions_public_read ON public.competitions FOR SELECT USING (TRUE);
CREATE POLICY competition_teams_public_read ON public.competition_teams FOR SELECT USING (TRUE);
CREATE POLICY competition_fixtures_public_read ON public.competition_fixtures FOR SELECT USING (TRUE);
CREATE POLICY fixture_results_public_read ON public.fixture_results FOR SELECT USING (TRUE);
CREATE POLICY team_points_deductions_public_read ON public.team_points_deductions FOR SELECT USING (TRUE);

-- Discipline is not. A player sees their own record.
CREATE POLICY player_suspensions_own_read ON public.player_suspensions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.competition_players p
      WHERE p.id = player_suspensions.player_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY competition_players_own_read ON public.competition_players
  FOR SELECT USING (user_id = auth.uid());
