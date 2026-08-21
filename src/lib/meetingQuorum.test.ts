import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER_WEIGHTS,
  calculateBasePower,
  calculateRequiredPower,
  computeQuorum,
  describeQuorum,
  resolveProxies,
  summariseRejections,
  votingWeight,
  type AttendanceStatus,
  type MeetingMember,
  type ProxyDelegation,
  type QuorumPolicy,
} from "./meetingQuorum";

const policy: QuorumPolicy = {
  rule: "simple_majority",
  maxProxiesPerDelegate: 2,
  maxChainDepth: 3,
  countExcusedInBase: true,
};

function member(
  userId: string,
  tier: MeetingMember["tier"] = "general",
  eligibleToVote = true,
): MeetingMember {
  return { userId, tier, eligibleToVote };
}

function attendanceMap(entries: Record<string, AttendanceStatus>): Map<string, AttendanceStatus> {
  return new Map(Object.entries(entries));
}

describe("meeting quorum engine", () => {
  describe("voting weight", () => {
    it("uses the tier weight by default", () => {
      expect(votingWeight(member("a", "executive"), policy)).toBe(DEFAULT_TIER_WEIGHTS.executive);
      expect(votingWeight(member("b", "associate"), policy)).toBe(DEFAULT_TIER_WEIGHTS.associate);
    });

    it("gives ineligible members no weight regardless of tier", () => {
      expect(votingWeight(member("a", "executive", false), policy)).toBe(0);
    });

    it("prefers an explicit override over the tier weight", () => {
      expect(votingWeight({ ...member("a", "general"), weightOverride: 5 }, policy)).toBe(5);
    });

    it("honours club specific tier weights from the policy", () => {
      const bespoke: QuorumPolicy = { ...policy, tierWeights: { executive: 10 } };
      expect(votingWeight(member("a", "executive"), bespoke)).toBe(10);
      expect(votingWeight(member("b", "general"), bespoke)).toBe(1);
    });
  });

  describe("base power", () => {
    const roll = [
      member("a"),
      member("b"),
      member("c", "executive"),
      member("d", "general", false),
    ];

    it("sums the weight of every eligible member", () => {
      expect(calculateBasePower(roll, attendanceMap({}), policy)).toBe(1 + 1 + 3 + 0);
    });

    it("drops excused members when the bylaws allow it", () => {
      const lenient: QuorumPolicy = { ...policy, countExcusedInBase: false };
      const attendance = attendanceMap({ c: "excused" });
      expect(calculateBasePower(roll, attendance, lenient)).toBe(2);
    });

    it("keeps excused members in the denominator when the bylaws are strict", () => {
      const attendance = attendanceMap({ c: "excused" });
      expect(calculateBasePower(roll, attendance, policy)).toBe(5);
    });
  });

  describe("required power", () => {
    it("treats a simple majority as strictly more than half", () => {
      expect(calculateRequiredPower(10, policy)).toBe(6);
      expect(calculateRequiredPower(11, policy)).toBe(6);
      expect(calculateRequiredPower(1, policy)).toBe(1);
    });

    it("rounds percentage thresholds up", () => {
      const twoThirds: QuorumPolicy = { ...policy, rule: "percentage", threshold: 66 };
      expect(calculateRequiredPower(10, twoThirds)).toBe(7);
      expect(calculateRequiredPower(9, twoThirds)).toBe(6);
    });

    it("never demands more power than the club actually has", () => {
      const impossible: QuorumPolicy = { ...policy, rule: "fixed_count", threshold: 40 };
      expect(calculateRequiredPower(12, impossible)).toBe(12);
    });

    it("returns zero when nobody on the roll can vote", () => {
      expect(calculateRequiredPower(0, policy)).toBe(0);
    });
  });

  describe("proxy resolution", () => {
    const roll = [member("a"), member("b"), member("c"), member("d")];

    it("accepts a straightforward proxy to someone in the room", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ a: "absent", b: "present" }),
        [{ delegatorId: "a", delegateId: "b" }],
        policy,
      );
      expect(result.rejected).toHaveLength(0);
      expect(result.accepted).toEqual([
        { delegatorId: "a", delegateId: "b", chainLength: 1, weight: 1 },
      ]);
    });

    it("follows a chain to the person who actually attended", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ a: "absent", b: "absent", c: "present" }),
        [
          { delegatorId: "a", delegateId: "b" },
          { delegatorId: "b", delegateId: "c" },
        ],
        policy,
      );
      expect(result.rejected).toHaveLength(0);
      // Shorter chains are resolved first so the ordering is stable.
      expect(result.accepted.map((p) => [p.delegatorId, p.delegateId, p.chainLength])).toEqual([
        ["b", "c", 1],
        ["a", "c", 2],
      ]);
    });

    it("rejects a delegation that loops back on itself", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ a: "absent", b: "absent" }),
        [
          { delegatorId: "a", delegateId: "b" },
          { delegatorId: "b", delegateId: "a" },
        ],
        policy,
      );
      expect(result.accepted).toHaveLength(0);
      expect(result.rejected.map((r) => r.reason)).toEqual(["cycle_detected", "cycle_detected"]);
    });

    it("rejects a chain longer than the policy allows", () => {
      const deep = [member("a"), member("b"), member("c"), member("d"), member("e")];
      const result = resolveProxies(
        deep,
        attendanceMap({ e: "present" }),
        [
          { delegatorId: "a", delegateId: "b" },
          { delegatorId: "b", delegateId: "c" },
          { delegatorId: "c", delegateId: "d" },
          { delegatorId: "d", delegateId: "e" },
        ],
        { ...policy, maxChainDepth: 2, maxProxiesPerDelegate: 10 },
      );
      expect(result.rejected.map((r) => r.reason)).toContain("chain_too_deep");
      expect(result.accepted.map((p) => p.delegatorId).sort()).toEqual(["c", "d"]);
    });

    it("forfeits the proxy when the delegate never turned up", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ a: "absent", b: "absent" }),
        [{ delegatorId: "a", delegateId: "b" }],
        policy,
      );
      expect(result.accepted).toHaveLength(0);
      expect(result.rejected[0].reason).toBe("delegate_absent");
    });

    it("ignores the proxy when the delegator attends after all", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ a: "present", b: "present" }),
        [{ delegatorId: "a", delegateId: "b" }],
        policy,
      );
      expect(result.rejected[0].reason).toBe("delegator_attended");
    });

    it("rejects self delegation, revoked proxies and unknown members", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ b: "present" }),
        [
          { delegatorId: "a", delegateId: "a" },
          { delegatorId: "c", delegateId: "b", revoked: true },
          { delegatorId: "zz", delegateId: "b" },
          { delegatorId: "d", delegateId: "yy" },
        ],
        policy,
      );
      expect(result.accepted).toHaveLength(0);
      expect(result.rejected.map((r) => r.reason).sort()).toEqual([
        "revoked",
        "self_delegation",
        "unknown_delegate",
        "unknown_delegator",
      ]);
    });

    it("keeps only the first delegation when a member delegates twice", () => {
      const result = resolveProxies(
        roll,
        attendanceMap({ b: "present", c: "present" }),
        [
          { delegatorId: "a", delegateId: "b" },
          { delegatorId: "a", delegateId: "c" },
        ],
        policy,
      );
      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].delegateId).toBe("b");
      expect(result.rejected[0].reason).toBe("duplicate_delegation");
    });

    it("refuses to let one delegate exceed the proxy cap", () => {
      const roster = [member("a"), member("b"), member("c"), member("d")];
      const result = resolveProxies(
        roster,
        attendanceMap({ d: "present" }),
        [
          { delegatorId: "a", delegateId: "d" },
          { delegatorId: "b", delegateId: "d" },
          { delegatorId: "c", delegateId: "d" },
        ],
        { ...policy, maxProxiesPerDelegate: 2 },
      );
      expect(result.accepted).toHaveLength(2);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toBe("delegate_cap_exceeded");
      expect(result.rejected[0].detail).toContain("2 proxies");
    });

    it("will not let a member without a vote hand one over", () => {
      const roster = [member("a", "general", false), member("b")];
      const result = resolveProxies(
        roster,
        attendanceMap({ b: "present" }),
        [{ delegatorId: "a", delegateId: "b" }],
        policy,
      );
      expect(result.rejected[0].reason).toBe("delegator_ineligible");
    });
  });

  describe("quorum report", () => {
    const roll = [
      member("chair", "executive"),
      member("treasurer", "executive"),
      member("sec", "core"),
      member("m1"),
      member("m2"),
      member("m3"),
    ];

    it("declares the meeting quorate once enough power is in the room", () => {
      const report = computeQuorum(
        roll,
        [
          { userId: "chair", status: "present" },
          { userId: "treasurer", status: "present" },
          { userId: "sec", status: "present" },
          { userId: "m1", status: "present" },
          { userId: "m2", status: "absent" },
          { userId: "m3", status: "absent" },
        ],
        [],
        policy,
      );

      // 3 + 3 + 2 + 1 + 1 + 1 = 11 total, majority is 6, present power is 9.
      expect(report.basePower).toBe(11);
      expect(report.requiredPower).toBe(6);
      expect(report.presentPower).toBe(9);
      expect(report.met).toBe(true);
      expect(report.shortfall).toBe(0);
    });

    it("counts proxy power towards quorum and reports where it came from", () => {
      const report = computeQuorum(
        roll,
        [
          { userId: "chair", status: "present" },
          { userId: "m1", status: "absent" },
          { userId: "m2", status: "absent" },
        ],
        [
          { delegatorId: "m1", delegateId: "chair" },
          { delegatorId: "m2", delegateId: "chair" },
        ],
        policy,
      );

      expect(report.presentPower).toBe(3);
      expect(report.proxyPower).toBe(2);
      expect(report.effectivePower).toBe(5);
      expect(report.breakdown[0]).toEqual({
        delegateId: "chair",
        ownWeight: 3,
        proxyWeight: 2,
        proxyCount: 2,
        totalWeight: 5,
      });
    });

    it("reports the shortfall when the room is short of quorum", () => {
      const report = computeQuorum(roll, [{ userId: "sec", status: "present" }], [], policy);
      expect(report.met).toBe(false);
      expect(report.shortfall).toBe(4);
      expect(describeQuorum(report)).toBe("Not quorate — 4 more votes needed");
    });

    it("is never quorate when no eligible member exists", () => {
      const roster = [member("a", "general", false)];
      const report = computeQuorum(roster, [{ userId: "a", status: "present" }], [], policy);
      expect(report.basePower).toBe(0);
      expect(report.met).toBe(false);
      expect(describeQuorum(report)).toBe("No eligible voting members on the roll");
    });

    it("orders the breakdown by the power each attendee controls", () => {
      const report = computeQuorum(
        roll,
        [
          { userId: "chair", status: "present" },
          { userId: "sec", status: "present" },
          { userId: "m1", status: "present" },
          { userId: "m2", status: "absent" },
          { userId: "m3", status: "absent" },
        ],
        [
          { delegatorId: "m2", delegateId: "m1" },
          { delegatorId: "m3", delegateId: "m1" },
        ],
        policy,
      );
      // m1 carries two proxies, which lifts a general member level with the chair.
      expect(report.breakdown.map((row) => row.totalWeight)).toEqual([3, 3, 2]);
      expect(report.breakdown.map((row) => row.delegateId)).toEqual(["chair", "m1", "sec"]);
      expect(report.presentCount).toBe(3);
      expect(report.eligibleCount).toBe(6);
    });

    it("summarises rejections by reason for the secretary", () => {
      const report = computeQuorum(
        roll,
        [{ userId: "chair", status: "present" }],
        [
          { delegatorId: "m1", delegateId: "m2" },
          { delegatorId: "m3", delegateId: "sec" },
          { delegatorId: "sec", delegateId: "sec" },
        ],
        policy,
      );
      const summary = summariseRejections(report.proxies);
      expect(summary[0]).toMatchObject({ reason: "delegate_absent", count: 2 });
      expect(summary.map((row) => row.reason)).toContain("self_delegation");
    });

    it("describes a quorate meeting with the achieved and required figures", () => {
      const report = computeQuorum(
        roll,
        roll.map((m) => ({ userId: m.userId, status: "present" as AttendanceStatus })),
        [],
        policy,
      );
      expect(describeQuorum(report)).toBe("Quorate — 11 of 6 required");
    });
  });

  describe("policy variations", () => {
    const roll = [member("a"), member("b"), member("c"), member("d")];
    const present: Array<{ userId: string; status: AttendanceStatus }> = [
      { userId: "a", status: "present" },
      { userId: "b", status: "present" },
      { userId: "c", status: "absent" },
      { userId: "d", status: "absent" },
    ];

    it("applies a fixed count rule verbatim", () => {
      const report = computeQuorum(roll, present, [], {
        ...policy,
        rule: "fixed_count",
        threshold: 2,
      });
      expect(report.requiredPower).toBe(2);
      expect(report.met).toBe(true);
    });

    it("applies a percentage rule against the eligible base", () => {
      const report = computeQuorum(roll, present, [], {
        ...policy,
        rule: "percentage",
        threshold: 75,
      });
      expect(report.requiredPower).toBe(3);
      expect(report.met).toBe(false);
    });

    it("lets a proxy tip a percentage meeting over the line", () => {
      const delegations: ProxyDelegation[] = [{ delegatorId: "c", delegateId: "a" }];
      const report = computeQuorum(roll, present, delegations, {
        ...policy,
        rule: "percentage",
        threshold: 75,
      });
      expect(report.effectivePower).toBe(3);
      expect(report.met).toBe(true);
    });
  });
});
