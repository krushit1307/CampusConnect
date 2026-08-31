/**
 * Module: Locker Abandonment & Contents Disposal Notice Chain
 * File: src/services/lockerAbandonmentDisposalService.ts
 * Scope: Carries a storage assignment from expiry through grace, abandonment
 *        and a delivered notice to the point where its contents may lawfully be
 *        disposed of — and refuses to reach that point when the chain is
 *        incomplete (#4556).
 *
 * Term ends and nobody empties them. Facilities eventually runs a sweep, cuts
 * the locks, and bins whatever is inside. Once or twice a year that turns out
 * to have been somebody's laptop, and the university has no answer, because
 * there is no record that notice was ever given, when it was given, or whether
 * it reached anyone.
 *
 * The defensible version of this process is not complicated, but every part of
 * it that matters is the part that is currently missing. Three rules carry it:
 *
 * The hold period runs from delivery, never from the end of term. A notice sent
 * into a dead inbox on the last day of term has not started anything.
 *
 * Dispatch is not delivery. A bounced email is evidence that the renter was not
 * reached, and treating it as the first step of a countdown is how a laptop
 * ends up in a skip with a compliant-looking audit trail behind it.
 *
 * Where the chain cannot be completed, the outcome is manual review, never
 * disposal. Nothing in this module ever falls through to "dispose" by default.
 */

export type UnitType = "LOCKER" | "STORAGE_CAGE";

export type NoticeChannel = "EMAIL" | "SMS" | "POSTAL";

export type DeliveryState = "DISPATCHED" | "DELIVERED" | "FAILED";

export type AssignmentState =
  | "ACTIVE"
  | "IN_GRACE"
  | "ABANDONED"
  | "NOTICED"
  | "ON_HOLD"
  | "DISPOSABLE"
  | "MANUAL_REVIEW"
  | "DISPOSED";

export type AssessmentReason =
  | "ACTIVE"
  | "IN_GRACE"
  | "ABANDONED_NO_NOTICE"
  | "NOTICE_DISPATCHED_NOT_DELIVERED"
  | "HOLD_IN_PROGRESS"
  | "DISPOSABLE"
  | "MANUAL_REVIEW_HIGH_VALUE"
  | "MANUAL_REVIEW_CHANNELS_EXHAUSTED"
  | "DISPOSED";

export type DispatchOutcome =
  | "DISPATCHED"
  | "REFUSED_NOT_ABANDONED"
  | "REFUSED_CHANNEL_ALREADY_USED"
  | "REFUSED_PREVIOUS_CHANNEL_STILL_OPEN"
  | "REFUSED_ALREADY_DISPOSED";

export type DisposalOutcome = "DISPOSED" | "REFUSED_NOT_DISPOSABLE" | "REFUSED_ALREADY_DISPOSED";

/** Days after the end of term before the assignment is even a candidate. */
export const GRACE_DAYS = 14;

/** Days from the first confirmed delivery before contents may be disposed of. */
export const STANDARD_HOLD_DAYS = 30;

/** The same, where the contents were declared or found to be high value. */
export const HIGH_VALUE_HOLD_DAYS = 60;

/**
 * Escalation order. Each is tried only once the previous one has failed, so a
 * renter who reads their email is not also posted a letter.
 */
export const CHANNEL_ESCALATION: readonly NoticeChannel[] = ["EMAIL", "SMS", "POSTAL"];

const MS_PER_DAY = 86_400_000;

export interface StorageUnit {
  unitId: string;
  buildingId: string;
  unitType: UnitType;
  label: string;
}

export interface StorageAssignment {
  assignmentId: string;
  unitId: string;
  holderUserId: string;
  startsAt: Date;
  endsAt: Date;
  /** Declared by the renter when they took the unit. */
  declaredHighValue: boolean;
}

