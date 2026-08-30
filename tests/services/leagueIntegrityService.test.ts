/**
 * Test suite: Intramural Competition Integrity Engine (#5014)
 * File: tests/services/leagueIntegrityService.test.ts
 *
 * The cases worth writing down are the ones a spreadsheet formula and a current
 * squad list both pass: a player registered the day after the match he played
 * in, a suspension that a postponement was supposed to burn, a forfeit that
 * moves two teams who were not in the match, and three teams level on every
 * arithmetic criterion there is.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  LeagueIntegrityService,
  type Competition,
  type MatchResult,
} from "../../src/services/leagueIntegrityService";

const LEAGUE = "comp-league";
const CUP = "comp-hall-cup";
const ROUND_ROBIN = "comp-round-robin";

const OCT_20 = new Date("2028-10-20T00:00:00.000Z");

function competition(
  overrides: Partial<Competition> & Pick<Competition, "competitionId" | "name">,
): Competition {
  return {
    seasonId: "season-2028-29",
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    tiebreakOrder: ["POINTS", "GOAL_DIFFERENCE", "GOALS_FOR", "HEAD_TO_HEAD"],
    carriesSuspensionsFrom: [],
    allowedLevels: ["UNDERGRADUATE", "POSTGRADUATE", "STAFF"],
    requiresHallResidence: false,
    awardedScoreFor: 3,
    awardedScoreAgainst: 0,
    // A walkover should not flatter the winner's goal difference.
    awardedScoresCountForGoalDifference: false,
    abandonmentStandsAfterMinute: 70,
    ...overrides,
  };
}

function played(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Omit<MatchResult, "state" | "confirmedAt" | "voidedReason"> {
  return {
    fixtureId,
    outcome: "PLAYED",
    homeScore,
    awayScore,
    abandonedAtMinute: null,
    awardedAgainstTeamId: null,
    reportedBy: "user-captain",
    reportedAt: new Date("2028-10-19T20:00:00.000Z"),
  };
}

/** League and hall cup, with the players and fixtures the eligibility cases need. */
function build(): LeagueIntegrityService {
  const service = new LeagueIntegrityService();

  service.registerCompetition(competition({ competitionId: LEAGUE, name: "Intramural League" }));
  service.registerCompetition(
    competition({
      competitionId: CUP,
      name: "Hall Cup",
      allowedLevels: ["UNDERGRADUATE"],
      requiresHallResidence: true,
      // A suspension picked up in the league is served in the cup.
      carriesSuspensionsFrom: [LEAGUE],
    }),
  );

  for (const teamId of ["team-alpha", "team-bravo", "team-charlie", "team-delta"]) {
    service.registerTeam({ teamId, competitionId: LEAGUE, name: teamId, hallId: null });
  }
  service.registerTeam({
    teamId: "team-hall-north",
    competitionId: CUP,
    name: "North Hall",
    hallId: "hall-north",
  });
  service.registerTeam({
    teamId: "team-hall-south",
    competitionId: CUP,
    name: "South Hall",
    hallId: "hall-south",
  });

  const players: Array<[string, "UNDERGRADUATE" | "POSTGRADUATE" | "STAFF", string | null]> = [
    ["player-regular", "UNDERGRADUATE", "hall-north"],
    ["player-late", "UNDERGRADUATE", "hall-north"],
    ["player-transfer", "UNDERGRADUATE", "hall-north"],
    ["player-postgrad", "POSTGRADUATE", "hall-north"],
    ["player-wrong-hall", "UNDERGRADUATE", "hall-west"],
    ["player-suspended", "UNDERGRADUATE", "hall-north"],
    ["player-carry", "UNDERGRADUATE", "hall-north"],
    ["player-cup-ban", "UNDERGRADUATE", "hall-north"],
    ["player-boundary", "UNDERGRADUATE", "hall-north"],
  ];
  for (const [playerId, level, hallId] of players) {
    service.registerPlayer({ playerId, name: playerId, level, hallId });
  }

  const seasonStart = new Date("2028-09-01T00:00:00.000Z");
  const register = (playerId: string, teamId: string, from: Date, to: Date | null = null) =>
    service.registerPlayerToTeam({
      registrationId: `${playerId}-${teamId}`,
      playerId,
      teamId,
      effectiveFrom: from,
      effectiveTo: to,
    });

  register("player-regular", "team-alpha", seasonStart);
  // Registered the day after the match he turned out in.
  register("player-late", "team-alpha", new Date("2028-10-06T00:00:00.000Z"));
  // Moved between teams mid-season.
  register("player-transfer", "team-alpha", seasonStart, new Date("2028-10-15T00:00:00.000Z"));
  register("player-transfer", "team-bravo", new Date("2028-10-15T00:00:00.000Z"));
  register("player-postgrad", "team-hall-north", seasonStart);
  register("player-wrong-hall", "team-hall-north", seasonStart);
  register("player-suspended", "team-alpha", seasonStart);
  register("player-carry", "team-alpha", seasonStart);
  register("player-carry", "team-hall-north", seasonStart);
  register("player-cup-ban", "team-alpha", seasonStart);
  register("player-cup-ban", "team-hall-north", seasonStart);
  register("player-boundary", "team-alpha", seasonStart);

  const fixtures: Array<[string, string, string, string, string]> = [
    ["fix-l1", LEAGUE, "team-alpha", "team-bravo", "2028-10-05T14:00:00.000Z"],
    ["fix-l2", LEAGUE, "team-charlie", "team-delta", "2028-10-05T14:00:00.000Z"],
    ["fix-l3", LEAGUE, "team-alpha", "team-charlie", "2028-10-12T14:00:00.000Z"],
    ["fix-l4", LEAGUE, "team-bravo", "team-delta", "2028-10-12T14:00:00.000Z"],
    ["fix-l5", LEAGUE, "team-alpha", "team-delta", "2028-10-19T14:00:00.000Z"],
    ["fix-l6", LEAGUE, "team-bravo", "team-charlie", "2028-10-19T14:00:00.000Z"],
    ["fix-c1", CUP, "team-hall-north", "team-hall-south", "2028-10-08T19:00:00.000Z"],
    // Next season, after the winter break.
    ["fix-l7", LEAGUE, "team-alpha", "team-bravo", "2029-02-01T14:00:00.000Z"],
  ];
  for (const [fixtureId, competitionId, homeTeamId, awayTeamId, kickOff] of fixtures) {
    service.scheduleFixture({
      fixtureId,
      competitionId,
      homeTeamId,
      awayTeamId,
      kickOffAt: new Date(kickOff),
    });
  }

  return service;
}

