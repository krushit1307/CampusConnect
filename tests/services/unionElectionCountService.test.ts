/**
 * Test suite: Student Union Election Count (#5013)
 * File: tests/services/unionElectionCountService.test.ts
 *
 * The cases worth writing down are the ones a spreadsheet and a returning
 * officer at two in the morning both get wrong: the candidate with the largest
 * first-preference pile who loses, a surplus that has to move at a fraction of
 * a vote rather than as a handful of whole ones, two candidates level at an
 * elimination, a ballot that stops transferring without being spoiled, and a
 * seat won by re-opening nominations.
 */

import { describe, test, expect } from "vitest";
import {
  UnionElectionCountService,
  WEIGHT_SCALE,
  type Ballot,
  type Election,
} from "../../src/services/unionElectionCountService";

const REGISTER_CLOSES = new Date("2028-02-14T23:59:00.000Z");
const NOMINATIONS_CLOSE = new Date("2028-02-21T17:00:00.000Z");
const COUNT_AT = new Date("2028-03-06T21:00:00.000Z");

function election(seats: number, position = "President"): Election {
  return {
    electionId: `election-${position.toLowerCase()}`,
    position,
    seats,
    registerClosesAt: REGISTER_CLOSES,
    nominationClosesAt: NOMINATIONS_CLOSE,
  };
}

/** A count with a fixed set of candidates, all validly nominated. */
function service(
  seats: number,
  candidateIds: string[],
  options: {
    ron?: string;
    disqualified?: string;
    lateNomination?: string;
    ineligible?: string;
    draw?: (tied: string[]) => string;
  } = {},
): UnionElectionCountService {
  const instance = new UnionElectionCountService(election(seats), options.draw);
  for (const candidateId of candidateIds) {
    instance.addCandidate({
      candidateId,
      name: candidateId,
      isReopenNominations: candidateId === options.ron,
      nominatedAt:
        candidateId === options.lateNomination
          ? new Date("2028-02-22T09:00:00.000Z")
          : new Date("2028-02-20T09:00:00.000Z"),
      eligibleOnNominationDay: candidateId !== options.ineligible,
      disqualifiedAt:
        candidateId === options.disqualified ? new Date("2028-03-01T10:00:00.000Z") : null,
    });
  }
  return instance;
}

/** `count` ballots all ranking the same candidates in the same order. */
function bloc(
  instance: UnionElectionCountService,
  prefix: string,
  count: number,
  order: string[],
  registerFrom = 0,
): void {
  for (let index = 0; index < count; index += 1) {
    const voterId = `${prefix}-voter-${index}`;
    instance.registerVoter({ voterId, joinedAt: new Date("2028-01-10T09:00:00.000Z") });
    instance.castBallot({
      ballotId: `${prefix}-ballot-${index + registerFrom}`,
      voterId,
      castAt: new Date("2028-03-05T12:00:00.000Z"),
      preferences: order.map((candidateId, position) => ({ rank: position + 1, candidateId })),
    });
  }
}

describe("UnionElectionCountService — transfers change the winner", () => {
  test("the largest first-preference pile does not win the seat", () => {
    const instance = service(1, ["cand-a", "cand-b", "cand-c"]);
    bloc(instance, "a", 40, ["cand-a"]);
    bloc(instance, "b", 35, ["cand-b", "cand-c"]);
    bloc(instance, "c", 25, ["cand-c", "cand-b"]);

    const result = instance.count(COUNT_AT);

    const first = result.stages[0];
    expect(first.action).toBe("FIRST_PREFERENCES");
    expect(first.totalsScaled["cand-a"]).toBe(40 * WEIGHT_SCALE);

    // A leads on first preferences and loses once C's ballots move.
    expect(result.elected).toEqual(["cand-b"]);
    expect(result.seatsFilled).toBe(1);
  });

  test("the quota is a Droop quota over the valid poll, not the ballots cast", () => {
    const instance = service(1, ["cand-a", "cand-b"]);
    bloc(instance, "a", 60, ["cand-a"]);
    bloc(instance, "b", 40, ["cand-b"]);

    // Five blank ballots from registered voters. Cast, counted as cast, and not
    // part of the poll the quota is computed from.
    for (let index = 0; index < 5; index += 1) {
      const voterId = `blank-voter-${index}`;
      instance.registerVoter({ voterId, joinedAt: new Date("2028-01-10T09:00:00.000Z") });
      instance.castBallot({
        ballotId: `blank-${index}`,
        voterId,
        castAt: new Date("2028-03-05T12:00:00.000Z"),
        preferences: [],
      });
    }

    const result = instance.count(COUNT_AT);

    expect(result.ballotsCast).toBe(105);
    expect(result.validPoll).toBe(100);
    expect(result.quotaScaled).toBe(Math.floor((100 * WEIGHT_SCALE) / 2) + 1);
    expect(result.rejected.filter((r) => r.reason === "NO_PREFERENCES")).toHaveLength(5);
  });
});

