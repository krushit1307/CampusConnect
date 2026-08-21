import { describe, it, expect } from "vitest";
import {
  DEFAULT_RELIABILITY_CONFIG,
  ageInDays,
  bandForScore,
  bandLabel,
  computeReliabilityProfile,
  decayWeight,
  explainForecast,
  forecastShift,
  forecastShiftBoard,
  formatScorePercent,
  outcomeCredit,
  recommendBackups,
  riskLabel,
  staffingRiskFor,
  type ReliabilityProfile,
  type ShiftAttendanceRecord,
  type ShiftOutcome,
} from "./volunteerReliability";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const MS_PER_DAY = 86_400_000;

/** Builds a record for a shift that happened `daysAgo` before NOW. */
function record(outcome: ShiftOutcome, daysAgo: number, userId = "u1"): ShiftAttendanceRecord {
  const shiftStart = new Date(NOW.getTime() - daysAgo * MS_PER_DAY).toISOString();
  return {
    id: `rec-${outcome}-${daysAgo}-${userId}`,
    shift_id: `shift-${daysAgo}`,
    user_id: userId,
    outcome,
    shift_start: shiftStart,
    recorded_at: shiftStart,
  };
}

describe("decayWeight", () => {
  it("gives full weight to something that just happened", () => {
    expect(decayWeight(0, 60)).toBe(1);
  });

  it("halves the weight after exactly one half-life", () => {
    expect(decayWeight(60, 60)).toBeCloseTo(0.5, 10);
  });

  it("quarters the weight after two half-lives", () => {
    expect(decayWeight(120, 60)).toBeCloseTo(0.25, 10);
  });

  it("clamps future-dated records to full weight instead of exceeding 1", () => {
    expect(decayWeight(-30, 60)).toBe(1);
  });

  it("falls back to full weight when the half-life is nonsensical", () => {
    expect(decayWeight(30, 0)).toBe(1);
    expect(decayWeight(30, -5)).toBe(1);
  });
});