/** The league results the standings cases are built on. */
function recordLeagueResults(service: LeagueIntegrityService): void {
  const confirmAt = new Date("2028-10-19T22:00:00.000Z");

  service.reportResult(played("fix-l1", 3, 0));
  service.reportResult(played("fix-l2", 2, 0));
  service.reportResult({
    fixtureId: "fix-l3",
    outcome: "POSTPONED",
    homeScore: 0,
    awayScore: 0,
    abandonedAtMinute: null,
    awardedAgainstTeamId: null,
    reportedBy: "user-secretary",
    reportedAt: new Date("2028-10-12T09:00:00.000Z"),
  });
  service.reportResult(played("fix-l4", 2, 0));
  service.reportResult(played("fix-l5", 1, 0));
  service.reportResult(played("fix-l6", 1, 1));

  for (const fixtureId of ["fix-l1", "fix-l2", "fix-l3", "fix-l4", "fix-l5", "fix-l6"]) {
    service.confirmResult(fixtureId, confirmAt);
  }
}

function positions(service: LeagueIntegrityService, at = OCT_20): Record<string, number> {
  return Object.fromEntries(service.standings(LEAGUE, at).map((row) => [row.teamId, row.position]));
}

describe("LeagueIntegrityService — eligibility is judged at kick-off", () => {
  let service: LeagueIntegrityService;

  beforeEach(() => {
    service = build();
  });

  test("a player registered the day after the match was not registered for it", () => {
    const decision = service.eligibility("player-late", "fix-l1", "team-alpha");

    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe("NOT_REGISTERED_AT_KICK_OFF");
  });

  test("a properly registered player is eligible", () => {
    const decision = service.eligibility("player-regular", "fix-l1", "team-alpha");

    expect(decision.eligible).toBe(true);
    expect(decision.reason).toBe("ELIGIBLE");
  });

  test("a transfer makes the same player eligible for one team before it and the other after", () => {
    // Registered to alpha in early October.
    expect(service.eligibility("player-transfer", "fix-l1", "team-alpha").eligible).toBe(true);
    expect(service.eligibility("player-transfer", "fix-l1", "team-bravo").reason).toBe(
      "NOT_REGISTERED_AT_KICK_OFF",
    );

    // Registered to bravo by the nineteenth.
    expect(service.eligibility("player-transfer", "fix-l6", "team-bravo").eligible).toBe(true);
    expect(service.eligibility("player-transfer", "fix-l5", "team-alpha").reason).toBe(
      "NOT_REGISTERED_AT_KICK_OFF",
    );
  });

  test("a postgraduate is not eligible for an undergraduate-only cup", () => {
    const decision = service.eligibility("player-postgrad", "fix-c1", "team-hall-north");

    expect(decision.reason).toBe("LEVEL_NOT_PERMITTED");
  });

  test("a hall cup requires the player to live in the hall", () => {
    const decision = service.eligibility("player-wrong-hall", "fix-c1", "team-hall-north");

    expect(decision.reason).toBe("HALL_RESIDENCE_MISMATCH");
  });

  test("a team not in the fixture is refused before anything else is checked", () => {
    const decision = service.eligibility("player-regular", "fix-l2", "team-alpha");

    expect(decision.reason).toBe("TEAM_NOT_IN_FIXTURE");
  });
});

