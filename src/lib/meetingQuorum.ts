/**
 * Club meeting quorum and proxy delegation engine.
 *
 * A club constitution usually expresses quorum as "half the voting membership
 * plus one" or "two thirds of members present". Two details make that harder to
 * compute than it first looks:
 *
 *  - not every member carries the same weight. Most constitutions give the
 *    executive committee a heavier vote than associate members, so quorum has
 *    to be measured in voting power rather than in bodies in the room.
 *  - members who cannot attend hand their vote to someone who can. Those
 *    proxies chain (A gives to B, B gives to C) and the chain has to be walked
 *    before the room's real voting power is known.
 *
 * Everything here is pure. No Supabase, no React. The same functions run in the
 * live quorum panel and in the tests, so what a secretary sees on screen is the
 * number that ends up in the minutes.
 */

/** How the constitution expresses the threshold for a valid meeting. */
export type QuorumRuleType = "simple_majority" | "percentage" | "fixed_count";

/** Membership tiers, ordered from the heaviest vote to the lightest. */
export type MembershipTier = "executive" | "core" | "general" | "associate";

/** What the secretary recorded against a member for this meeting. */
export type AttendanceStatus = "present" | "absent" | "excused";

/** Why a delegation did not make it into the final tally. */
export type ProxyRejectionReason =
  | "self_delegation"
  | "unknown_delegator"
  | "unknown_delegate"
  | "delegator_ineligible"
  | "delegate_ineligible"
  | "duplicate_delegation"
  | "delegator_attended"
  | "revoked"
  | "cycle_detected"
  | "chain_too_deep"
  | "delegate_absent"
  | "delegate_cap_exceeded";

export interface MeetingMember {
  userId: string;
  tier: MembershipTier;
  /** Members on probation or in arrears keep their seat but lose their vote. */
  eligibleToVote: boolean;
  /** Overrides the tier weight when a club has bespoke bylaws. */
  weightOverride?: number;
}

export interface ProxyDelegation {
  delegatorId: string;
  delegateId: string;
  /** A delegator may withdraw their proxy up until the meeting opens. */
  revoked?: boolean;
}

export interface QuorumPolicy {
  rule: QuorumRuleType;
  /**
   * Percentage of total voting power for `percentage`, or an absolute amount of
   * voting power for `fixed_count`. Ignored for `simple_majority`.
   */
  threshold?: number;
  /** How many delegators one person may ultimately vote for. */
  maxProxiesPerDelegate: number;
  /** Longest delegation chain that will be walked before it is abandoned. */
  maxChainDepth: number;
  /** Whether formally excused members still count towards the denominator. */
  countExcusedInBase: boolean;
  /** Per-tier weights, defaulting to {@link DEFAULT_TIER_WEIGHTS}. */
  tierWeights?: Partial<Record<MembershipTier, number>>;
}

export interface ResolvedProxy {
  delegatorId: string;
  /** The person who ends up casting the vote after the chain is walked. */
  delegateId: string;
  /** Number of hops between delegator and final delegate. */
  chainLength: number;
  weight: number;
}

export interface RejectedProxy {
  delegatorId: string;
  delegateId: string;
  reason: ProxyRejectionReason;
  detail: string;
}

export interface ProxyResolution {
  accepted: ResolvedProxy[];
  rejected: RejectedProxy[];
}

export interface DelegateBreakdown {
  delegateId: string;
  ownWeight: number;
  proxyWeight: number;
  proxyCount: number;
  totalWeight: number;
}

export interface QuorumReport {
  /** Voting power of every member who counts towards the denominator. */
  basePower: number;
  /** Voting power that must be in the room for the meeting to be valid. */
  requiredPower: number;
  /** Power contributed by members physically present. */
  presentPower: number;
  /** Power contributed by accepted proxies. */
  proxyPower: number;
  /** presentPower + proxyPower. */
  effectivePower: number;
  met: boolean;
  /** How much more power is needed. Zero once quorum is met. */
  shortfall: number;
  presentCount: number;
  eligibleCount: number;
  breakdown: DelegateBreakdown[];
  proxies: ProxyResolution;
}

