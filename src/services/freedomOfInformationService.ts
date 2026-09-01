/**
 * Module: Freedom of Information Request Handling
 * File: src/services/freedomOfInformationService.ts
 * Scope: Runs the deadline in working days against an institutional calendar,
 *        suspends and resumes the clock for clarification without returning the
 *        days already spent, aggregates related requests before testing the
 *        cost limit, classifies each located item under an absolute or a
 *        qualified exemption with the balance recorded, and carries an internal
 *        review on its own clock (#5260).
 *
 * #5162 gave the platform a subject access request clock. This is a different
 * statute answering a different question, and the differences are exactly the
 * ones that make reusing that machinery produce wrong deadlines.
 *
 * The clock runs in working days. Twenty working days from 20 December is not
 * twenty calendar days later, and an institution that closes for a fortnight
 * over Christmas has a deadline nobody can compute from the receipt date alone.
 * So the calendar is an input, closure days included.
 *
 * The clock can also stop. A request too vague to locate anything pauses on the
 * day clarification is sought and restarts when the requester answers, and the
 * days already spent stay spent — a request clarified on day fifteen has five
 * days left, not twenty. If the answer never comes the request lapses rather
 * than breaching, which is a different outcome and needs to read as one.
 *
 * Then the parts with no analogue in a subject access request at all.
 *
 * There is a cost limit, above which the request may be refused outright. The
 * limit is tested against an estimate, and the estimate is only meaningful if
 * it covers the work actually needed to locate and extract the information.
 *
 * And the limit is tested after aggregation. Several requests from the same
 * person, or from people acting in concert, on the same subject inside a rolling
 * window count as one against that limit. A system assessing each request alone
 * lets through a campaign that a correct assessment would refuse, and it does so
 * while reporting perfect compliance.
 *
 * Exemptions come in two kinds and only one of them is a refusal on its own. An
 * absolute exemption withholds. A qualified exemption withholds only where the
 * public interest in maintaining it outweighs the public interest in disclosure,
 * and that balance has to be recorded per exemption because it is the thing an
 * appeal examines. A qualified exemption with no recorded balance is not a
 * refusal; it is an unfinished one, and it discloses.
 *
 * Disclosure is per item rather than per request, because the usual answer is
 * partial: some of it out, some withheld, and the response saying which is which.
 */

export type RequestState =
  "OPEN" | "AWAITING_CLARIFICATION" | "RESPONDED" | "LAPSED" | "REFUSED_ON_COST" | "OVERDUE";

export type ExemptionClass = "ABSOLUTE" | "QUALIFIED";

export type ItemOutcome = "DISCLOSED" | "WITHHELD" | "REDACTED";

export interface Exemption {
  code: string;
  description: string;
  exemptionClass: ExemptionClass;
}

export interface Requester {
  requesterId: string;
  name: string;
  /**
   * People an apparently separate requester is acting in concert with. A
   * campaign submitting under five names is one requester for the cost limit.
   */
  actingInConcertWith: string[];
}

export interface InformationRequest {
  requestId: string;
  requesterId: string;
  /**
   * The subject, as a key rather than free text. Aggregation turns on "the same
   * or similar subject", and a stated key is auditable in a way that a fuzzy
   * match on the request wording is not.
   */
  subjectKey: string;
  /** The clock starts here, not on the day somebody recognised it as a request. */
  receivedOn: Date;
}

export interface RecordSet {
  recordSetId: string;
  requestId: string;
  custodian: string;
  description: string;
  /** Locating, retrieving and extracting. Not reading, redacting or arguing. */
  estimatedHours: number;
}

export interface LocatedItem {
  itemId: string;
  requestId: string;
  description: string;
}

export interface PublicInterestBalance {
  inDisclosure: string;
  inMaintainingExemption: string;
  /** The decision actually reached, recorded because an appeal examines it. */
  favoursWithholding: boolean;
  decidedBy: string;
  decidedOn: Date;
}

export interface Classification {
  itemId: string;
  outcome: ItemOutcome;
  exemptionCode: string | null;
  balance: PublicInterestBalance | null;
}