describe("UnionElectionCountService — fractional surplus transfer", () => {
  test("every ballot in an elected pile moves at a reduced value", () => {
    const instance = service(2, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 60, ["cand-a", "cand-b"]);
    bloc(instance, "c", 21, ["cand-c"]);
    bloc(instance, "d", 19, ["cand-d"]);

    const result = instance.count(COUNT_AT);

    // Droop for 2 seats over 100 valid votes.
    expect(result.quotaScaled).toBe(Math.floor((100 * WEIGHT_SCALE) / 3) + 1);

    const surplus = result.stages.find((stage) => stage.action === "SURPLUS_TRANSFER");
    expect(surplus).toBeDefined();
    expect(surplus?.transferredFrom).toBe("cand-a");

    // Surplus 26,666,666 spread over a pile of 60 whole votes.
    expect(surplus?.transferValueScaled).toBe(444_444);
    expect(surplus?.totalsScaled["cand-b"]).toBe(60 * 444_444);

    // A retains exactly the quota once the surplus has gone.
    expect(surplus?.totalsScaled["cand-a"]).toBe(result.quotaScaled);
  });

  test("a candidate elected on first preferences keeps their full total on that stage", () => {
    const instance = service(2, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 60, ["cand-a", "cand-b"]);
    bloc(instance, "c", 21, ["cand-c"]);
    bloc(instance, "d", 19, ["cand-d"]);

    const result = instance.count(COUNT_AT);
    const first = result.stages[0];

    // The record has to show why the seat was won, not the quota that was kept.
    expect(first.totalsScaled["cand-a"]).toBe(60 * WEIGHT_SCALE);
    expect(first.electedAtThisStage).toEqual(["cand-a"]);
  });
});

describe("UnionElectionCountService — exhaustion and termination", () => {
  test("a ballot that runs out of preferences leaves the count without being spoiled", () => {
    const instance = service(2, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 60, ["cand-a", "cand-b"]);
    bloc(instance, "c", 21, ["cand-c"]);
    bloc(instance, "d", 19, ["cand-d"]);

    const result = instance.count(COUNT_AT);

    // C's 21 and D's 19 ranked nobody else. None of them was ever rejected.
    expect(result.exhaustedScaled).toBe(40 * WEIGHT_SCALE);
    expect(result.rejected).toHaveLength(0);
    expect(result.validPoll).toBe(100);
  });

  test("the last continuing candidates fill the remaining seats without a quota", () => {
    const instance = service(2, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 60, ["cand-a", "cand-b"]);
    bloc(instance, "c", 21, ["cand-c"]);
    bloc(instance, "d", 19, ["cand-d"]);

    const result = instance.count(COUNT_AT);
    const fill = result.stages.find((stage) => stage.action === "FILL_REMAINING_SEATS");

    expect(fill).toBeDefined();
    expect(fill?.electedAtThisStage).toEqual(["cand-b"]);
    // B never reached the quota and still took the second seat.
    expect(result.elected).toEqual(["cand-a", "cand-b"]);
    expect(result.seatsUnfilled).toBe(0);
  });

  test("a seat nobody stood for is unfilled, which is not the same as re-opened", () => {
    const instance = service(3, ["cand-a", "cand-b"]);
    bloc(instance, "a", 60, ["cand-a"]);
    bloc(instance, "b", 40, ["cand-b"]);

    const result = instance.count(COUNT_AT);

    expect(result.elected).toHaveLength(2);
    expect(result.seatsUnfilled).toBe(1);
    expect(result.seatsReopened).toBe(0);
  });
});