/** Voting weight attached to each membership tier by default. */
export const DEFAULT_TIER_WEIGHTS: Record<MembershipTier, number> = {
  executive: 3,
  core: 2,
  general: 1,
  associate: 1,
};

/** Chain depth used when a policy does not specify one. */
export const DEFAULT_MAX_CHAIN_DEPTH = 3;

/** Proxies one delegate may carry when a policy does not specify a cap. */
export const DEFAULT_MAX_PROXIES_PER_DELEGATE = 2;

/**
 * Voting weight of a single member. Ineligible members are worth nothing, which
 * keeps them out of both sides of the quorum fraction.
 */
export function votingWeight(member: MeetingMember, policy: QuorumPolicy): number {
  if (!member.eligibleToVote) return 0;
  if (typeof member.weightOverride === "number" && member.weightOverride >= 0) {
    return member.weightOverride;
  }
  const weights = { ...DEFAULT_TIER_WEIGHTS, ...(policy.tierWeights ?? {}) };
  return weights[member.tier] ?? DEFAULT_TIER_WEIGHTS.general;
}

/**
 * Total voting power the quorum threshold is measured against. Excused members
 * are dropped from the denominator when the club's bylaws allow it, which is
 * how a meeting can still be quorate during exam season.
 */
export function calculateBasePower(
  members: MeetingMember[],
  attendance: Map<string, AttendanceStatus>,
  policy: QuorumPolicy,
): number {
  return members.reduce((total, member) => {
    if (!policy.countExcusedInBase && attendance.get(member.userId) === "excused") {
      return total;
    }
    return total + votingWeight(member, policy);
  }, 0);
}

/**
 * Voting power required for the meeting to be quorate.
 *
 * `simple_majority` is strictly more than half, so a base of 10 needs 6 and a
 * base of 11 needs 6 as well. Percentage thresholds round up, because a club
 * asking for two thirds of 10 wants 7 rather than 6.
 */
export function calculateRequiredPower(basePower: number, policy: QuorumPolicy): number {
  if (basePower <= 0) return 0;

  switch (policy.rule) {
    case "simple_majority":
      return Math.floor(basePower / 2) + 1;
    case "percentage": {
      const pct = clampPercentage(policy.threshold ?? 50);
      return Math.min(basePower, Math.ceil((basePower * pct) / 100));
    }
    case "fixed_count": {
      const fixed = Math.max(0, Math.floor(policy.threshold ?? 0));
      return Math.min(basePower, fixed);
    }
    default:
      return basePower;
  }
}

/**
 * Walks every delegation to the person who will actually cast the vote.
 *
 * The rules applied here are the ones clubs argue about after the fact:
 * a delegator who turns up votes for themselves, a chain that loops is void,
 * a chain that ends on someone who did not attend is forfeit in its entirety,
 * and nobody may carry more proxies than the policy allows.
 */
