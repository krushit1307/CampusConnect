/**
 * Module: Intramural Competition Integrity Engine
 * File: src/services/leagueIntegrityService.ts
 * Scope: Treats results as claims requiring confirmation, evaluates player
 *        eligibility against each fixture's kick-off, counts suspensions in
 *        matches actually played, and recomputes standings from the full
 *        confirmed result set so a retrospective forfeit propagates through
 *        every tiebreak (#5014).
 *
 * The table produces every complaint of the year and almost none of them are
 * about the arithmetic. They are about who was allowed on the pitch.
 *
 * A result is a claim, not a fact. A score entered by the winning captain, a
 * score both captains disagree about, a match abandoned at seventy minutes and
 * a match that never kicked off because one side had six players are four
 * different things that a spreadsheet treats identically. Nothing moves the
 * standings here until it is confirmed, and nothing is final while a protest
 * against it is open.
 *
 * Eligibility is evaluated at kick-off. A player registered on Tuesday for a
 * match played on Monday was not registered for that match; a player who moved
 * halls in week six was eligible for one team before it and the other after.
 * A current squad list cannot answer either question, which is why registration
 * here is an interval rather than a membership.
 *
 * A suspension is served in matches, not in days. Three matches means the next
 * three the team actually plays, so a postponement does not burn a game, a bye
 * does not burn a game, and a fixture the player was not yet registered for
 * does not burn a game. Counting down calendar days is how a suspended player
 * ends up on the pitch in a semi-final.
 *
 * And a forfeit is retrospective and it propagates. A match awarded against a
 * team for fielding an ineligible player is not a scoreline correction: it
 * voids the original result, awards a fixed win, and changes the ordering of
 * teams that were not in the match, because goal difference and head-to-head
 * were computed from a table that included it. Recomputing from the complete
 * confirmed set on every query is the only implementation that gets that right;
 * adjusting the two rows silently corrupts everybody else's position.
 */

export type ResultState = "REPORTED" | "DISPUTED" | "CONFIRMED" | "VOIDED";

export type FixtureOutcome = "PLAYED" | "WALKOVER" | "FORFEIT" | "ABANDONED" | "POSTPONED" | "BYE";

export type TiebreakCriterion = "POINTS" | "GOAL_DIFFERENCE" | "GOALS_FOR" | "HEAD_TO_HEAD";

export type PlayerLevel = "UNDERGRADUATE" | "POSTGRADUATE" | "STAFF";

export type EligibilityReason =
  | "ELIGIBLE"
  | "UNKNOWN_PLAYER"
  | "UNKNOWN_FIXTURE"
  | "TEAM_NOT_IN_FIXTURE"
  | "NOT_REGISTERED_AT_KICK_OFF"
  | "LEVEL_NOT_PERMITTED"
  | "HALL_RESIDENCE_MISMATCH"
  | "SERVING_SUSPENSION";

export type ProtestOutcome = "OPEN" | "UPHELD" | "REJECTED";

export interface Competition {
  competitionId: string;
  name: string;
  seasonId: string;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tiebreakOrder: TiebreakCriterion[];
  /** Competitions whose suspensions are served in this one. */
  carriesSuspensionsFrom: string[];
  allowedLevels: PlayerLevel[];
  /** A hall cup: a player must live in the hall their team represents. */
  requiresHallResidence: boolean;
  /** Goals awarded to the side that turns up, or that a forfeit is awarded to. */
  awardedScoreFor: number;
  awardedScoreAgainst: number;
  /**
   * Whether an awarded scoreline moves goal difference. A walkover should not
   * flatter the winner, so by default it does not.
   */
  awardedScoresCountForGoalDifference: boolean;
  /** Past this many minutes an abandoned match stands on the score at abandonment. */
  abandonmentStandsAfterMinute: number;
}

export interface Team {
  teamId: string;
  competitionId: string;
  name: string;
  hallId: string | null;
}

export interface Player {
  playerId: string;
  name: string;
  level: PlayerLevel;
  hallId: string | null;
}

export interface Registration {
  registrationId: string;
  playerId: string;
  teamId: string;
  effectiveFrom: Date;
  /** Null while current. A transfer closes one interval and opens another. */
  effectiveTo: Date | null;
}

export interface Fixture {
  fixtureId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickOffAt: Date;
}

export interface MatchResult {
  fixtureId: string;
  outcome: FixtureOutcome;
  homeScore: number;
  awayScore: number;
  /** For an abandonment, the minute play stopped. */
  abandonedAtMinute: number | null;
  /** For a forfeit or walkover, the team that lost the fixture. */
  awardedAgainstTeamId: string | null;
  state: ResultState;
  reportedBy: string;
  reportedAt: Date;
  confirmedAt: Date | null;
  voidedReason: string | null;
}