describe("UnionElectionCountService — ties", () => {
  test("countback to the earliest stage that separated them decides an elimination", () => {
    const instance = service(1, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 40, ["cand-a"]);
    bloc(instance, "b", 10, ["cand-b", "cand-c"]);
    bloc(instance, "c", 20, ["cand-c"]);
    bloc(instance, "d", 30, ["cand-d"]);

    const result = instance.count(COUNT_AT);

    // B goes first, putting C level with D on 30.
    const tied = result.stages.find((stage) => stage.tieBreak !== null);
    expect(tied?.tieBreak?.tied).toEqual(["cand-c", "cand-d"]);
    expect(tied?.tieBreak?.rule).toBe("COUNTBACK");
    // At first preferences C had 20 and D had 30, so C goes.
    expect(tied?.tieBreak?.separatedAtStage).toBe(1);
    expect(tied?.tieBreak?.chosen).toBe("cand-c");
    expect(tied?.eliminatedAtThisStage).toBe("cand-c");
  });

  test("candidates level at every stage fall to a recorded draw", () => {
    const instance = service(1, ["cand-a", "cand-b", "cand-c"], {
      draw: (tied) => tied[tied.length - 1],
    });
    bloc(instance, "a", 40, ["cand-a"]);
    bloc(instance, "b", 30, ["cand-b"]);
    bloc(instance, "c", 30, ["cand-c"]);

    const result = instance.count(COUNT_AT);
    const tied = result.stages.find((stage) => stage.tieBreak !== null);

    expect(tied?.tieBreak?.rule).toBe("RANDOM_DRAW");
    expect(tied?.tieBreak?.separatedAtStage).toBeNull();
    expect(tied?.tieBreak?.chosen).toBe("cand-c");
    // Which rule fired is part of the result, not a footnote to it.
    expect(tied?.note).toContain("random draw");
  });
});

describe("UnionElectionCountService — eligibility is a fact about a moment", () => {
  test("a disqualified candidate's ballots transfer to the next available preference", () => {
    const instance = service(1, ["cand-a", "cand-b", "cand-c"], { disqualified: "cand-b" });
    bloc(instance, "a", 45, ["cand-a"]);
    bloc(instance, "b", 30, ["cand-b", "cand-c"]);
    bloc(instance, "c", 25, ["cand-c"]);

    const result = instance.count(COUNT_AT);

    expect(result.excludedCandidates["cand-b"]).toBe("DISQUALIFIED");
    // The 30 ballots were not deleted with the candidate.
    expect(result.stages[0].totalsScaled["cand-c"]).toBe(55 * WEIGHT_SCALE);
    expect(result.stages[0].totalsScaled["cand-b"]).toBeUndefined();
    expect(result.elected).toEqual(["cand-c"]);
  });

  test("a candidate nominated after the deadline is excluded", () => {
    const instance = service(1, ["cand-a", "cand-b"], { lateNomination: "cand-b" });
    bloc(instance, "a", 60, ["cand-a"]);
    bloc(instance, "b", 40, ["cand-b", "cand-a"]);

    const result = instance.count(COUNT_AT);

    expect(result.excludedCandidates["cand-b"]).toBe("NOT_VALIDLY_NOMINATED");
    expect(result.stages[0].totalsScaled["cand-a"]).toBe(100 * WEIGHT_SCALE);
  });

  test("someone ineligible on nomination day never enters the count", () => {
    const instance = service(1, ["cand-a", "cand-b"], { ineligible: "cand-b" });
    bloc(instance, "a", 60, ["cand-a"]);
    bloc(instance, "b", 40, ["cand-b", "cand-a"]);

    const result = instance.count(COUNT_AT);

    expect(result.excludedCandidates["cand-b"]).toBe("INELIGIBLE_ON_NOMINATION_DAY");
  });
});

describe("UnionElectionCountService — re-opening nominations is a candidate", () => {
  test("RON taking the seat re-runs the position rather than filling it", () => {
    const instance = service(1, ["cand-ron", "cand-a"], { ron: "cand-ron" });
    bloc(instance, "r", 60, ["cand-ron"]);
    bloc(instance, "a", 40, ["cand-a"]);

    const result = instance.count(COUNT_AT);

    expect(result.elected).toEqual(["cand-ron"]);
    expect(result.seatsReopened).toBe(1);
    // The seat is not filled by a person, and it is not unfilled either.
    expect(result.seatsFilled).toBe(0);
    expect(result.seatsUnfilled).toBe(0);
  });
});

