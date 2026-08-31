/**
 * Module: Subject Access Request Clock
 * File: src/services/subjectAccessRequestService.ts
 * Scope: Computes the statutory deadline from receipt with auditable
 *        suspensions and conditional extensions, tracks the search across
 *        record custodians, classifies each located item against per-item
 *        exemptions with a three-way third-party outcome, and carries the
 *        refusal path under the same clock (#5162).
 *
 * The clock starts on receipt, not on recognition. A request does not have to
 * say "subject access request", arrive at a particular address, or be addressed
 * to a particular person, so a request recognised eleven days late has eleven
 * days already gone. A system that starts counting at triage reports a deadline
 * that is wrong in the only direction that matters.
 *
 * The clock pauses for one reason. Where identity is genuinely in doubt the
 * period is suspended until identification is provided — and only for the
 * interval between asking and being answered. Suspending for an internal delay,
 * or forgetting to resume when the passport photograph arrives, both produce a
 * deadline nobody can defend. A suspension that is still open leaves no
 * deadline at all rather than a stale one, because there is not yet a date.
 *
 * An extension is conditional and has to be claimed in time. Complexity or a
 * high volume of requests permits a further two months, but the claim must be
 * made inside the original period and the ground recorded. An extension applied
 * retrospectively, or applied by default because the search is slow, is not an
 * extension, so a late claim is refused here rather than silently granted.
 *
 * Exemptions are per-item. Third-party data, legal privilege, a confidential
 * reference and crime-prevention material each exempt particular records rather
 * than the request. Withholding the whole file because one welfare note names
 * another student is over-redaction; releasing the file because most of it is
 * fine discloses somebody else's personal data. And the third-party question
 * has three answers, not two: disclose, redact the third party and disclose the
 * rest, or withhold. Redaction is usually the right one, and a binary
 * include/exclude decision never produces it.
 *
 * "Everything you hold" is not one system. The search spans custodians with
 * different systems, and the response is complete only when each has returned
 * items or explicitly recorded that it holds none. A response assembled from
 * whoever replied is a partial disclosure presented as a full one.
 */

export type RequestState =
  "RECEIVED" | "IDENTITY_PENDING" | "SEARCHING" | "READY_TO_RESPOND" | "RESPONDED" | "REFUSED";

export type ExtensionGround = "COMPLEXITY" | "VOLUME_OF_REQUESTS";

export type RefusalGround = "MANIFESTLY_UNFOUNDED" | "EXCESSIVE" | "REPEAT_REQUEST";

export type Exemption =
  | "THIRD_PARTY_DATA"
  | "LEGAL_PRIVILEGE"
  | "CONFIDENTIAL_REFERENCE"
  | "MANAGEMENT_PLANNING"
  | "CRIME_PREVENTION";

export type ItemOutcome = "DISCLOSE" | "REDACT_THIRD_PARTY" | "WITHHOLD";

export type SearchTaskState = "OPEN" | "ITEMS_RETURNED" | "NIL_RETURN";

export interface SubjectAccessRequest {
  requestId: string;
  subjectId: string;
  /** When the organisation received it, whoever opened it and whatever it was called. */
  receivedOn: Date;
  /** When somebody recognised it for what it was. Recorded, and deliberately not used. */
  recognisedOn: Date | null;
  channel: "EMAIL" | "POST" | "IN_PERSON" | "SOCIAL_MEDIA" | "FORM";
}

export interface IdentityCheck {
  checkId: string;
  requestId: string;
  requestedOn: Date;
  /** Null while the subject has not answered. The clock is paused until they do. */
  respondedOn: Date | null;
}

export interface ExtensionClaim {
  claimId: string;
  requestId: string;
  claimedOn: Date;
  ground: ExtensionGround;
  reason: string;
}

export interface SearchTask {
  taskId: string;
  requestId: string;
  custodian: string;
  state: SearchTaskState;
  completedOn: Date | null;
}

export interface LocatedItem {
  itemId: string;
  requestId: string;
  custodian: string;
  description: string;
  namesThirdParties: boolean;
  thirdPartyConsentObtained: boolean;
  /** Whether the third party can be taken out and the rest still make sense. */
  thirdPartySeverable: boolean;
  exemptions: Exemption[];
}

export interface ItemDecision {
  itemId: string;
  outcome: ItemOutcome;
  exemptionApplied: Exemption | null;
  reason: string;
}

export interface Refusal {
  requestId: string;
  refusedOn: Date;
  ground: RefusalGround;
  reason: string;
  complaintRightsGiven: boolean;
}