export interface AbandonmentNotice {
  noticeId: string;
  assignmentId: string;
  channel: NoticeChannel;
  dispatchedAt: Date;
  state: DeliveryState;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  /** Set when a renewal voided the chain this notice belonged to. */
  voidedAt: Date | null;
}

export interface InventoryRecord {
  assignmentId: string;
  takenAt: Date;
  takenBy: string;
  contentsSummary: string;
  highValueFound: boolean;
}

export interface DisposalRecord {
  assignmentId: string;
  disposedAt: Date;
  disposedBy: string;
  method: string;
  /** The delivery the hold period was counted from. Never null on a record. */
  noticeDeliveredAt: Date;
}

export interface DisposalAssessment {
  assignmentId: string;
  assessedAt: Date;
  state: AssignmentState;
  reason: AssessmentReason;
  graceEndsAt: Date;
  /** The first confirmed delivery in the live chain, which starts the hold. */
  holdStartedAt: Date | null;
  holdEndsAt: Date | null;
  holdDays: number;
  highValue: boolean;
  channelsExhausted: boolean;
  requiresManualReview: boolean;
  manualReviewApproved: boolean;
  disposable: boolean;
}

interface TrackedAssignment extends StorageAssignment {
  notices: AbandonmentNotice[];
  /** Notices voided by a renewal. Kept, because the fact they were sent is a fact. */
  voidedNotices: AbandonmentNotice[];
  inventories: InventoryRecord[];
  manualReviewApprovedAt: Date | null;
  disposal: DisposalRecord | null;
  renewals: { at: Date; newEndsAt: Date }[];
}

export class LockerAbandonmentDisposalService {
  private readonly units: Map<string, StorageUnit>;
  private readonly assignments: Map<string, TrackedAssignment>;
  private noticeSequence: number;