export function resolveProxies(
  members: MeetingMember[],
  attendance: Map<string, AttendanceStatus>,
  delegations: ProxyDelegation[],
  policy: QuorumPolicy,
): ProxyResolution {
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const accepted: ResolvedProxy[] = [];
  const rejected: RejectedProxy[] = [];

  const maxDepth = Math.max(1, policy.maxChainDepth || DEFAULT_MAX_CHAIN_DEPTH);
  const maxProxies = Math.max(0, policy.maxProxiesPerDelegate ?? DEFAULT_MAX_PROXIES_PER_DELEGATE);

  // Pass one: structural validation, and a lookup of who delegated to whom.
  const chain = new Map<string, string>();
  const seenDelegators = new Set<string>();

  for (const delegation of sortDelegations(delegations)) {
    const { delegatorId, delegateId } = delegation;
    const reject = (reason: ProxyRejectionReason, detail: string) =>
      rejected.push({ delegatorId, delegateId, reason, detail });

    if (delegation.revoked) {
      reject("revoked", "The delegator withdrew this proxy before the meeting opened.");
      continue;
    }
    if (delegatorId === delegateId) {
      reject("self_delegation", "A member cannot hold their own proxy.");
      continue;
    }
    if (seenDelegators.has(delegatorId)) {
      reject("duplicate_delegation", "This member had already delegated their vote.");
      continue;
    }

    const delegator = memberById.get(delegatorId);
    const delegate = memberById.get(delegateId);
    if (!delegator) {
      reject("unknown_delegator", "The delegator is not on this club's membership roll.");
      continue;
    }
    if (!delegate) {
      reject("unknown_delegate", "The delegate is not on this club's membership roll.");
      continue;
    }
    if (!delegator.eligibleToVote) {
      reject("delegator_ineligible", "The delegator holds no vote to give away.");
      continue;
    }
    if (!delegate.eligibleToVote) {
      reject("delegate_ineligible", "The delegate is not entitled to vote at this meeting.");
      continue;
    }
    if (attendance.get(delegatorId) === "present") {
      reject("delegator_attended", "The delegator attended and votes in person.");
      continue;
    }

    seenDelegators.add(delegatorId);
    chain.set(delegatorId, delegateId);
  }

  // Pass two: follow each chain to a delegate who is actually in the room.
  const pending: ResolvedProxy[] = [];

  for (const [delegatorId, firstDelegateId] of chain) {
    const visited = new Set<string>([delegatorId]);
    let current = firstDelegateId;
    let hops = 1;
    let outcome: ProxyRejectionReason | null = null;

    while (chain.has(current)) {
      if (visited.has(current)) {
        outcome = "cycle_detected";
        break;
      }
      if (hops >= maxDepth) {
        outcome = "chain_too_deep";
        break;
      }
      visited.add(current);
      current = chain.get(current)!;
      hops += 1;
    }

    if (!outcome && visited.has(current)) outcome = "cycle_detected";
    if (!outcome && attendance.get(current) !== "present") outcome = "delegate_absent";

    if (outcome) {
      rejected.push({
        delegatorId,
        delegateId: firstDelegateId,
        reason: outcome,
        detail: describeChainFailure(outcome, maxDepth),
      });
      continue;
    }

    pending.push({
      delegatorId,
      delegateId: current,
      chainLength: hops,
      weight: votingWeight(memberById.get(delegatorId)!, policy),
    });
  }

  // Pass three: apply the per-delegate cap. Sorting first keeps the outcome
  // stable so two people looking at the same meeting see the same result.
  const carried = new Map<string, number>();

  for (const proxy of [...pending].sort(compareResolved)) {
    const held = carried.get(proxy.delegateId) ?? 0;
    if (held >= maxProxies) {
      rejected.push({
        delegatorId: proxy.delegatorId,
        delegateId: proxy.delegateId,
        reason: "delegate_cap_exceeded",
        detail: `A delegate may carry at most ${maxProxies} ${
          maxProxies === 1 ? "proxy" : "proxies"
        } at this meeting.`,
      });
      continue;
    }
    carried.set(proxy.delegateId, held + 1);
    accepted.push(proxy);
  }

  return { accepted, rejected };
}

/**
 * Full quorum picture for a meeting: what is required, what is in the room, and
 * where each unit of voting power came from.
 */