export interface RequestAssessment {
  requestId: string;
  state: RequestState;
  /** One calendar month from receipt, before any suspension or extension. */
  statutoryDeadline: Date;
  /** Null while a suspension is open: there is not yet a date, rather than a stale one. */
  effectiveDeadline: Date | null;
  suspended: boolean;
  suspensionDays: number;
  extensionGranted: boolean;
  extensionRefusedReason: string | null;
  daysRemaining: number | null;
  searchComplete: boolean;
  outstandingCustodians: string[];
  undecidedItemIds: string[];
  breached: boolean;
  breachReason: string | null;
}

export interface DisclosurePack {
  requestId: string;
  disclosed: ItemDecision[];
  redacted: ItemDecision[];
  withheld: ItemDecision[];
  complete: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calendar months, clamped at the end of the month. A request received on 31
 * January is due on 28 February, and rolling the overflow into 3 March hands
 * three days that were never there.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));

  return result;
}

/** Exemptions that take the item out entirely rather than inviting redaction. */
const ABSOLUTE_EXEMPTIONS: ReadonlySet<Exemption> = new Set<Exemption>([
  "LEGAL_PRIVILEGE",
  "CONFIDENTIAL_REFERENCE",
  "MANAGEMENT_PLANNING",
  "CRIME_PREVENTION",
]);

export class SubjectAccessRequestService {
  private readonly requests = new Map<string, SubjectAccessRequest>();
  private readonly identityChecks: IdentityCheck[] = [];
  private readonly extensionClaims: ExtensionClaim[] = [];
  private readonly refusedExtensions = new Map<string, string>();
  private readonly searchTasks: SearchTask[] = [];
  private readonly items: LocatedItem[] = [];
  private readonly decisions = new Map<string, ItemDecision>();
  private readonly refusals = new Map<string, Refusal>();
  private readonly responses = new Map<string, Date>();

  registerRequest(request: SubjectAccessRequest): void {
    this.requests.set(request.requestId, request);
  }