  constructor() {
    this.units = new Map();
    this.assignments = new Map();
    this.noticeSequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Units and assignments
  // ---------------------------------------------------------------------------

  public registerUnit(unit: StorageUnit): void {
    if (this.units.has(unit.unitId)) {
      throw new Error(`Storage unit ${unit.unitId} is already registered.`);
    }
    this.units.set(unit.unitId, { ...unit });
  }

  public assign(assignment: StorageAssignment): void {
    if (!this.units.has(assignment.unitId)) {
      throw new Error(`Unknown storage unit ${assignment.unitId}.`);
    }
    if (this.assignments.has(assignment.assignmentId)) {
      throw new Error(`Assignment ${assignment.assignmentId} already exists.`);
    }
    if (assignment.endsAt.getTime() <= assignment.startsAt.getTime()) {
      throw new Error(`Assignment ${assignment.assignmentId} must end after it starts.`);
    }

    this.assignments.set(assignment.assignmentId, {
      ...assignment,
      notices: [],
      voidedNotices: [],
      inventories: [],
      manualReviewApprovedAt: null,
      disposal: null,
      renewals: [],
    });
  }

  /**
   * Renewal cancels the whole chain.
   *
   * The notices are voided rather than deleted — they were sent, and that
   * remains true. What they cannot do is carry a half-elapsed hold period into
   * a later cycle. Somebody who renews in March and abandons the unit again in
   * June is entitled to a fresh notice, not to the remaining eleven days of a
   * countdown they already stopped once.
   */
  public renew(assignmentId: string, at: Date, newEndsAt: Date): void {
    const assignment = this.requireAssignment(assignmentId);
    if (assignment.disposal) {
      throw new Error(`Assignment ${assignmentId} was disposed of and cannot be renewed.`);
    }
    if (newEndsAt.getTime() <= assignment.endsAt.getTime()) {
      throw new Error(`A renewal of ${assignmentId} must extend the term.`);
    }

    for (const notice of assignment.notices) {
      assignment.voidedNotices.push({ ...notice, voidedAt: at });
    }
    assignment.notices = [];
    assignment.manualReviewApprovedAt = null;
    assignment.endsAt = newEndsAt;
    assignment.renewals.push({ at, newEndsAt });
  }

  // ---------------------------------------------------------------------------
  // The notice chain
  // ---------------------------------------------------------------------------

  /**
   * Sends a notice on one channel.
   *
   * Channels are used in order and only one at a time. The next is opened when
   * the previous one has failed, which is what makes escalation escalation
   * rather than a mailshot: a renter who reads their email is not also posted a
   * letter, and a channel still awaiting a delivery receipt is not yet evidence
   * of anything.
   */
  public dispatchNotice(
    assignmentId: string,
    channel: NoticeChannel,
    at: Date,
  ): { outcome: DispatchOutcome; noticeId: string | null } {
    const assignment = this.requireAssignment(assignmentId);

    if (assignment.disposal) {
      return { outcome: "REFUSED_ALREADY_DISPOSED", noticeId: null };
    }

    const assessment = this.assess(assignmentId, at);
    if (assessment.state === "ACTIVE" || assessment.state === "IN_GRACE") {
      return { outcome: "REFUSED_NOT_ABANDONED", noticeId: null };
    }

    if (assignment.notices.some((notice) => notice.channel === channel)) {
      return { outcome: "REFUSED_CHANNEL_ALREADY_USED", noticeId: null };
    }

    const openNotice = assignment.notices.find((notice) => notice.state !== "FAILED");
    if (openNotice) {
      return { outcome: "REFUSED_PREVIOUS_CHANNEL_STILL_OPEN", noticeId: null };
    }

    this.noticeSequence += 1;
    const noticeId = `NTC-${String(this.noticeSequence).padStart(6, "0")}`;
    assignment.notices.push({
      noticeId,
      assignmentId,
      channel,
      dispatchedAt: at,
      state: "DISPATCHED",
      deliveredAt: null,
      failedAt: null,
      failureReason: null,
      voidedAt: null,
    });

    return { outcome: "DISPATCHED", noticeId };
  }

  public markDelivered(assignmentId: string, noticeId: string, at: Date): void {
    const notice = this.requireNotice(assignmentId, noticeId);
    if (notice.state !== "DISPATCHED") {
      throw new Error(`Notice ${noticeId} is already ${notice.state.toLowerCase()}.`);
    }
    if (at.getTime() < notice.dispatchedAt.getTime()) {
      throw new Error(`Notice ${noticeId} cannot be delivered before it was sent.`);
    }
    notice.state = "DELIVERED";
    notice.deliveredAt = at;
  }

  public markFailed(assignmentId: string, noticeId: string, at: Date, reason: string): void {
    const notice = this.requireNotice(assignmentId, noticeId);
    if (notice.state !== "DISPATCHED") {
      throw new Error(`Notice ${noticeId} is already ${notice.state.toLowerCase()}.`);
    }
    notice.state = "FAILED";
    notice.failedAt = at;
    notice.failureReason = reason;
  }

  // ---------------------------------------------------------------------------
  // Inventory and review
  // ---------------------------------------------------------------------------

  /**
   * Contents found at inventory can raise an assignment to high value even
   * where nothing was declared. The renter who never filled in the form is
   * exactly the renter whose laptop is in there.
   */
  public recordInventory(record: InventoryRecord): void {
    const assignment = this.requireAssignment(record.assignmentId);
    if (assignment.disposal) {
      throw new Error(`Assignment ${record.assignmentId} was already disposed of.`);
    }
    assignment.inventories.push({ ...record });
  }

  public approveManualReview(assignmentId: string, at: Date): void {
    const assignment = this.requireAssignment(assignmentId);
    if (assignment.disposal) {
      throw new Error(`Assignment ${assignmentId} was already disposed of.`);
    }
    assignment.manualReviewApprovedAt = at;
  }

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------

  /**
   * Where one assignment stands, and whether its contents may lawfully go.
   *
   * Pure over the supplied instant, which is what makes "was this unit
   * disposable on the 14th?" answerable after the fact — the question somebody
   * asks precisely when the answer has become expensive.
   */
  public assess(assignmentId: string, assessedAt: Date): DisposalAssessment {
    const assignment = this.requireAssignment(assignmentId);
    const highValue = this.isHighValue(assignment, assessedAt);
    const graceEndsAt = new Date(assignment.endsAt.getTime() + GRACE_DAYS * MS_PER_DAY);
    const holdDays = highValue ? HIGH_VALUE_HOLD_DAYS : STANDARD_HOLD_DAYS;

    const base = {
      assignmentId,
      assessedAt,
      graceEndsAt,
      holdDays,
      highValue,
      manualReviewApproved: assignment.manualReviewApprovedAt !== null,
    };

    if (assignment.disposal) {
      return {
        ...base,
        state: "DISPOSED",
        reason: "DISPOSED",
        holdStartedAt: assignment.disposal.noticeDeliveredAt,
        holdEndsAt: null,
        channelsExhausted: false,
        requiresManualReview: false,
        disposable: false,
      };
    }

    if (assessedAt.getTime() < assignment.endsAt.getTime()) {
      return this.notYet(base, "ACTIVE", "ACTIVE");
    }
    if (assessedAt.getTime() < graceEndsAt.getTime()) {
      return this.notYet(base, "IN_GRACE", "IN_GRACE");
    }

    const notices = assignment.notices.filter(
      (notice) => notice.dispatchedAt.getTime() <= assessedAt.getTime(),
    );
    if (notices.length === 0) {
      return this.notYet(base, "ABANDONED", "ABANDONED_NO_NOTICE");
    }

    const delivered = notices
      .filter(
        (notice) =>
          notice.state === "DELIVERED" &&
          notice.deliveredAt !== null &&
          notice.deliveredAt.getTime() <= assessedAt.getTime(),
      )
      .sort((a, b) => a.deliveredAt!.getTime() - b.deliveredAt!.getTime());

    const channelsExhausted =
      delivered.length === 0 &&
      notices.length >= CHANNEL_ESCALATION.length &&
      notices.every((notice) => notice.state === "FAILED");

    if (delivered.length === 0) {
      if (channelsExhausted) {
        // Every channel tried and none reached them. This is the case the
        // feature exists for, and the answer is a human, not a skip.
        return {
          ...base,
          state: "MANUAL_REVIEW",
          reason: "MANUAL_REVIEW_CHANNELS_EXHAUSTED",
          holdStartedAt: null,
          holdEndsAt: null,
          channelsExhausted: true,
          requiresManualReview: true,
          disposable: base.manualReviewApproved,
        };
      }
      return {
        ...base,
        state: "NOTICED",
        reason: "NOTICE_DISPATCHED_NOT_DELIVERED",
        holdStartedAt: null,
        holdEndsAt: null,
        channelsExhausted: false,
        requiresManualReview: false,
        disposable: false,
      };
    }

    // The hold runs from the first confirmed delivery, not the last notice and
    // not the end of term.
    const holdStartedAt = delivered[0].deliveredAt!;
    const holdEndsAt = new Date(holdStartedAt.getTime() + holdDays * MS_PER_DAY);
    const holdElapsed = assessedAt.getTime() >= holdEndsAt.getTime();

    if (!holdElapsed) {
      return {
        ...base,
        state: "ON_HOLD",
        reason: "HOLD_IN_PROGRESS",
        holdStartedAt,
        holdEndsAt,
        channelsExhausted: false,
        requiresManualReview: highValue,
        disposable: false,
      };
    }

    if (highValue && !base.manualReviewApproved) {
      // High value gets the longer hold *and* a human, not one or the other.
      return {
        ...base,
        state: "MANUAL_REVIEW",
        reason: "MANUAL_REVIEW_HIGH_VALUE",
        holdStartedAt,
        holdEndsAt,
        channelsExhausted: false,
        requiresManualReview: true,
        disposable: false,
      };
    }

    return {
      ...base,
      state: "DISPOSABLE",
      reason: "DISPOSABLE",
      holdStartedAt,
      holdEndsAt,
      channelsExhausted: false,
      requiresManualReview: highValue,
      disposable: true,
    };
  }

  /** Everything in one building, most advanced first, for the sweep list. */
  public assessBuilding(buildingId: string, assessedAt: Date): DisposalAssessment[] {
    const rank: Record<AssignmentState, number> = {
      DISPOSABLE: 0,
      MANUAL_REVIEW: 1,
      ON_HOLD: 2,
      NOTICED: 3,
      ABANDONED: 4,
      IN_GRACE: 5,
      ACTIVE: 6,
      DISPOSED: 7,
    };
    return [...this.assignments.values()]
      .filter((assignment) => this.units.get(assignment.unitId)?.buildingId === buildingId)
      .map((assignment) => this.assess(assignment.assignmentId, assessedAt))
      .sort(
        (a, b) => rank[a.state] - rank[b.state] || a.assignmentId.localeCompare(b.assignmentId),
      );
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  /**
   * The only way contents leave, and it defers entirely to the assessment.
   *
   * There is deliberately no override parameter. An override is how the
   * requirement that notice be delivered becomes a checkbox somebody ticks at
   * the end of a long sweep.
   */
  public dispose(
    assignmentId: string,
    at: Date,
    disposedBy: string,
    method: string,
  ): { outcome: DisposalOutcome; reason: AssessmentReason } {
    const assignment = this.requireAssignment(assignmentId);
    if (assignment.disposal) {
      return { outcome: "REFUSED_ALREADY_DISPOSED", reason: "DISPOSED" };
    }

    const assessment = this.assess(assignmentId, at);
    if (!assessment.disposable || assessment.holdStartedAt === null) {
      return { outcome: "REFUSED_NOT_DISPOSABLE", reason: assessment.reason };
    }

    assignment.disposal = {
      assignmentId,
      disposedAt: at,
      disposedBy,
      method,
      noticeDeliveredAt: assessment.holdStartedAt,
    };
    return { outcome: "DISPOSED", reason: assessment.reason };
  }

  public disposalRecord(assignmentId: string): DisposalRecord | null {
    return this.requireAssignment(assignmentId).disposal;
  }

  public noticesFor(assignmentId: string): readonly AbandonmentNotice[] {
    return this.requireAssignment(assignmentId).notices;
  }

  public voidedNoticesFor(assignmentId: string): readonly AbandonmentNotice[] {
    return this.requireAssignment(assignmentId).voidedNotices;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private isHighValue(assignment: TrackedAssignment, at: Date): boolean {
    if (assignment.declaredHighValue) return true;
    return assignment.inventories.some(
      (record) => record.highValueFound && record.takenAt.getTime() <= at.getTime(),
    );
  }

  private notYet(
    base: Pick<
      DisposalAssessment,
      | "assignmentId"
      | "assessedAt"
      | "graceEndsAt"
      | "holdDays"
      | "highValue"
      | "manualReviewApproved"
    >,
    state: AssignmentState,
    reason: AssessmentReason,
  ): DisposalAssessment {
    return {
      ...base,
      state,
      reason,
      holdStartedAt: null,
      holdEndsAt: null,
      channelsExhausted: false,
      requiresManualReview: false,
      disposable: false,
    };
  }

  private requireAssignment(assignmentId: string): TrackedAssignment {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Unknown storage assignment ${assignmentId}.`);
    }
    return assignment;
  }

  private requireNotice(assignmentId: string, noticeId: string): AbandonmentNotice {
    const notice = this.requireAssignment(assignmentId).notices.find(
      (entry) => entry.noticeId === noticeId,
    );
    if (!notice) {
      throw new Error(`Unknown notice ${noticeId} on assignment ${assignmentId}.`);
    }
    return notice;
  }
}
