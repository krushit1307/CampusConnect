import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  isEligible,
  isAvailableForSlot,
  expertiseOverlap,
  collectAllConflicts,
  buildEligibilityMatrix,
  summariseWorkload,
  assignJudges,
  validateAssignments,
  type Judge,
  type Project,
} from "./judgeAssignment";

function judge(id: string, overrides: Partial<Judge> = {}): Judge {
  return {
    id,
    name: id.toUpperCase(),
    expertiseTags: [],
    clubIds: [],
    ...overrides,
  };
}

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id.toUpperCase(),
    teamMemberIds: [],
    clubIds: [],
    topicTags: [],
    slotId: "slot_1",
    ...overrides,
  };
}

describe("Hackathon Judging Assignment Engine (#3135)", () => {
  describe("conflict of interest detection", () => {
    it("blocks a judge who is on the project team", () => {
      const conflicts = detectConflicts(
        judge("j_1"),
        project("p_1", { teamMemberIds: ["j_1", "s_9"] }),
      );
      expect(conflicts.map((c) => c.reason)).toEqual(["SAME_TEAM"]);
    });

    it("blocks a judge who shares a club affiliation with the team", () => {
      const conflicts = detectConflicts(
        judge("j_1", { clubIds: ["club_robotics"] }),
        project("p_1", { clubIds: ["club_robotics", "club_ai"] }),
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reason).toBe("SAME_CLUB");
      expect(conflicts[0].detail).toContain("club_robotics");
    });

    it("blocks a judge who mentors the team", () => {
      const conflicts = detectConflicts(
        judge("j_1", { mentoredProjectIds: ["p_1"] }),
        project("p_1"),
      );
      expect(conflicts.map((c) => c.reason)).toEqual(["MENTOR"]);
    });

    it("honours a self-declared recusal", () => {
      const conflicts = detectConflicts(
        judge("j_1", { recusedProjectIds: ["p_1"] }),
        project("p_1"),
      );
      expect(conflicts.map((c) => c.reason)).toEqual(["SELF_DECLARED"]);
    });

    it("reports every applicable reason rather than short-circuiting", () => {
      const conflicts = detectConflicts(
        judge("j_1", { clubIds: ["club_a"], mentoredProjectIds: ["p_1"] }),
        project("p_1", { teamMemberIds: ["j_1"], clubIds: ["club_a"] }),
      );
      expect(conflicts.map((c) => c.reason).sort()).toEqual(["MENTOR", "SAME_CLUB", "SAME_TEAM"]);
    });

    it("clears a judge with no relationship to the team", () => {
      expect(
        isEligible(judge("j_1", { clubIds: ["club_a"] }), project("p_1", { clubIds: ["club_b"] })),
      ).toBe(true);
    });

    it("produces a stable, sorted audit trail across the bracket", () => {
      const judges = [judge("j_2", { clubIds: ["club_a"] }), judge("j_1", { clubIds: ["club_a"] })];
      const projects = [
        project("p_2", { clubIds: ["club_a"] }),
        project("p_1", { clubIds: ["club_a"] }),
      ];

      const conflicts = collectAllConflicts(judges, projects);
      expect(conflicts.map((c) => `${c.projectId}:${c.judgeId}`)).toEqual([
        "p_1:j_1",
        "p_1:j_2",
        "p_2:j_1",
        "p_2:j_2",
      ]);
    });
  });

  describe("availability and expertise", () => {
    it("treats an empty availability list as available for everything", () => {
      expect(isAvailableForSlot(judge("j_1"), "slot_9")).toBe(true);
      expect(isAvailableForSlot(judge("j_1", { availableSlotIds: [] }), "slot_9")).toBe(true);
    });

    it("respects a declared availability window", () => {
      const j = judge("j_1", { availableSlotIds: ["slot_1"] });
      expect(isAvailableForSlot(j, "slot_1")).toBe(true);
      expect(isAvailableForSlot(j, "slot_2")).toBe(false);
    });

    it("counts shared topic tags case-insensitively", () => {
      const j = judge("j_1", { expertiseTags: ["Machine Learning", " Robotics "] });
      const p = project("p_1", { topicTags: ["machine learning", "robotics", "fintech"] });
      expect(expertiseOverlap(j, p)).toBe(2);
    });
  });

  describe("eligibility matrix", () => {
    it("excludes conflicted and unavailable judges", () => {
      const judges = [
        judge("j_1", { clubIds: ["club_a"] }),
        judge("j_2", { availableSlotIds: ["slot_9"] }),
        judge("j_3"),
      ];
      const projects = [project("p_1", { clubIds: ["club_a"], slotId: "slot_1" })];

      expect(buildEligibilityMatrix(judges, projects).get("p_1")).toEqual(["j_3"]);
    });
  });

  describe("allocation", () => {
    const judges = [
      judge("j_1"),
      judge("j_2"),
      judge("j_3"),
      judge("j_4"),
      judge("j_5"),
      judge("j_6"),
    ];
    const projects = [
      project("p_1", { slotId: "slot_1" }),
      project("p_2", { slotId: "slot_2" }),
      project("p_3", { slotId: "slot_3" }),
      project("p_4", { slotId: "slot_4" }),
    ];

    it("gives every project the requested number of judges", () => {
      const result = assignJudges(judges, projects, { judgesPerProject: 2 });

      expect(result.isFullyCovered).toBe(true);
      expect(result.assignments).toHaveLength(8);
      for (const p of projects) {
        expect(result.assignments.filter((a) => a.projectId === p.id)).toHaveLength(2);
      }
    });

    it("keeps judge workload within one assignment of the mean", () => {
      const result = assignJudges(judges, projects, { judgesPerProject: 2 });
      expect(result.workload.spread).toBeLessThanOrEqual(1);
      expect(result.workload.max).toBe(2);
      expect(result.workload.min).toBe(1);
    });

    it("never assigns a conflicted judge", () => {
      const conflicted = [
        judge("j_1", { clubIds: ["club_a"] }),
        judge("j_2", { clubIds: ["club_a"] }),
        judge("j_3"),
        judge("j_4"),
      ];
      const clubProjects = [
        project("p_1", { clubIds: ["club_a"], slotId: "slot_1" }),
        project("p_2", { slotId: "slot_2" }),
      ];

      const result = assignJudges(conflicted, clubProjects, { judgesPerProject: 2 });
      const p1Judges = result.assignments
        .filter((a) => a.projectId === "p_1")
        .map((a) => a.judgeId);

      expect(p1Judges).not.toContain("j_1");
      expect(p1Judges).not.toContain("j_2");
      expect(validateAssignments(conflicted, clubProjects, result.assignments).valid).toBe(true);
    });

    it("never double-books a judge within one slot", () => {
      const sameSlot = [project("p_1", { slotId: "slot_1" }), project("p_2", { slotId: "slot_1" })];
      const result = assignJudges([judge("j_1"), judge("j_2")], sameSlot, { judgesPerProject: 1 });

      expect(result.assignments).toHaveLength(2);
      expect(new Set(result.assignments.map((a) => a.judgeId)).size).toBe(2);
      expect(
        validateAssignments([judge("j_1"), judge("j_2")], sameSlot, result.assignments).valid,
      ).toBe(true);
    });

    it("prefers matching expertise when workload is tied", () => {
      const pool = [
        judge("j_a", { expertiseTags: ["design"] }),
        judge("j_b", { expertiseTags: ["machine learning"] }),
      ];
      const mlProject = [project("p_1", { topicTags: ["machine learning"] })];

      const result = assignJudges(pool, mlProject, { judgesPerProject: 1 });
      expect(result.assignments[0].judgeId).toBe("j_b");
      expect(result.assignments[0].expertiseOverlap).toBe(1);
    });

    it("is deterministic across repeated runs", () => {
      const first = assignJudges(judges, projects, { judgesPerProject: 2 });
      const second = assignJudges(judges, projects, { judgesPerProject: 2 });
      expect(second.assignments).toEqual(first.assignments);
      expect(second.workload.perJudge).toEqual(first.workload.perJudge);
    });

    it("serves the scarcest project before the well-covered one", () => {
      // p_scarce has exactly one eligible judge; a naive left-to-right pass
      // would let p_open consume that judge first.
      const pool = [judge("j_1"), judge("j_2", { clubIds: ["club_a"] })];
      const bracket = [
        project("p_open", { slotId: "slot_1" }),
        project("p_scarce", { clubIds: ["club_a"], slotId: "slot_1" }),
      ];

      const result = assignJudges(pool, bracket, { judgesPerProject: 1 });
      const scarce = result.assignments.find((a) => a.projectId === "p_scarce");
      expect(scarce?.judgeId).toBe("j_1");
      expect(result.isFullyCovered).toBe(true);
    });

    it("respects an explicit per-judge ceiling", () => {
      const result = assignJudges(judges, projects, {
        judgesPerProject: 2,
        maxAssignmentsPerJudge: 1,
      });
      expect(Math.max(...Object.values(result.workload.perJudge))).toBeLessThanOrEqual(1);
    });
  });

  describe("coverage failures", () => {
    it("reports a project every judge is conflicted out of", () => {
      const pool = [judge("j_1", { clubIds: ["club_a"] }), judge("j_2", { clubIds: ["club_a"] })];
      const result = assignJudges(pool, [project("p_1", { clubIds: ["club_a"] })], {
        judgesPerProject: 2,
      });

      expect(result.isFullyCovered).toBe(false);
      expect(result.coverageGaps).toHaveLength(1);
      expect(result.coverageGaps[0].reason).toBe("NO_ELIGIBLE_JUDGES");
      expect(result.coverageGaps[0].assignedCount).toBe(0);
      expect(result.coverageGaps[0].detail).toContain("external judge");
    });

    it("reports an under-sized judge pool", () => {
      const result = assignJudges([judge("j_1"), judge("j_2")], [project("p_1")], {
        judgesPerProject: 5,
      });
      expect(result.coverageGaps[0].reason).toBe("INSUFFICIENT_JUDGE_POOL");
      expect(result.coverageGaps[0].assignedCount).toBe(2);
      expect(result.coverageGaps[0].requiredCount).toBe(5);
    });

    it("reports when the only eligible judge is already busy in that slot", () => {
      const result = assignJudges(
        [judge("j_1")],
        [project("p_1", { slotId: "slot_1" }), project("p_2", { slotId: "slot_1" })],
        { judgesPerProject: 1 },
      );

      expect(result.coverageGaps).toHaveLength(1);
      expect(result.coverageGaps[0].reason).toBe("SLOT_CAPACITY_EXHAUSTED");
      expect(result.coverageGaps[0].detail).toContain("slot_1");
    });

    it("leaves a project unjudged rather than assigning a conflicted judge", () => {
      const pool = [judge("j_1", { clubIds: ["club_a"] })];
      const projects = [project("p_1", { clubIds: ["club_a"] })];
      const result = assignJudges(pool, projects, { judgesPerProject: 1 });

      expect(result.assignments).toHaveLength(0);
      expect(validateAssignments(pool, projects, result.assignments).valid).toBe(true);
    });
  });

  describe("workload summary", () => {
    it("ignores judges nobody could have used", () => {
      const pool = [judge("j_1"), judge("j_blocked", { clubIds: ["club_a"] })];
      const projects = [project("p_1", { clubIds: ["club_a"] })];
      const eligibility = buildEligibilityMatrix(pool, projects);
      const result = assignJudges(pool, projects, { judgesPerProject: 1 });

      const summary = summariseWorkload(pool, result.assignments, eligibility);
      expect(summary.spread).toBe(0);
      expect(summary.perJudge.j_blocked).toBe(0);
    });
  });

  describe("validation guard", () => {
    it("rejects a hand-edited matrix that introduces a conflict", () => {
      const pool = [judge("j_1", { clubIds: ["club_a"] })];
      const projects = [project("p_1", { clubIds: ["club_a"] })];

      const outcome = validateAssignments(pool, projects, [
        { projectId: "p_1", judgeId: "j_1", slotId: "slot_1", expertiseOverlap: 0 },
      ]);

      expect(outcome.valid).toBe(false);
      expect(outcome.violations[0]).toContain("SAME_CLUB");
    });

    it("rejects a matrix that double-books a judge", () => {
      const pool = [judge("j_1")];
      const projects = [project("p_1", { slotId: "slot_1" }), project("p_2", { slotId: "slot_1" })];

      const outcome = validateAssignments(pool, projects, [
        { projectId: "p_1", judgeId: "j_1", slotId: "slot_1", expertiseOverlap: 0 },
        { projectId: "p_2", judgeId: "j_1", slotId: "slot_1", expertiseOverlap: 0 },
      ]);

      expect(outcome.valid).toBe(false);
      expect(outcome.violations.some((v) => v.includes("double-booked"))).toBe(true);
    });

    it("flags an assignment referencing an unknown judge", () => {
      const outcome = validateAssignments(
        [judge("j_1")],
        [project("p_1")],
        [{ projectId: "p_1", judgeId: "ghost", slotId: "slot_1", expertiseOverlap: 0 }],
      );
      expect(outcome.valid).toBe(false);
    });
  });
});