describe("LeagueIntegrityService — suspensions are served in matches", () => {
  let service: LeagueIntegrityService;

  beforeEach(() => {
    service = build();
    recordLeagueResults(service);
  });

  test("a postponement does not burn a game", () => {
    service.imposeSuspension({
      sanctionId: "ban-1",
      playerId: "player-suspended",
      competitionId: LEAGUE,
      matches: 3,
      incurredAt: new Date("2028-10-01T00:00:00.000Z"),
      reason: "Two cautions.",
    });

    const [state] = service.suspensionStates("player-suspended", OCT_20);

    // Alpha's fixtures in the window were the fifth, the postponed twelfth and
    // the nineteenth.
    expect(state.servedInFixtureIds).toEqual(["fix-l1", "fix-l5"]);
    expect(state.matchesServed).toBe(2);
    expect(state.matchesRemaining).toBe(1);
  });

  test("an outstanding suspension makes the player ineligible", () => {
    service.imposeSuspension({
      sanctionId: "ban-2",
      playerId: "player-boundary",
      competitionId: LEAGUE,
      // Incurred after the last fixture of the calendar year.
      matches: 2,
      incurredAt: new Date("2028-10-20T00:00:00.000Z"),
      reason: "Dissent.",
    });

    // Nothing has been played since, so the ban survives the winter break
    // rather than lapsing with it.
    const decision = service.eligibility("player-boundary", "fix-l7", "team-alpha");

    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe("SERVING_SUSPENSION");
    expect(decision.detail).toContain("2 match(es)");
  });

  test("a league suspension is served in the cup where the cup's rules say so", () => {
    service.reportResult(played("fix-c1", 2, 1));
    service.confirmResult("fix-c1", new Date("2028-10-08T21:00:00.000Z"));

    service.imposeSuspension({
      sanctionId: "ban-3",
      playerId: "player-carry",
      competitionId: LEAGUE,
      matches: 3,
      incurredAt: new Date("2028-10-01T00:00:00.000Z"),
      reason: "Sending off.",
    });

    const [state] = service.suspensionStates("player-carry", OCT_20);

    // The cup tie on the eighth counts, so the ban is spent by the nineteenth.
    expect(state.servedInFixtureIds).toEqual(["fix-l1", "fix-c1", "fix-l5"]);
    expect(state.matchesRemaining).toBe(0);
  });

  test("a cup suspension is not served in a league that does not carry it in", () => {
    service.reportResult(played("fix-c1", 2, 1));
    service.confirmResult("fix-c1", new Date("2028-10-08T21:00:00.000Z"));

    service.imposeSuspension({
      sanctionId: "ban-4",
      playerId: "player-cup-ban",
      competitionId: CUP,
      matches: 2,
      incurredAt: new Date("2028-10-01T00:00:00.000Z"),
      reason: "Sending off in the cup.",
    });

    const [state] = service.suspensionStates("player-cup-ban", OCT_20);

    expect(state.servedInFixtureIds).toEqual(["fix-c1"]);
    expect(state.matchesRemaining).toBe(1);
    // And the league fixtures it did not serve in remain playable.
    expect(service.eligibility("player-cup-ban", "fix-l7", "team-alpha").eligible).toBe(true);
  });
});