describe("UnionElectionCountService — ballot validation", () => {
  function withOneBallot(preferences: Ballot["preferences"], voterJoined?: Date) {
    const instance = service(1, ["cand-a", "cand-b"]);
    instance.registerVoter({
      voterId: "voter-x",
      joinedAt: voterJoined ?? new Date("2028-01-10T09:00:00.000Z"),
    });
    instance.castBallot({
      ballotId: "ballot-x",
      voterId: "voter-x",
      castAt: new Date("2028-03-05T12:00:00.000Z"),
      preferences,
    });
    return instance.validateBallots();
  }

  test("a gap in the ranking is rejected", () => {
    const { rejected } = withOneBallot([
      { rank: 1, candidateId: "cand-a" },
      { rank: 3, candidateId: "cand-b" },
    ]);

    expect(rejected[0].reason).toBe("NON_SEQUENTIAL_PREFERENCES");
  });

  test("the same candidate ranked twice is rejected", () => {
    const { rejected } = withOneBallot([
      { rank: 1, candidateId: "cand-a" },
      { rank: 2, candidateId: "cand-a" },
    ]);

    expect(rejected[0].reason).toBe("DUPLICATE_PREFERENCE");
  });

  test("a preference for someone not standing is rejected", () => {
    const { rejected } = withOneBallot([{ rank: 1, candidateId: "cand-nobody" }]);

    expect(rejected[0].reason).toBe("UNKNOWN_CANDIDATE");
  });

  test("a voter who joined after the register closed does not vote", () => {
    const { valid, rejected } = withOneBallot(
      [{ rank: 1, candidateId: "cand-a" }],
      new Date("2028-02-20T09:00:00.000Z"),
    );

    expect(valid).toHaveLength(0);
    expect(rejected[0].reason).toBe("VOTER_NOT_ON_REGISTER");
    expect(rejected[0].detail).toContain("register closed");
  });

  test("a ranking of two out of many is valid and merely exhausts later", () => {
    const { valid, rejected } = withOneBallot([
      { rank: 1, candidateId: "cand-a" },
      { rank: 2, candidateId: "cand-b" },
    ]);

    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  test("a second ballot from the same voter is rejected, the first is not", () => {
    const instance = service(1, ["cand-a", "cand-b"]);
    instance.registerVoter({ voterId: "voter-y", joinedAt: new Date("2028-01-10T09:00:00.000Z") });
    for (const ballotId of ["ballot-y1", "ballot-y2"]) {
      instance.castBallot({
        ballotId,
        voterId: "voter-y",
        castAt: new Date("2028-03-05T12:00:00.000Z"),
        preferences: [{ rank: 1, candidateId: "cand-a" }],
      });
    }

    const { valid, rejected } = instance.validateBallots();

    expect(valid.map((ballot) => ballot.ballotId)).toEqual(["ballot-y1"]);
    expect(rejected[0].reason).toBe("DUPLICATE_BALLOT_FROM_VOTER");
  });
});

describe("UnionElectionCountService — the record is the output", () => {
  test("every stage carries totals, an action and a running exhausted figure", () => {
    const instance = service(2, ["cand-a", "cand-b", "cand-c", "cand-d"]);
    bloc(instance, "a", 60, ["cand-a", "cand-b"]);
    bloc(instance, "c", 21, ["cand-c"]);
    bloc(instance, "d", 19, ["cand-d"]);

    const result = instance.count(COUNT_AT);

    expect(result.stages.length).toBeGreaterThan(2);
    result.stages.forEach((stage, index) => {
      expect(stage.stageNumber).toBe(index + 1);
      expect(stage.note).not.toHaveLength(0);
      expect(Object.keys(stage.totalsScaled).length).toBeGreaterThan(0);
    });

    // The running total only ever goes up, and finishes where the result says.
    const running = result.stages.map((stage) => stage.cumulativeExhaustedScaled);
    expect(running).toEqual([...running].sort((a, b) => a - b));
    expect(running[running.length - 1]).toBe(result.exhaustedScaled);
  });
});