export interface ClassificationResult {
  itemId: string;
  outcome: ItemOutcome;
  exemptionCode: string | null;
  /** Where a classification does not stand up, why. */
  problem: string | null;
}

export interface CostEstimate {
  requestId: string;
  /** The requests counted together, this one included. */
  aggregatedRequestIds: string[];
  totalHours: number;
  totalCostPounds: number;
  limitPounds: number;
  overLimit: boolean;
  reason: string;
}

export interface ResponseSummary {
  requestId: string;
  disclosed: ClassificationResult[];
  withheld: ClassificationResult[];
  /** Classifications that do not stand up, and therefore disclose. */
  unsound: ClassificationResult[];
}

export interface Suspension {
  soughtOn: Date;
  answeredOn: Date | null;
}

export interface Extension {
  requestId: string;
  extraWorkingDays: number;
  reason: string;
  /** Reported as an extension rather than a silently later deadline. */
  originalDeadline: Date;
  extendedDeadline: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The statutory period, in working days. */
const RESPONSE_WORKING_DAYS = 20;
/** A public interest extension may run this much further. */
const MAX_EXTENSION_WORKING_DAYS = 20;
/** Clarification unanswered this long lapses the request rather than breaching it. */
const CLARIFICATION_LAPSE_WORKING_DAYS = 60;
/** Requests inside this window are aggregated before the cost limit is tested. */
const AGGREGATION_WINDOW_WORKING_DAYS = 60;
/** An internal review runs its own period of the same length. */
const INTERNAL_REVIEW_WORKING_DAYS = 20;

const COST_LIMIT_POUNDS = 450;
const HOURLY_RATE_POUNDS = 25;

/** A guard so an unanswered clarification cannot spin the deadline walk forever. */
const MAX_WALK_DAYS = 4000;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class FreedomOfInformationService {
  private readonly requesters = new Map<string, Requester>();
  private readonly requests = new Map<string, InformationRequest>();
  private readonly recordSets: RecordSet[] = [];
  private readonly items = new Map<string, LocatedItem>();
  private readonly classifications = new Map<string, Classification>();
  private readonly exemptions = new Map<string, Exemption>();
  private readonly suspensions = new Map<string, Suspension[]>();
  private readonly extensions = new Map<string, number>();
  private readonly responded = new Map<string, Date>();
  private readonly reviews = new Map<string, Date>();
  private readonly closureDays = new Set<string>();

  registerRequester(requester: Requester): void {
    this.requesters.set(requester.requesterId, requester);
  }

  registerRequest(request: InformationRequest): void {
    if (!this.requesters.has(request.requesterId)) {
      throw new Error(`Unknown requester ${request.requesterId}`);
    }
    this.requests.set(request.requestId, request);
  }

  registerExemption(exemption: Exemption): void {
    this.exemptions.set(exemption.code, exemption);
  }

  registerRecordSet(recordSet: RecordSet): void {
    if (recordSet.estimatedHours < 0) {
      throw new Error(`Record set ${recordSet.recordSetId} cannot take negative hours`);
    }
    this.recordSets.push(recordSet);
  }

  registerItem(item: LocatedItem): void {
    this.items.set(item.itemId, item);
  }

  /** A day the institution is closed. Closure moves the deadline; it does not pause it. */
  registerClosureDay(date: Date): void {
    this.closureDays.add(isoDate(startOfDay(date)));
  }

  private requireRequest(requestId: string): InformationRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Unknown request ${requestId}`);
    return request;
  }

  isWorkingDay(date: Date): boolean {
    const day = startOfDay(date);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) return false;
    return !this.closureDays.has(isoDate(day));
  }

  /** Working days after a date, not counting the date itself. */
  addWorkingDays(from: Date, count: number): Date {
    let cursor = startOfDay(from);
    let counted = 0;
    let walked = 0;

    while (counted < count && walked < MAX_WALK_DAYS) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
      walked += 1;
      if (this.isWorkingDay(cursor)) counted += 1;
    }
    return cursor;
  }

  /** Working days between two dates, excluding the first and including the last. */
  workingDaysBetween(from: Date, to: Date): number {
    let cursor = startOfDay(from);
    const end = startOfDay(to);
    let counted = 0;

    while (cursor.getTime() < end.getTime()) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
      if (this.isWorkingDay(cursor)) counted += 1;
    }
    return counted;
  }

  /**
   * A request too vague to act on. The clock stops on the day clarification is
   * sought, which is why the day itself counts as suspended.
   */
  seekClarification(requestId: string, on: Date): void {
    this.requireRequest(requestId);
    const open = this.suspensions.get(requestId)?.find((s) => s.answeredOn === null);
    if (open) {
      throw new Error(`Request ${requestId} is already awaiting clarification`);
    }
    const list = this.suspensions.get(requestId) ?? [];
    list.push({ soughtOn: startOfDay(on), answeredOn: null });
    this.suspensions.set(requestId, list);
  }

  /** The clock restarts on the day the answer arrives, with the spent days spent. */
  receiveClarification(requestId: string, on: Date): void {
    const open = this.suspensions.get(requestId)?.find((s) => s.answeredOn === null);
    if (!open) throw new Error(`Request ${requestId} is not awaiting clarification`);
    if (startOfDay(on).getTime() < open.soughtOn.getTime()) {
      throw new Error("Clarification cannot be answered before it was sought");
    }
    open.answeredOn = startOfDay(on);
  }

  private isSuspendedOn(requestId: string, date: Date): boolean {
    const day = startOfDay(date).getTime();
    return (this.suspensions.get(requestId) ?? []).some(
      (suspension) =>
        day >= suspension.soughtOn.getTime() &&
        (suspension.answeredOn === null || day < suspension.answeredOn.getTime()),
    );
  }

  private openSuspension(requestId: string): Suspension | null {
    return (this.suspensions.get(requestId) ?? []).find((s) => s.answeredOn === null) ?? null;
  }

  /**
   * The deadline, in working days, with suspended days skipped rather than
   * returned. Null while the clock is stopped, because a deadline that depends
   * on an answer nobody has given is not a date yet.
   */
  deadline(requestId: string): Date | null {
    const request = this.requireRequest(requestId);
    if (this.openSuspension(requestId) !== null) return null;

    const target = RESPONSE_WORKING_DAYS + (this.extensions.get(requestId) ?? 0);
    let cursor = startOfDay(request.receivedOn);
    let counted = 0;
    let walked = 0;

    while (counted < target && walked < MAX_WALK_DAYS) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
      walked += 1;
      if (!this.isWorkingDay(cursor)) continue;
      if (this.isSuspendedOn(requestId, cursor)) continue;
      counted += 1;
    }

    return cursor;
  }

  /** The working days consumed so far, which is what a suspension preserves. */
  workingDaysConsumed(requestId: string, asOf: Date): number {
    const request = this.requireRequest(requestId);
    let cursor = startOfDay(request.receivedOn);
    const end = startOfDay(asOf);
    let counted = 0;

    while (cursor.getTime() < end.getTime()) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
      if (!this.isWorkingDay(cursor)) continue;
      if (this.isSuspendedOn(requestId, cursor)) continue;
      counted += 1;
    }
    return counted;
  }

  markResponded(requestId: string, on: Date): void {
    this.requireRequest(requestId);
    this.responded.set(requestId, startOfDay(on));
  }

  state(requestId: string, asOf: Date): RequestState {
    this.requireRequest(requestId);

    if (this.responded.has(requestId)) return "RESPONDED";

    const open = this.openSuspension(requestId);
    if (open !== null) {
      // An answer that never comes lapses the request. Leaving it open forever
      // reports a breach that never actually occurred.
      return this.workingDaysBetween(open.soughtOn, asOf) > CLARIFICATION_LAPSE_WORKING_DAYS
        ? "LAPSED"
        : "AWAITING_CLARIFICATION";
    }

    if (this.costEstimate(requestId).overLimit) return "REFUSED_ON_COST";

    const due = this.deadline(requestId);
    if (due !== null && startOfDay(asOf).getTime() > due.getTime()) return "OVERDUE";
    return "OPEN";
  }

  /**
   * The requests that count together: the same requester or anyone acting in
   * concert with them, on the same subject, inside the rolling window.
   */
  aggregatedRequestIds(requestId: string): string[] {
    const request = this.requireRequest(requestId);
    const requester = this.requesters.get(request.requesterId);
    const connected = new Set<string>([
      request.requesterId,
      ...(requester?.actingInConcertWith ?? []),
    ]);

    // The concert relation is stated on one side and true on both.
    for (const candidate of this.requesters.values()) {
      if (candidate.actingInConcertWith.includes(request.requesterId)) {
        connected.add(candidate.requesterId);
      }
    }

    return [...this.requests.values()]
      .filter((candidate) => connected.has(candidate.requesterId))
      .filter((candidate) => candidate.subjectKey === request.subjectKey)
      .filter(
        (candidate) =>
          Math.abs(
            this.workingDaysBetween(
              new Date(Math.min(candidate.receivedOn.getTime(), request.receivedOn.getTime())),
              new Date(Math.max(candidate.receivedOn.getTime(), request.receivedOn.getTime())),
            ),
          ) <= AGGREGATION_WINDOW_WORKING_DAYS,
      )
      .map((candidate) => candidate.requestId)
      .sort();
  }

  /**
   * The estimate, tested after aggregation. Assessing each request alone lets a
   * campaign through while reporting perfect compliance.
   */
  costEstimate(requestId: string): CostEstimate {
    const aggregated = this.aggregatedRequestIds(requestId);
    const totalHours = this.recordSets
      .filter((recordSet) => aggregated.includes(recordSet.requestId))
      .reduce((sum, recordSet) => sum + recordSet.estimatedHours, 0);

    const totalCostPounds = totalHours * HOURLY_RATE_POUNDS;
    const overLimit = totalCostPounds > COST_LIMIT_POUNDS;

    return {
      requestId,
      aggregatedRequestIds: aggregated,
      totalHours,
      totalCostPounds,
      limitPounds: COST_LIMIT_POUNDS,
      overLimit,
      reason: overLimit
        ? `${totalHours}h across ${aggregated.length} aggregated request(s) costs £${totalCostPounds}, over the £${COST_LIMIT_POUNDS} limit`
        : `${totalHours}h across ${aggregated.length} aggregated request(s) costs £${totalCostPounds}, within the £${COST_LIMIT_POUNDS} limit`,
    };
  }

  /**
   * Advice and assistance has to be considered before a cost refusal: the
   * narrowest scope that would come in under the limit, where one exists.
   */
  narrowestScopeUnderLimit(requestId: string): RecordSet[] {
    const aggregated = this.aggregatedRequestIds(requestId);
    const sets = this.recordSets
      .filter((recordSet) => aggregated.includes(recordSet.requestId))
      .sort((a, b) => a.estimatedHours - b.estimatedHours);

    const kept: RecordSet[] = [];
    let hours = 0;
    for (const set of sets) {
      if ((hours + set.estimatedHours) * HOURLY_RATE_POUNDS > COST_LIMIT_POUNDS) break;
      kept.push(set);
      hours += set.estimatedHours;
    }
    return kept;
  }

  classifyItem(classification: Classification): ClassificationResult {
    if (!this.items.has(classification.itemId)) {
      throw new Error(`Unknown item ${classification.itemId}`);
    }
    this.classifications.set(classification.itemId, classification);
    return this.evaluateClassification(classification);
  }

  /**
   * Whether a classification actually withholds anything.
   *
   * An absolute exemption does. A qualified one does only where the balance was
   * struck and struck that way; without a recorded balance it is an unfinished
   * refusal, and an unfinished refusal discloses.
   */
  private evaluateClassification(classification: Classification): ClassificationResult {
    const base = {
      itemId: classification.itemId,
      outcome: classification.outcome,
      exemptionCode: classification.exemptionCode,
    };

    if (classification.outcome === "DISCLOSED") {
      return { ...base, problem: null };
    }

    if (classification.exemptionCode === null) {
      return {
        ...base,
        outcome: "DISCLOSED",
        problem: "Withheld without naming an exemption, so nothing supports withholding it",
      };
    }

    const exemption = this.exemptions.get(classification.exemptionCode);
    if (!exemption) {
      return {
        ...base,
        outcome: "DISCLOSED",
        problem: `Exemption ${classification.exemptionCode} is not one this register knows`,
      };
    }

    if (exemption.exemptionClass === "ABSOLUTE") {
      return { ...base, problem: null };
    }

    if (classification.balance === null) {
      return {
        ...base,
        outcome: "DISCLOSED",
        problem: `${exemption.code} is qualified and no public interest balance was recorded`,
      };
    }

    if (!classification.balance.favoursWithholding) {
      return {
        ...base,
        outcome: "DISCLOSED",
        problem: `${exemption.code} applies but the balance was struck in favour of disclosure`,
      };
    }

    return { ...base, problem: null };
  }

  /**
   * The response, item by item. Partial disclosure is the usual answer, so the
   * summary carries what went out, what did not, and which classifications did
   * not stand up.
   */
  responseSummary(requestId: string): ResponseSummary {
    this.requireRequest(requestId);

    const results = [...this.items.values()]
      .filter((item) => item.requestId === requestId)
      .sort((a, b) => a.itemId.localeCompare(b.itemId))
      .map((item) => {
        const classification = this.classifications.get(item.itemId);
        if (!classification) {
          return {
            itemId: item.itemId,
            outcome: "DISCLOSED" as ItemOutcome,
            exemptionCode: null,
            problem: "Located but never classified, so nothing supports withholding it",
          };
        }
        return this.evaluateClassification(classification);
      });

    return {
      requestId,
      disclosed: results.filter((result) => result.outcome !== "WITHHELD"),
      withheld: results.filter((result) => result.outcome === "WITHHELD"),
      unsound: results.filter((result) => result.problem !== null),
    };
  }

  /**
   * A genuine public interest balance can need longer. Reported as an extension
   * with the original deadline alongside it, because a deadline that quietly
   * moves is a deadline nobody was ever late for.
   */
  extendForPublicInterest(requestId: string, extraWorkingDays: number, reason: string): Extension {
    this.requireRequest(requestId);
    if (extraWorkingDays <= 0 || extraWorkingDays > MAX_EXTENSION_WORKING_DAYS) {
      throw new Error(
        `An extension must be between 1 and ${MAX_EXTENSION_WORKING_DAYS} working days`,
      );
    }

    const original = this.deadline(requestId);
    if (original === null) {
      throw new Error(`Request ${requestId} has no running deadline to extend`);
    }

    this.extensions.set(requestId, (this.extensions.get(requestId) ?? 0) + extraWorkingDays);
    const extended = this.deadline(requestId) as Date;

    return {
      requestId,
      extraWorkingDays,
      reason,
      originalDeadline: original,
      extendedDeadline: extended,
    };
  }

  /**
   * An internal review runs its own clock from the day it is asked for, and
   * carries none of the original one — including none of the original's lateness.
   */
  openInternalReview(requestId: string, requestedOn: Date): Date {
    this.requireRequest(requestId);
    if (!this.responded.has(requestId)) {
      throw new Error(
        `Request ${requestId} has not been responded to, so there is nothing to review`,
      );
    }
    this.reviews.set(requestId, startOfDay(requestedOn));
    return this.addWorkingDays(requestedOn, INTERNAL_REVIEW_WORKING_DAYS);
  }

  internalReviewDeadline(requestId: string): Date | null {
    const requestedOn = this.reviews.get(requestId);
    return requestedOn ? this.addWorkingDays(requestedOn, INTERNAL_REVIEW_WORKING_DAYS) : null;
  }
}