describe("LeagueIntegrityService — a result is a claim", () => {
  let service: LeagueIntegrityService;

  beforeEach(() => {
    service = build();
  });

  test("a reported but unconfirmed result does not move the table", () => {
    service.reportResult(played("fix-l1", 3, 0));

    const table = service.standings(LEAGUE, OCT_20);
    const alpha = table.find((row) => row.teamId === "team-alpha");

    expect(alpha?.played).toBe(0);
    expect(alpha?.points).toBe(0);
  });

  test("a disputed result comes back out of the table", () => {
    service.reportResult(played("fix-l1", 3, 0));
    service.confirmResult("fix-l1", new Date("2028-10-05T18:00:00.000Z"));
    expect(
      service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-alpha")?.points,
    ).toBe(3);

    service.disputeResult("fix-l1");

    expect(
      service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-alpha")?.points,
    ).toBe(0);
  });

  test("an abandonment before the threshold does not count, and after it does", () => {
    service.reportResult({
      ...played("fix-l1", 2, 0),
      outcome: "ABANDONED",
      abandonedAtMinute: 40,
    });
    service.confirmResult("fix-l1", new Date("2028-10-05T18:00:00.000Z"));

    expect(
      service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-alpha")?.played,
    ).toBe(0);

    service.reportResult({
      ...played("fix-l1", 2, 0),
      outcome: "ABANDONED",
      abandonedAtMinute: 75,
    });
    service.confirmResult("fix-l1", new Date("2028-10-05T18:00:00.000Z"));

    const alpha = service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-alpha");
    expect(alpha?.played).toBe(1);
    expect(alpha?.points).toBe(3);
  });

  test("a walkover awards the points without flattering the goal difference", () => {
    service.reportResult({
      ...played("fix-l1", 0, 3),
      outcome: "WALKOVER",
      awardedAgainstTeamId: "team-alpha",
    });
    service.confirmResult("fix-l1", new Date("2028-10-05T18:00:00.000Z"));

    const table = service.standings(LEAGUE, OCT_20);
    const bravo = table.find((row) => row.teamId === "team-bravo");

    expect(bravo?.points).toBe(3);
    expect(bravo?.won).toBe(1);
    expect(bravo?.goalsFor).toBe(0);
    expect(bravo?.goalDifference).toBe(0);
  });

  test("a points deduction lowers the total without touching any fixture", () => {
    recordLeagueResults(service);
    service.deductPoints({
      sanctionId: "deduction-1",
      teamId: "team-alpha",
      competitionId: LEAGUE,
      points: 3,
      appliedAt: new Date("2028-10-19T23:00:00.000Z"),
      reason: "Failure to fulfil a fixture.",
    });

    const alpha = service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-alpha");

    expect(alpha?.played).toBe(2);
    expect(alpha?.deductedPoints).toBe(3);
    expect(alpha?.points).toBe(3);
  });
});

describe("LeagueIntegrityService — a forfeit propagates", () => {
  let service: LeagueIntegrityService;

  beforeEach(() => {
    service = build();
    recordLeagueResults(service);
  });

  test("the table before the protest", () => {
    expect(positions(service)).toEqual({
      "team-alpha": 1,
      "team-charlie": 2,
      "team-bravo": 3,
      "team-delta": 4,
    });
  });

  test("upholding a protest reorders two teams that were not in the match", () => {
    service.raiseProtest({
      protestId: "protest-1",
      fixtureId: "fix-l5",
      againstTeamId: "team-alpha",
      playerId: "player-late",
      raisedBy: "user-delta-captain",
      raisedAt: new Date("2028-10-19T21:00:00.000Z"),
      note: "Alpha fielded a player registered after the deadline.",
    });

    const upheld = service.upholdProtest("protest-1", new Date("2028-10-19T23:30:00.000Z"));
    expect(upheld).toBe(true);

    // Charlie and Bravo did not play in fix-l5 and both move up.
    expect(positions(service)).toEqual({
      "team-charlie": 1,
      "team-bravo": 2,
      "team-alpha": 3,
      "team-delta": 4,
    });
  });

  test("the original result is voided rather than corrected", () => {
    service.raiseProtest({
      protestId: "protest-2",
      fixtureId: "fix-l5",
      againstTeamId: "team-alpha",
      playerId: "player-late",
      raisedBy: "user-delta-captain",
      raisedAt: new Date("2028-10-19T21:00:00.000Z"),
      note: "Ineligible player.",
    });
    service.upholdProtest("protest-2", new Date("2028-10-19T23:30:00.000Z"));

    const result = service.getResult("fix-l5");
    expect(result?.outcome).toBe("FORFEIT");
    expect(result?.awardedAgainstTeamId).toBe("team-alpha");
    // The award does not inflate the winner's goal difference either.
    const delta = service.standings(LEAGUE, OCT_20).find((row) => row.teamId === "team-delta");
    expect(delta?.points).toBe(3);
    expect(delta?.goalsFor).toBe(0);
    expect(service.getProtest("protest-2")?.outcome).toBe("UPHELD");
  });

  test("a rejected protest leaves the result standing", () => {
    service.raiseProtest({
      protestId: "protest-3",
      fixtureId: "fix-l5",
      againstTeamId: "team-alpha",
      playerId: "player-regular",
      raisedBy: "user-delta-captain",
      raisedAt: new Date("2028-10-19T21:00:00.000Z"),
      note: "Mistaken identity.",
    });
    service.rejectProtest("protest-3", new Date("2028-10-19T23:30:00.000Z"));

    expect(service.getResult("fix-l5")?.outcome).toBe("PLAYED");
    expect(positions(service)["team-alpha"]).toBe(1);
  });
});