  private requireRequest(requestId: string): SubjectAccessRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Unknown subject access request ${requestId}`);
    return request;
  }

  requestIdentityVerification(check: IdentityCheck): void {
    const request = this.requireRequest(check.requestId);
    if (check.requestedOn.getTime() < request.receivedOn.getTime()) {
      throw new Error("Identity verification cannot be requested before the request arrived");
    }
    this.identityChecks.push(check);
  }

  recordIdentityResponse(checkId: string, respondedOn: Date): void {
    const check = this.identityChecks.find((item) => item.checkId === checkId);
    if (!check) throw new Error(`Unknown identity check ${checkId}`);
    check.respondedOn = respondedOn;
  }

  openSearchTask(task: SearchTask): void {
    this.searchTasks.push(task);
  }

  /**
   * A custodian holding nothing has to say so. Silence is not a nil return, and
   * a response assembled from whoever replied is a partial disclosure presented
   * as a full one.
   */
  recordSearchOutcome(
    taskId: string,
    state: "ITEMS_RETURNED" | "NIL_RETURN",
    completedOn: Date,
  ): void {
    const task = this.searchTasks.find((item) => item.taskId === taskId);
    if (!task) throw new Error(`Unknown search task ${taskId}`);
    task.state = state;
    task.completedOn = completedOn;
  }

  addLocatedItem(item: LocatedItem): void {
    this.items.push(item);
  }

  /**
   * One month from receipt. Recognition is recorded on the request and is not
   * consulted here, which is the point of recording it separately.
   */
  statutoryDeadline(requestId: string): Date {
    return addMonths(this.requireRequest(requestId).receivedOn, 1);
  }

  /**
   * Days the clock has been stopped, counting only the interval between asking
   * for identification and being given it. An open check contributes nothing
   * here — it is reported as a suspension in progress instead, because until it
   * is answered there is no deadline to state.
   */
  private completedSuspensionDays(requestId: string): number {
    return this.identityChecks
      .filter((check) => check.requestId === requestId && check.respondedOn)
      .reduce(
        (total, check) =>
          total +
          Math.ceil(
            ((check.respondedOn as Date).getTime() - check.requestedOn.getTime()) / MS_PER_DAY,
          ),
        0,
      );
  }

  private openIdentityCheck(requestId: string): IdentityCheck | null {
    return (
      this.identityChecks.find((check) => check.requestId === requestId && !check.respondedOn) ??
      null
    );
  }

  /**
   * An extension is granted only where it was claimed inside the period it
   * extends and a ground was recorded. Claimed afterwards it is not an
   * extension, and granting it silently is how a breach becomes invisible.
   */
  claimExtension(claim: ExtensionClaim): { granted: boolean; reason: string } {
    const base = this.statutoryDeadline(claim.requestId);
    const claimWindowEnd = new Date(
      base.getTime() + this.completedSuspensionDays(claim.requestId) * MS_PER_DAY,
    );

    if (claim.claimedOn.getTime() > claimWindowEnd.getTime()) {
      const reason = `Claimed on ${claim.claimedOn.toISOString().slice(0, 10)}, after the period it would extend ended on ${claimWindowEnd.toISOString().slice(0, 10)}`;
      this.refusedExtensions.set(claim.requestId, reason);
      return { granted: false, reason };
    }

    if (claim.reason.trim().length === 0) {
      const reason = "No ground was recorded for the extension";
      this.refusedExtensions.set(claim.requestId, reason);
      return { granted: false, reason };
    }

    this.extensionClaims.push(claim);
    return { granted: true, reason: `Extended on the ground of ${claim.ground}` };
  }

  private grantedExtension(requestId: string): ExtensionClaim | null {
    return this.extensionClaims.find((claim) => claim.requestId === requestId) ?? null;
  }

  refuse(refusal: Refusal): void {
    this.requireRequest(refusal.requestId);
    this.refusals.set(refusal.requestId, refusal);
  }

  respond(requestId: string, respondedOn: Date): void {
    this.requireRequest(requestId);
    this.responses.set(requestId, respondedOn);
  }

  /**
   * Three outcomes, because two of them cannot express the case that comes up
   * most: an item that is largely the subject's own record and names somebody
   * else in one line.
   */
  classifyItem(item: LocatedItem): ItemDecision {
    const absolute = item.exemptions.find((exemption) => ABSOLUTE_EXEMPTIONS.has(exemption));
    if (absolute) {
      return {
        itemId: item.itemId,
        outcome: "WITHHOLD",
        exemptionApplied: absolute,
        reason: `Exempt in full: ${absolute}`,
      };
    }

    if (item.namesThirdParties && !item.thirdPartyConsentObtained) {
      if (item.thirdPartySeverable) {
        return {
          itemId: item.itemId,
          outcome: "REDACT_THIRD_PARTY",
          exemptionApplied: "THIRD_PARTY_DATA",
          reason: "Third-party data redacted; the remainder is the subject's own",
        };
      }
      return {
        itemId: item.itemId,
        outcome: "WITHHOLD",
        exemptionApplied: "THIRD_PARTY_DATA",
        reason: "Third-party data cannot be severed without leaving the record unintelligible",
      };
    }

    return {
      itemId: item.itemId,
      outcome: "DISCLOSE",
      exemptionApplied: null,
      reason: item.thirdPartyConsentObtained
        ? "Third party has consented to disclosure"
        : "No exemption applies",
    };
  }

  /** Classify every located item that has not already been decided by hand. */
  decideOutstandingItems(requestId: string): ItemDecision[] {
    const decided: ItemDecision[] = [];
    for (const item of this.items.filter((candidate) => candidate.requestId === requestId)) {
      if (this.decisions.has(item.itemId)) continue;
      const decision = this.classifyItem(item);
      this.decisions.set(item.itemId, decision);
      decided.push(decision);
    }
    return decided;
  }

  recordItemDecision(decision: ItemDecision): void {
    this.decisions.set(decision.itemId, decision);
  }

  private stateOf(requestId: string): RequestState {
    if (this.refusals.has(requestId)) return "REFUSED";
    if (this.responses.has(requestId)) return "RESPONDED";
    if (this.openIdentityCheck(requestId)) return "IDENTITY_PENDING";

    const tasks = this.searchTasks.filter((task) => task.requestId === requestId);
    if (tasks.length === 0) return "RECEIVED";
    if (tasks.some((task) => task.state === "OPEN")) return "SEARCHING";

    const undecided = this.items.filter(
      (item) => item.requestId === requestId && !this.decisions.has(item.itemId),
    );
    return undecided.length === 0 ? "READY_TO_RESPOND" : "SEARCHING";
  }

  /**
   * The whole position as at a date, so a request can be reported on before it
   * is finished rather than only after it has gone wrong.
   */
  assess(requestId: string, asOf: Date): RequestAssessment {
    this.requireRequest(requestId);

    const statutoryDeadline = this.statutoryDeadline(requestId);
    const suspensionDays = this.completedSuspensionDays(requestId);
    const openCheck = this.openIdentityCheck(requestId);
    const extension = this.grantedExtension(requestId);

    let effectiveDeadline: Date | null = null;
    if (!openCheck) {
      const suspended = new Date(statutoryDeadline.getTime() + suspensionDays * MS_PER_DAY);
      effectiveDeadline = extension ? addMonths(suspended, 2) : suspended;
    }

    const tasks = this.searchTasks.filter((task) => task.requestId === requestId);
    const outstandingCustodians = tasks
      .filter((task) => task.state === "OPEN")
      .map((task) => task.custodian);
    const searchComplete = tasks.length > 0 && outstandingCustodians.length === 0;

    const undecidedItemIds = this.items
      .filter((item) => item.requestId === requestId && !this.decisions.has(item.itemId))
      .map((item) => item.itemId);

    const refusal = this.refusals.get(requestId);
    const respondedOn = this.responses.get(requestId);

    let breached = false;
    let breachReason: string | null = null;

    if (effectiveDeadline) {
      // A refusal is subject to the same deadline as a disclosure. Nothing was
      // disclosed and it is still late.
      const closedOn = refusal?.refusedOn ?? respondedOn ?? null;
      if (closedOn && closedOn.getTime() > effectiveDeadline.getTime()) {
        breached = true;
        breachReason = refusal
          ? `Refused on ${closedOn.toISOString().slice(0, 10)}, after the deadline of ${effectiveDeadline.toISOString().slice(0, 10)}`
          : `Responded on ${closedOn.toISOString().slice(0, 10)}, after the deadline of ${effectiveDeadline.toISOString().slice(0, 10)}`;
      } else if (!closedOn && asOf.getTime() > effectiveDeadline.getTime()) {
        breached = true;
        breachReason = `Outstanding on ${asOf.toISOString().slice(0, 10)}, after the deadline of ${effectiveDeadline.toISOString().slice(0, 10)}`;
      }
    }

    if (refusal && !refusal.complaintRightsGiven) {
      breached = true;
      breachReason = breachReason
        ? `${breachReason}; the refusal did not give complaint rights`
        : "The refusal did not give complaint rights";
    }

    return {
      requestId,
      state: this.stateOf(requestId),
      statutoryDeadline,
      effectiveDeadline,
      suspended: openCheck !== null,
      suspensionDays,
      extensionGranted: extension !== null,
      extensionRefusedReason: extension ? null : (this.refusedExtensions.get(requestId) ?? null),
      daysRemaining: effectiveDeadline
        ? Math.ceil((effectiveDeadline.getTime() - asOf.getTime()) / MS_PER_DAY)
        : null,
      searchComplete,
      outstandingCustodians,
      undecidedItemIds,
      breached,
      breachReason,
    };
  }

  /**
   * The pack, split the three ways the decisions were made. It is complete only
   * when every custodian has answered and every located item has been decided —
   * a pack that is neither is a partial disclosure presented as a full one.
   */
  disclosurePack(requestId: string): DisclosurePack {
    const decisions = this.items
      .filter((item) => item.requestId === requestId)
      .map((item) => this.decisions.get(item.itemId))
      .filter((decision): decision is ItemDecision => decision !== undefined);

    const tasks = this.searchTasks.filter((task) => task.requestId === requestId);
    const searchComplete = tasks.length > 0 && tasks.every((task) => task.state !== "OPEN");
    const everyItemDecided =
      decisions.length === this.items.filter((item) => item.requestId === requestId).length;

    return {
      requestId,
      disclosed: decisions.filter((decision) => decision.outcome === "DISCLOSE"),
      redacted: decisions.filter((decision) => decision.outcome === "REDACT_THIRD_PARTY"),
      withheld: decisions.filter((decision) => decision.outcome === "WITHHOLD"),
      complete: searchComplete && everyItemDecided,
    };
  }

  /**
   * Everything outstanding at a date, worst first. A request breached is more
   * urgent than one due next week, and one paused on an identity check that
   * nobody has chased is neither and needs seeing anyway.
   */
  overdueAndDue(asOf: Date): RequestAssessment[] {
    return [...this.requests.keys()]
      .map((requestId) => this.assess(requestId, asOf))
      .filter(
        (assessment) =>
          assessment.state !== "RESPONDED" &&
          assessment.state !== "REFUSED" &&
          (assessment.breached || assessment.suspended || (assessment.daysRemaining ?? 0) <= 14),
      )
      .sort((a, b) => {
        if (a.breached !== b.breached) return a.breached ? -1 : 1;
        if (a.daysRemaining === null) return 1;
        if (b.daysRemaining === null) return -1;
        return a.daysRemaining - b.daysRemaining;
      });
  }
}