describe("ageInDays", () => {
  it("measures whole days back from now", () => {
    expect(ageInDays("2026-05-25T12:00:00.000Z", NOW)).toBeCloseTo(7, 6);
  });

  it("treats an unparseable timestamp as infinitely old", () => {
    expect(ageInDays("not-a-date", NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("outcomeCredit", () => {
  it("awards full credit for attending", () => {
    expect(outcomeCredit("attended")).toBe(1);
  });

  it("awards partial credit for arriving late", () => {
    expect(outcomeCredit("late")).toBe(DEFAULT_RELIABILITY_CONFIG.lateCredit);
  });

  it("awards no credit for a no-show", () => {
    expect(outcomeCredit("no_show")).toBe(0);
  });

  it("excludes excused and in-time cancellations from the ratio entirely", () => {
    expect(outcomeCredit("excused")).toBeNull();
    expect(outcomeCredit("cancelled_in_time")).toBeNull();
  });
});

describe("computeReliabilityProfile", () => {
  it("returns exactly the neutral prior for a volunteer with no history", () => {
    const profile = computeReliabilityProfile("u1", [], NOW);
    expect(profile.score).toBeCloseTo(DEFAULT_RELIABILITY_CONFIG.priorScore, 10);
    expect(profile.countedOutcomes).toBe(0);
    expect(profile.isProvisional).toBe(true);
    expect(profile.lastOutcomeAt).toBeNull();
  });

  it("ignores records belonging to other volunteers", () => {
    const records = [record("no_show", 1, "someone-else"), record("no_show", 2, "someone-else")];
    const profile = computeReliabilityProfile("u1", records, NOW);
    expect(profile.countedOutcomes).toBe(0);
    expect(profile.score).toBeCloseTo(DEFAULT_RELIABILITY_CONFIG.priorScore, 10);
  });

  it("does not drop a newcomer to zero after a single no-show", () => {
    const profile = computeReliabilityProfile("u1", [record("no_show", 1)], NOW);
    // Shrinkage keeps a one-data-point volunteer well above zero.
    expect(profile.score).toBeGreaterThan(0.5);
    expect(profile.score).toBeLessThan(DEFAULT_RELIABILITY_CONFIG.priorScore);
    expect(profile.isProvisional).toBe(true);
  });

  it("climbs toward 1 for a consistently reliable volunteer", () => {
    const records = [0, 7, 14, 21, 28, 35, 42, 49].map((d) => record("attended", d));
    const profile = computeReliabilityProfile("u1", records, NOW);
    expect(profile.score).toBeGreaterThan(0.9);
    expect(profile.band).toBe("exemplary");
    expect(profile.isProvisional).toBe(false);
  });

  it("sinks a serial ghost into the at-risk band", () => {
    const records = [0, 5, 10, 15, 20, 25, 30, 35].map((d) => record("no_show", d));
    const profile = computeReliabilityProfile("u1", records, NOW);
    expect(profile.score).toBeLessThan(0.55);
    expect(profile.band).toBe("at_risk");
  });

  it("weights a recent no-show more heavily than an ancient one", () => {
    const base = [0, 10, 20, 30].map((d) => record("attended", d + 1));

    const recentMiss = computeReliabilityProfile("u1", [...base, record("no_show", 0)], NOW);
    const ancientMiss = computeReliabilityProfile("u1", [...base, record("no_show", 400)], NOW);

    expect(recentMiss.score).toBeLessThan(ancientMiss.score);
  });

  it("lets a reformed volunteer recover as the old misses decay", () => {
    const oldMisses = [200, 210, 220, 230].map((d) => record("no_show", d));
    const recentGood = [0, 5, 10, 15, 20, 25].map((d) => record("attended", d));

    const profile = computeReliabilityProfile("u1", [...oldMisses, ...recentGood], NOW);
    expect(profile.score).toBeGreaterThan(0.75);
    expect(profile.currentAttendedStreak).toBe(6);
    expect(profile.currentNoShowStreak).toBe(0);
  });

  it("does not punish a volunteer who cancels with enough notice", () => {
    const cancelled = computeReliabilityProfile("u1", [record("cancelled_in_time", 1)], NOW);
    const ghosted = computeReliabilityProfile("u1", [record("no_show", 1)], NOW);

    expect(cancelled.score).toBeCloseTo(DEFAULT_RELIABILITY_CONFIG.priorScore, 10);
    expect(cancelled.score).toBeGreaterThan(ghosted.score);
    expect(cancelled.counts.cancelled_in_time).toBe(1);
    expect(cancelled.countedOutcomes).toBe(0);
  });

  it("does not let cancelling shifts inflate a score above the prior", () => {
    const records = Array.from({ length: 20 }, (_, i) => record("cancelled_in_time", i));
    const profile = computeReliabilityProfile("u1", records, NOW);
    expect(profile.score).toBeCloseTo(DEFAULT_RELIABILITY_CONFIG.priorScore, 10);
  });

  it("scores arriving late between attending and ghosting", () => {
    const build = (outcome: ShiftOutcome) =>
      computeReliabilityProfile(
        "u1",
        [0, 5, 10, 15].map((d) => record(outcome, d)),
        NOW,
      ).score;

    expect(build("late")).toBeLessThan(build("attended"));
    expect(build("late")).toBeGreaterThan(build("no_show"));
  });

  it("ignores outcomes beyond the maximum age window", () => {
    const profile = computeReliabilityProfile(
      "u1",
      [record("no_show", DEFAULT_RELIABILITY_CONFIG.maxAgeDays + 30)],
      NOW,
    );
    expect(profile.countedOutcomes).toBe(0);
    expect(profile.counts.no_show).toBe(0);
    expect(profile.score).toBeCloseTo(DEFAULT_RELIABILITY_CONFIG.priorScore, 10);
  });

  it("tallies raw counts per outcome", () => {
    const profile = computeReliabilityProfile(
      "u1",
      [
        record("attended", 1),
        record("attended", 2),
        record("late", 3),
        record("no_show", 4),
        record("excused", 5),
      ],
      NOW,
    );
    expect(profile.counts.attended).toBe(2);
    expect(profile.counts.late).toBe(1);
    expect(profile.counts.no_show).toBe(1);
    expect(profile.counts.excused).toBe(1);
    expect(profile.countedOutcomes).toBe(4); // excused excluded
  });

  it("reports the most recent outcome timestamp", () => {
    const profile = computeReliabilityProfile(
      "u1",
      [record("attended", 30), record("no_show", 2), record("attended", 90)],
      NOW,
    );
    expect(profile.lastOutcomeAt).toBe(new Date(NOW.getTime() - 2 * MS_PER_DAY).toISOString());
  });

  describe("streaks", () => {
    it("counts consecutive recent no-shows", () => {
      const profile = computeReliabilityProfile(
        "u1",
        [record("no_show", 1), record("no_show", 8), record("no_show", 15), record("attended", 22)],
        NOW,
      );
      expect(profile.currentNoShowStreak).toBe(3);
      expect(profile.currentAttendedStreak).toBe(0);
    });

    it("skips over excused shifts rather than breaking the streak", () => {
      const profile = computeReliabilityProfile(
        "u1",
        [record("no_show", 1), record("excused", 5), record("no_show", 9), record("attended", 20)],
        NOW,
      );
      expect(profile.currentNoShowStreak).toBe(2);
    });

    it("counts a late arrival as continuing an attendance streak", () => {
      const profile = computeReliabilityProfile(
        "u1",
        [record("attended", 1), record("late", 6), record("attended", 11)],
        NOW,
      );
      expect(profile.currentAttendedStreak).toBe(3);
      expect(profile.currentNoShowStreak).toBe(0);
    });
  });
});

describe("bandForScore", () => {
  it("maps scores onto the documented bands", () => {
    expect(bandForScore(0.98)).toBe("exemplary");
    expect(bandForScore(0.9)).toBe("exemplary");
    expect(bandForScore(0.8)).toBe("reliable");
    expect(bandForScore(0.75)).toBe("reliable");
    expect(bandForScore(0.6)).toBe("watch");
    expect(bandForScore(0.55)).toBe("watch");
    expect(bandForScore(0.2)).toBe("at_risk");
    expect(bandForScore(0)).toBe("at_risk");
  });
});

describe("staffingRiskFor", () => {
  it("calls a fully covered shift healthy", () => {
    expect(staffingRiskFor(4, 4)).toBe("healthy");
    expect(staffingRiskFor(5, 4)).toBe("healthy");
  });

  it("grades partial coverage down through the bands", () => {
    expect(staffingRiskFor(3.5, 4)).toBe("thin");
    expect(staffingRiskFor(2.5, 4)).toBe("at_risk");
    expect(staffingRiskFor(1, 4)).toBe("critical");
  });

  it("treats a zero-capacity shift as healthy rather than dividing by zero", () => {
    expect(staffingRiskFor(0, 0)).toBe("healthy");
  });
});

describe("recommendBackups", () => {
  it("recommends nobody when there is no gap", () => {
    expect(recommendBackups(0)).toBe(0);
    expect(recommendBackups(-2)).toBe(0);
  });

  it("over-recruits to account for backups themselves being unreliable", () => {
    // A gap of 2.0 needs more than 2 people, since backups average 0.8.
    expect(recommendBackups(2)).toBe(3);
  });
});

describe("forecastShift", () => {
  function profileFor(userId: string, score: number): ReliabilityProfile {
    return {
      userId,
      score,
      band: bandForScore(score),
      weightedTotal: 5,
      weightedCredit: 5 * score,
      counts: {
        attended: 0,
        late: 0,
        no_show: 0,
        excused: 0,
        cancelled_in_time: 0,
      },
      countedOutcomes: 5,
      currentNoShowStreak: 0,
      currentAttendedStreak: 0,
      isProvisional: false,
      lastOutcomeAt: null,
    };
  }

  const shift = {
    shiftId: "s1",
    shiftTitle: "Registration desk",
    startTime: "2026-06-10T09:00:00.000Z",
    endTime: "2026-06-10T12:00:00.000Z",
    capacity: 4,
    assigneeIds: ["a", "b", "c", "d", "e", "f"],
  };

  it("forecasts fewer bodies than signups when assignees are unreliable", () => {
    const profiles = new Map(shift.assigneeIds.map((id) => [id, profileFor(id, 0.5)]));
    const forecast = forecastShift(shift, profiles);

    expect(forecast.signupCount).toBe(6);
    expect(forecast.expectedAttendance).toBe(3);
    expect(forecast.forecastGap).toBe(1);
    expect(forecast.risk).toBe("at_risk");
    expect(forecast.recommendedBackups).toBeGreaterThan(0);
  });

  it("reports a healthy shift with no recommended backups", () => {
    const profiles = new Map(shift.assigneeIds.map((id) => [id, profileFor(id, 0.95)]));
    const forecast = forecastShift(shift, profiles);

    expect(forecast.risk).toBe("healthy");
    expect(forecast.forecastGap).toBe(0);
    expect(forecast.recommendedBackups).toBe(0);
  });

  it("falls back to the prior for assignees with no profile", () => {
    const forecast = forecastShift(
      { ...shift, assigneeIds: ["unknown-1", "unknown-2"] },
      new Map(),
    );
    expect(forecast.expectedAttendance).toBeCloseTo(2 * DEFAULT_RELIABILITY_CONFIG.priorScore, 6);
  });

  it("names the assignees in the weakest bands", () => {
    const profiles = new Map([
      ["a", profileFor("a", 0.95)],
      ["b", profileFor("b", 0.6)],
      ["c", profileFor("c", 0.3)],
    ]);
    const forecast = forecastShift({ ...shift, assigneeIds: ["a", "b", "c"] }, profiles);
    expect(forecast.shakyAssigneeIds).toEqual(["b", "c"]);
  });

  it("handles an unclaimed shift without dividing by zero", () => {
    const forecast = forecastShift({ ...shift, assigneeIds: [] }, new Map());
    expect(forecast.expectedAttendance).toBe(0);
    expect(forecast.forecastGap).toBe(4);
    expect(forecast.risk).toBe("critical");
  });
});

describe("forecastShiftBoard", () => {
  it("sorts the worst shifts to the top", () => {
    const shifts = [
      {
        shiftId: "healthy",
        shiftTitle: "Healthy",
        startTime: "2026-06-10T09:00:00.000Z",
        endTime: "2026-06-10T12:00:00.000Z",
        capacity: 2,
        assigneeIds: ["a", "b", "c"],
      },
      {
        shiftId: "empty",
        shiftTitle: "Empty",
        startTime: "2026-06-10T13:00:00.000Z",
        endTime: "2026-06-10T16:00:00.000Z",
        capacity: 5,
        assigneeIds: [],
      },
      {
        shiftId: "thin",
        shiftTitle: "Thin",
        startTime: "2026-06-10T17:00:00.000Z",
        endTime: "2026-06-10T20:00:00.000Z",
        capacity: 4,
        assigneeIds: ["a", "b", "c", "d"],
      },
    ];

    const board = forecastShiftBoard(shifts, new Map());
    expect(board[0].shiftId).toBe("empty");
    expect(board[board.length - 1].shiftId).toBe("healthy");
  });
});

describe("presentation helpers", () => {
  it("formats a score as a rounded percentage", () => {
    expect(formatScorePercent(0.874)).toBe("87%");
    expect(formatScorePercent(1.4)).toBe("100%");
    expect(formatScorePercent(-1)).toBe("0%");
  });

  it("labels every band and risk level", () => {
    expect(bandLabel("exemplary")).toBe("Exemplary");
    expect(bandLabel("at_risk")).toBe("At risk");
    expect(riskLabel("critical")).toBe("Critically short");
    expect(riskLabel("healthy")).toBe("Fully staffed");
  });

  it("explains an unclaimed shift plainly", () => {
    const explanation = explainForecast({
      shiftId: "s",
      shiftTitle: "Gate",
      startTime: "2026-06-10T09:00:00.000Z",
      endTime: "2026-06-10T12:00:00.000Z",
      capacity: 3,
      signupCount: 0,
      expectedAttendance: 0,
      forecastGap: 3,
      risk: "critical",
      recommendedBackups: 4,
      shakyAssigneeIds: [],
    });
    expect(explanation).toContain("No volunteers have claimed");
    expect(explanation).toContain("3 needed");
  });

  it("calls out shaky assignees when a shift is under-forecast", () => {
    const explanation = explainForecast({
      shiftId: "s",
      shiftTitle: "Gate",
      startTime: "2026-06-10T09:00:00.000Z",
      endTime: "2026-06-10T12:00:00.000Z",
      capacity: 4,
      signupCount: 6,
      expectedAttendance: 3.4,
      forecastGap: 0.6,
      risk: "thin",
      recommendedBackups: 1,
      shakyAssigneeIds: ["x", "y"],
    });
    expect(explanation).toContain("~3.4");
    expect(explanation).toContain("2 of them have a weak attendance record");
  });
});