export function computeQuorum(
  members: MeetingMember[],
  attendanceRecords: Array<{ userId: string; status: AttendanceStatus }>,
  delegations: ProxyDelegation[],
  policy: QuorumPolicy,
): QuorumReport {
  const attendance = new Map(attendanceRecords.map((record) => [record.userId, record.status]));

  const basePower = calculateBasePower(members, attendance, policy);
  const requiredPower = calculateRequiredPower(basePower, policy);
  const proxies = resolveProxies(members, attendance, delegations, policy);

  const proxyByDelegate = new Map<string, ResolvedProxy[]>();
  for (const proxy of proxies.accepted) {
    const bucket = proxyByDelegate.get(proxy.delegateId) ?? [];
    bucket.push(proxy);
    proxyByDelegate.set(proxy.delegateId, bucket);
  }

  const breakdown: DelegateBreakdown[] = [];
  let presentPower = 0;
  let presentCount = 0;
  let eligibleCount = 0;

  for (const member of members) {
    if (member.eligibleToVote) eligibleCount += 1;
    if (attendance.get(member.userId) !== "present") continue;

    const ownWeight = votingWeight(member, policy);
    const held = proxyByDelegate.get(member.userId) ?? [];
    const proxyWeight = held.reduce((total, proxy) => total + proxy.weight, 0);

    presentPower += ownWeight;
    presentCount += 1;

    breakdown.push({
      delegateId: member.userId,
      ownWeight,
      proxyWeight,
      proxyCount: held.length,
      totalWeight: ownWeight + proxyWeight,
    });
  }

  const proxyPower = proxies.accepted.reduce((total, proxy) => total + proxy.weight, 0);
  const effectivePower = presentPower + proxyPower;

  return {
    basePower,
    requiredPower,
    presentPower,
    proxyPower,
    effectivePower,
    met: basePower > 0 && effectivePower >= requiredPower,
    shortfall: Math.max(0, requiredPower - effectivePower),
    presentCount,
    eligibleCount,
    breakdown: breakdown.sort((a, b) => b.totalWeight - a.totalWeight),
    proxies,
  };
}

/**
 * One-line summary for the meeting header, e.g. "Quorate — 14 of 12 required".
 */
export function describeQuorum(report: QuorumReport): string {
  if (report.basePower === 0) return "No eligible voting members on the roll";
  if (report.met) {
    return `Quorate — ${report.effectivePower} of ${report.requiredPower} required`;
  }
  const unit = report.shortfall === 1 ? "vote" : "votes";
  return `Not quorate — ${report.shortfall} more ${unit} needed`;
}

/**
 * Groups rejected proxies by reason so the secretary can act on them rather
 * than scrolling a flat list of failures.
 */
export function summariseRejections(
  resolution: ProxyResolution,
): Array<{ reason: ProxyRejectionReason; count: number; detail: string }> {
  const grouped = new Map<ProxyRejectionReason, { count: number; detail: string }>();

  for (const rejection of resolution.rejected) {
    const existing = grouped.get(rejection.reason);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(rejection.reason, { count: 1, detail: rejection.detail });
    }
  }

  return [...grouped.entries()]
    .map(([reason, value]) => ({ reason, ...value }))
    .sort((a, b) => b.count - a.count);
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

function sortDelegations(delegations: ProxyDelegation[]): ProxyDelegation[] {
  return [...delegations].sort((a, b) => {
    if (a.delegatorId !== b.delegatorId) return a.delegatorId < b.delegatorId ? -1 : 1;
    return a.delegateId < b.delegateId ? -1 : 1;
  });
}

function compareResolved(a: ResolvedProxy, b: ResolvedProxy): number {
  if (a.delegateId !== b.delegateId) return a.delegateId < b.delegateId ? -1 : 1;
  if (a.chainLength !== b.chainLength) return a.chainLength - b.chainLength;
  return a.delegatorId < b.delegatorId ? -1 : 1;
}

function describeChainFailure(reason: ProxyRejectionReason, maxDepth: number): string {
  switch (reason) {
    case "cycle_detected":
      return "The delegation loops back on itself and cannot be resolved.";
    case "chain_too_deep":
      return `The delegation chain is longer than the ${maxDepth} hop limit.`;
    case "delegate_absent":
      return "The delegate did not attend, so the proxy is forfeit.";
    default:
      return "The delegation could not be resolved.";
  }
}