describe("LeagueIntegrityService — tiebreaks", () => {
  /**
   * Five teams, three of which finish level on points, goal difference and
   * goals scored, so only the mini-table among exactly those three separates
   * them.
   */
  function roundRobin(): LeagueIntegrityService {
    const service = new LeagueIntegrityService();
    service.registerCompetition(competition({ competitionId: ROUND_ROBIN, name: "Round Robin" }));
    for (const teamId of ["team-x", "team-y", "team-z", "team-w", "team-v"]) {
      service.registerTeam({ teamId, competitionId: ROUND_ROBIN, name: teamId, hallId: null });
    }

    const results: Array<[string, string, string, number, number]> = [
      // Among the tied three.
      ["rr-1", "team-x", "team-y", 3, 0],
      ["rr-2", "team-x", "team-z", 3, 0],
      ["rr-3", "team-y", "team-z", 3, 0],
      // Against the two outside them, arranged so the totals come out level.
      ["rr-4", "team-x", "team-w", 1, 4],
      ["rr-5", "team-x", "team-v", 1, 4],
      ["rr-6", "team-y", "team-w", 4, 1],
      ["rr-7", "team-y", "team-v", 1, 4],
      ["rr-8", "team-z", "team-w", 4, 1],
      ["rr-9", "team-z", "team-v", 4, 1],
    ];

    for (const [fixtureId, home, away, homeScore, awayScore] of results) {
      service.scheduleFixture({
        fixtureId,
        competitionId: ROUND_ROBIN,
        homeTeamId: home,
        awayTeamId: away,
        kickOffAt: new Date("2028-10-10T14:00:00.000Z"),
      });
      service.reportResult(played(fixtureId, homeScore, awayScore));
      service.confirmResult(fixtureId, new Date("2028-10-10T18:00:00.000Z"));
    }

    return service;
  }

  test("three teams level on every arithmetic criterion are separated by a mini-table", () => {
    const service = roundRobin();
    const table = service.standings(ROUND_ROBIN, OCT_20);
    const byId = Object.fromEntries(table.map((row) => [row.teamId, row]));

    // Level on all three arithmetic criteria.
    for (const teamId of ["team-x", "team-y", "team-z"]) {
      expect(byId[teamId].points).toBe(6);
      expect(byId[teamId].goalDifference).toBe(0);
      expect(byId[teamId].goalsFor).toBe(8);
    }

    // x beat y and z, y beat z: the mini-table orders them 6, 3, 0.
    expect(byId["team-x"].position).toBeLessThan(byId["team-y"].position);
    expect(byId["team-y"].position).toBeLessThan(byId["team-z"].position);
    expect(byId["team-x"].unresolvedTieWith).toEqual([]);
  });

  test("teams level after every criterion are reported as level rather than sorted", () => {
    const service = new LeagueIntegrityService();
    service.registerCompetition(competition({ competitionId: "comp-two", name: "Two Team" }));
    service.registerTeam({ teamId: "team-m", competitionId: "comp-two", name: "M", hallId: null });
    service.registerTeam({ teamId: "team-n", competitionId: "comp-two", name: "N", hallId: null });
    service.scheduleFixture({
      fixtureId: "two-1",
      competitionId: "comp-two",
      homeTeamId: "team-m",
      awayTeamId: "team-n",
      kickOffAt: new Date("2028-10-10T14:00:00.000Z"),
    });
    service.reportResult(played("two-1", 1, 1));
    service.confirmResult("two-1", new Date("2028-10-10T18:00:00.000Z"));

    const table = service.standings("comp-two", OCT_20);

    expect(table[0].position).toBe(1);
    expect(table[1].position).toBe(1);
    expect(table[0].unresolvedTieWith).toEqual(["team-n"]);
    expect(table[1].unresolvedTieWith).toEqual(["team-m"]);
  });
});