export interface Suspension {
  sanctionId: string;
  playerId: string;
  /** Where it was incurred. Whether it is served elsewhere is the competition's rule. */
  competitionId: string;
  matches: number;
  incurredAt: Date;
  reason: string;
}

export interface PointsDeduction {
  sanctionId: string;
  teamId: string;
  competitionId: string;
  points: number;
  appliedAt: Date;
  reason: string;
}

export interface Protest {
  protestId: string;
  fixtureId: string;
  /** The team accused of fielding someone it should not have. */
  againstTeamId: string;
  playerId: string;
  raisedBy: string;
  raisedAt: Date;
  outcome: ProtestOutcome;
  resolvedAt: Date | null;
  note: string;
}

export interface EligibilityDecision {
  playerId: string;
  fixtureId: string;
  teamId: string;
  eligible: boolean;
  reason: EligibilityReason;
  detail: string;
}

export interface SuspensionState {
  sanctionId: string;
  playerId: string;
  matchesImposed: number;
  matchesServed: number;
  matchesRemaining: number;
  /** Fixtures that counted, so a captain can see why it is not spent. */
  servedInFixtureIds: string[];
}

export interface StandingRow {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  deductedPoints: number;
  /** Teams this one is genuinely level with after every criterion. */
  unresolvedTieWith: string[];
}

/** Outcomes that mean the team played a match for suspension and table purposes. */
const COUNTS_AS_PLAYED: readonly FixtureOutcome[] = ["PLAYED", "WALKOVER", "FORFEIT", "ABANDONED"];

export class LeagueIntegrityService {
  private readonly competitions = new Map<string, Competition>();
  private readonly teams = new Map<string, Team>();
  private readonly players = new Map<string, Player>();
  private readonly registrations: Registration[] = [];
  private readonly fixtures = new Map<string, Fixture>();
  private readonly results = new Map<string, MatchResult>();
  private readonly suspensions: Suspension[] = [];
  private readonly deductions: PointsDeduction[] = [];
  private readonly protests = new Map<string, Protest>();

  registerCompetition(competition: Competition): void {
    this.competitions.set(competition.competitionId, {
      ...competition,
      tiebreakOrder: [...competition.tiebreakOrder],
      carriesSuspensionsFrom: [...competition.carriesSuspensionsFrom],
      allowedLevels: [...competition.allowedLevels],
    });
  }

  registerTeam(team: Team): void {
    this.teams.set(team.teamId, { ...team });
  }

  registerPlayer(player: Player): void {
    this.players.set(player.playerId, { ...player });
  }

  registerPlayerToTeam(registration: Registration): void {
    this.registrations.push({ ...registration });
  }

  scheduleFixture(fixture: Fixture): void {
    this.fixtures.set(fixture.fixtureId, { ...fixture });
  }

  imposeSuspension(suspension: Suspension): void {
    this.suspensions.push({ ...suspension });
  }

  deductPoints(deduction: PointsDeduction): void {
    this.deductions.push({ ...deduction });
  }

  /** A claim. It does not move the table until somebody confirms it. */
  reportResult(result: Omit<MatchResult, "state" | "confirmedAt" | "voidedReason">): MatchResult {
    const stored: MatchResult = {
      ...result,
      state: "REPORTED",
      confirmedAt: null,
      voidedReason: null,
    };
    this.results.set(result.fixtureId, stored);
    return { ...stored };
  }

  confirmResult(fixtureId: string, at: Date): boolean {
    const result = this.results.get(fixtureId);
    if (!result || result.state === "VOIDED") return false;
    result.state = "CONFIRMED";
    result.confirmedAt = at;
    return true;
  }

  disputeResult(fixtureId: string): boolean {
    const result = this.results.get(fixtureId);
    if (!result || result.state === "VOIDED") return false;
    result.state = "DISPUTED";
    result.confirmedAt = null;
    return true;
  }

  getResult(fixtureId: string): MatchResult | undefined {
    const result = this.results.get(fixtureId);
    return result ? { ...result } : undefined;
  }

  raiseProtest(protest: Omit<Protest, "outcome" | "resolvedAt">): Protest {
    const stored: Protest = { ...protest, outcome: "OPEN", resolvedAt: null };
    this.protests.set(protest.protestId, stored);
    return { ...stored };
  }

  getProtest(protestId: string): Protest | undefined {
    const protest = this.protests.get(protestId);
    return protest ? { ...protest } : undefined;
  }

  /** The registration interval covering a moment, if any. */
  registrationAt(playerId: string, teamId: string, at: Date): Registration | null {
    const moment = at.getTime();
    return (
      this.registrations.find(
        (registration) =>
          registration.playerId === playerId &&
          registration.teamId === teamId &&
          registration.effectiveFrom.getTime() <= moment &&
          (registration.effectiveTo === null || registration.effectiveTo.getTime() > moment),
      ) ?? null
    );
  }

  /**
   * Whether a player could take the field in a given fixture, judged at that
   * fixture's kick-off rather than at the moment somebody complains.
   */
  eligibility(playerId: string, fixtureId: string, teamId: string): EligibilityDecision {
    const decide = (
      eligible: boolean,
      reason: EligibilityReason,
      detail: string,
    ): EligibilityDecision => ({ playerId, fixtureId, teamId, eligible, reason, detail });

    const player = this.players.get(playerId);
    if (!player) return decide(false, "UNKNOWN_PLAYER", "No such player.");

    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) return decide(false, "UNKNOWN_FIXTURE", "No such fixture.");

    if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) {
      return decide(false, "TEAM_NOT_IN_FIXTURE", "That team is not playing in this fixture.");
    }

    const competition = this.competitions.get(fixture.competitionId);
    if (!competition) return decide(false, "UNKNOWN_FIXTURE", "Fixture has no competition.");

    const registration = this.registrationAt(playerId, teamId, fixture.kickOffAt);
    if (!registration) {
      return decide(
        false,
        "NOT_REGISTERED_AT_KICK_OFF",
        "Player was not registered to this team at kick-off.",
      );
    }

    if (!competition.allowedLevels.includes(player.level)) {
      return decide(
        false,
        "LEVEL_NOT_PERMITTED",
        `${competition.name} is not open to ${player.level.toLowerCase()} players.`,
      );
    }

    if (competition.requiresHallResidence) {
      const team = this.teams.get(teamId);
      if (!team?.hallId || team.hallId !== player.hallId) {
        return decide(
          false,
          "HALL_RESIDENCE_MISMATCH",
          "Player does not live in the hall this team represents.",
        );
      }
    }

    const outstanding = this.suspensionStates(playerId, fixture.kickOffAt).filter(
      (state) =>
        state.matchesRemaining > 0 && this.suspensionApplies(state.sanctionId, competition),
    );
    if (outstanding.length > 0) {
      return decide(
        false,
        "SERVING_SUSPENSION",
        `${outstanding[0].matchesRemaining} match(es) of suspension outstanding at kick-off.`,
      );
    }

    return decide(true, "ELIGIBLE", "Registered, permitted and available at kick-off.");
  }

  private suspensionApplies(sanctionId: string, competition: Competition): boolean {
    const suspension = this.suspensions.find((entry) => entry.sanctionId === sanctionId);
    if (!suspension) return false;
    return (
      suspension.competitionId === competition.competitionId ||
      competition.carriesSuspensionsFrom.includes(suspension.competitionId)
    );
  }

  /**
   * How much of each suspension is left at a moment. Served in matches the
   * team actually played and the player would otherwise have been available
   * for — never in postponements, byes, or fixtures predating the player's
   * registration.
   */
  suspensionStates(playerId: string, at: Date): SuspensionState[] {
    return this.suspensions
      .filter((suspension) => suspension.playerId === playerId)
      .map((suspension) => {
        const servedInFixtureIds: string[] = [];

        const candidates = [...this.fixtures.values()]
          .filter((fixture) => fixture.kickOffAt.getTime() > suspension.incurredAt.getTime())
          .filter((fixture) => fixture.kickOffAt.getTime() < at.getTime())
          .sort((a, b) => a.kickOffAt.getTime() - b.kickOffAt.getTime());

        for (const fixture of candidates) {
          if (servedInFixtureIds.length >= suspension.matches) break;

          const competition = this.competitions.get(fixture.competitionId);
          if (!competition) continue;
          // A suspension incurred in the league is served in the cup only where
          // the cup's rules say so.
          if (!this.suspensionApplies(suspension.sanctionId, competition)) continue;

          const result = this.results.get(fixture.fixtureId);
          // A postponement is not a match played. Neither is a fixture whose
          // result nobody has confirmed yet.
          if (!result || result.state !== "CONFIRMED") continue;
          if (!COUNTS_AS_PLAYED.includes(result.outcome)) continue;
          if (!this.abandonmentStands(result, competition)) continue;

          // The player has to have been available but for the suspension.
          const teamIds = [fixture.homeTeamId, fixture.awayTeamId];
          const playersTeam = teamIds.find(
            (teamId) => this.registrationAt(playerId, teamId, fixture.kickOffAt) !== null,
          );
          if (!playersTeam) continue;

          servedInFixtureIds.push(fixture.fixtureId);
        }

        const matchesServed = servedInFixtureIds.length;
        return {
          sanctionId: suspension.sanctionId,
          playerId,
          matchesImposed: suspension.matches,
          matchesServed,
          matchesRemaining: Math.max(0, suspension.matches - matchesServed),
          servedInFixtureIds,
        };
      });
  }

  /** An abandonment stands on the score at abandonment only past the threshold. */
  private abandonmentStands(result: MatchResult, competition: Competition): boolean {
    if (result.outcome !== "ABANDONED") return true;
    return (result.abandonedAtMinute ?? 0) >= competition.abandonmentStandsAfterMinute;
  }

  /**
   * Uphold a protest: void the original result and award the fixture against
   * the offending team. Not a scoreline correction — the original result stops
   * existing, and every standing that depended on it is recomputed.
   */
  upholdProtest(protestId: string, at: Date, note = "ineligible player fielded"): boolean {
    const protest = this.protests.get(protestId);
    if (!protest || protest.outcome !== "OPEN") return false;

    const fixture = this.fixtures.get(protest.fixtureId);
    const competition = fixture ? this.competitions.get(fixture.competitionId) : undefined;
    if (!fixture || !competition) return false;

    const existing = this.results.get(protest.fixtureId);
    if (existing) {
      existing.state = "VOIDED";
      existing.voidedReason = note;
    }

    const offenderIsHome = protest.againstTeamId === fixture.homeTeamId;
    this.results.set(protest.fixtureId, {
      fixtureId: protest.fixtureId,
      outcome: "FORFEIT",
      homeScore: offenderIsHome ? competition.awardedScoreAgainst : competition.awardedScoreFor,
      awayScore: offenderIsHome ? competition.awardedScoreFor : competition.awardedScoreAgainst,
      abandonedAtMinute: null,
      awardedAgainstTeamId: protest.againstTeamId,
      state: "CONFIRMED",
      reportedBy: protest.raisedBy,
      reportedAt: at,
      confirmedAt: at,
      voidedReason: null,
    });

    protest.outcome = "UPHELD";
    protest.resolvedAt = at;
    return true;
  }

  rejectProtest(protestId: string, at: Date): boolean {
    const protest = this.protests.get(protestId);
    if (!protest || protest.outcome !== "OPEN") return false;
    protest.outcome = "REJECTED";
    protest.resolvedAt = at;
    return true;
  }

  /** Every confirmed, countable result in a competition up to a moment. */
  private countableResults(
    competitionId: string,
    at: Date,
  ): Array<{ fixture: Fixture; result: MatchResult }> {
    const competition = this.competitions.get(competitionId);
    if (!competition) return [];

    return [...this.fixtures.values()]
      .filter((fixture) => fixture.competitionId === competitionId)
      .filter((fixture) => fixture.kickOffAt.getTime() <= at.getTime())
      .map((fixture) => ({ fixture, result: this.results.get(fixture.fixtureId) }))
      .filter(
        (entry): entry is { fixture: Fixture; result: MatchResult } =>
          entry.result !== undefined &&
          entry.result.state === "CONFIRMED" &&
          COUNTS_AS_PLAYED.includes(entry.result.outcome) &&
          this.abandonmentStands(entry.result, competition),
      );
  }

  /**
   * Recompute the whole table from the confirmed result set. Deliberately not
   * incremental: a forfeit applied retrospectively has to move teams that were
   * not in the match, and adjusting two rows cannot do that.
   */
  standings(competitionId: string, at: Date): StandingRow[] {
    const competition = this.competitions.get(competitionId);
    if (!competition) return [];

    const teams = [...this.teams.values()].filter((team) => team.competitionId === competitionId);
    const rows = new Map<string, StandingRow>();
    for (const team of teams) {
      rows.set(team.teamId, {
        teamId: team.teamId,
        position: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        deductedPoints: 0,
        unresolvedTieWith: [],
      });
    }

    const countable = this.countableResults(competitionId, at);

    for (const { fixture, result } of countable) {
      const home = rows.get(fixture.homeTeamId);
      const away = rows.get(fixture.awayTeamId);
      if (!home || !away) continue;

      const awarded = result.outcome === "FORFEIT" || result.outcome === "WALKOVER";
      const countsForGoals = !awarded || competition.awardedScoresCountForGoalDifference;

      home.played += 1;
      away.played += 1;

      if (countsForGoals) {
        home.goalsFor += result.homeScore;
        home.goalsAgainst += result.awayScore;
        away.goalsFor += result.awayScore;
        away.goalsAgainst += result.homeScore;
      }

      if (result.homeScore > result.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += competition.pointsForWin;
        away.points += competition.pointsForLoss;
      } else if (result.homeScore < result.awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += competition.pointsForWin;
        home.points += competition.pointsForLoss;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += competition.pointsForDraw;
        away.points += competition.pointsForDraw;
      }
    }

    // A points deduction applies to the total without touching any fixture, so
    // it cannot be folded into a scoreline.
    for (const deduction of this.deductions) {
      if (deduction.competitionId !== competitionId) continue;
      if (deduction.appliedAt.getTime() > at.getTime()) continue;
      const row = rows.get(deduction.teamId);
      if (!row) continue;
      row.deductedPoints += deduction.points;
      row.points -= deduction.points;
    }

    for (const row of rows.values()) {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    }

    return this.order([...rows.values()], competition, countable);
  }

  /**
   * Head-to-head between three tied teams is a mini-table over the fixtures
   * among exactly those teams, not a set of pairwise comparisons — the two
   * produce different orders often enough to matter.
   */
  private headToHeadKey(
    teamId: string,
    group: string[],
    competition: Competition,
    countable: Array<{ fixture: Fixture; result: MatchResult }>,
  ): number[] {
    const inGroup = new Set(group);
    let points = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const { fixture, result } of countable) {
      if (!inGroup.has(fixture.homeTeamId) || !inGroup.has(fixture.awayTeamId)) continue;
      const isHome = fixture.homeTeamId === teamId;
      const isAway = fixture.awayTeamId === teamId;
      if (!isHome && !isAway) continue;

      const own = isHome ? result.homeScore : result.awayScore;
      const other = isHome ? result.awayScore : result.homeScore;
      const awarded = result.outcome === "FORFEIT" || result.outcome === "WALKOVER";

      if (!awarded || competition.awardedScoresCountForGoalDifference) {
        goalsFor += own;
        goalsAgainst += other;
      }
      if (own > other) points += competition.pointsForWin;
      else if (own < other) points += competition.pointsForLoss;
      else points += competition.pointsForDraw;
    }

    return [points, goalsFor - goalsAgainst, goalsFor];
  }

  private keyFor(
    criterion: TiebreakCriterion,
    row: StandingRow,
    group: string[],
    competition: Competition,
    countable: Array<{ fixture: Fixture; result: MatchResult }>,
  ): number[] {
    switch (criterion) {
      case "POINTS":
        return [row.points];
      case "GOAL_DIFFERENCE":
        return [row.goalDifference];
      case "GOALS_FOR":
        return [row.goalsFor];
      case "HEAD_TO_HEAD":
        return this.headToHeadKey(row.teamId, group, competition, countable);
      default:
        return [0];
    }
  }

  private order(
    rows: StandingRow[],
    competition: Competition,
    countable: Array<{ fixture: Fixture; result: MatchResult }>,
  ): StandingRow[] {
    const byId = new Map(rows.map((row) => [row.teamId, row]));

    const split = (group: string[], criterionIndex: number): string[][] => {
      if (group.length <= 1 || criterionIndex >= competition.tiebreakOrder.length) {
        return [group];
      }
      const criterion = competition.tiebreakOrder[criterionIndex];

      const buckets = new Map<string, string[]>();
      for (const teamId of group) {
        const row = byId.get(teamId);
        if (!row) continue;
        const key = JSON.stringify(this.keyFor(criterion, row, group, competition, countable));
        buckets.set(key, [...(buckets.get(key) ?? []), teamId]);
      }

      const ordered = [...buckets.entries()].sort((a, b) => {
        const left = JSON.parse(a[0]) as number[];
        const right = JSON.parse(b[0]) as number[];
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
          const difference = (right[index] ?? 0) - (left[index] ?? 0);
          if (difference !== 0) return difference;
        }
        return 0;
      });

      return ordered.flatMap(([, bucket]) => split(bucket, criterionIndex + 1));
    };

    const groups = split(rows.map((row) => row.teamId).sort(), 0);

    const result: StandingRow[] = [];
    let position = 1;
    for (const group of groups) {
      for (const teamId of group) {
        const row = byId.get(teamId);
        if (!row) continue;
        row.position = position;
        // Genuinely level after every criterion. Sorting by name here and
        // calling it an order is what the report must not do.
        row.unresolvedTieWith = group.length > 1 ? group.filter((id) => id !== teamId) : [];
        result.push(row);
      }
      position += group.length;
    }

    return result;
  }
}
