/**
 * Module: Club Purchase Order Encumbrance Ledger
 * File: src/services/clubEncumbranceLedgerService.ts
 * Scope: Commits funds against a budget line at purchase-order approval rather
 *        than at invoice, so the balance every approval checks is the money
 *        that is genuinely still uncommitted (#4553).
 *
 * A treasurer raises an order, the advisor approves it, and the invoice lands
 * anywhere from three days to six weeks later. Recording the money only at
 * reconciliation means that for those six weeks it is spent in every sense that
 * matters while still being visible as available. Two officers approve against
 * the same catering line on the same afternoon, both checks pass because
 * neither approval moved the number the other was reading, and the line goes
 * negative when both invoices land.
 *
 * Two rules hold everything else up.
 *
 * Every amount is an integer count of cents. Budget arithmetic accumulates over
 * a whole fiscal year across hundreds of orders, and a float that is a hundredth
 * of a cent out per operation eventually disagrees with the bank.
 *
 * Every balance is a fold over an append-only event log. There is no running
 * total stored anywhere that could drift away from the history that produced
 * it, which is also what makes "what did this line look like on the 3rd?" a
 * question with an answer rather than a reconstruction exercise.
 */

export type FiscalYear = string;

export type EncumbranceStatus =
  "OPEN" | "PARTIALLY_LIQUIDATED" | "LIQUIDATED" | "CANCELLED" | "EXPIRED";

export type LedgerEventType = "ALLOCATED" | "ENCUMBERED" | "RELEASED" | "LIQUIDATED";

/**
 * Why an encumbrance was released. Every release moves the same bucket, but a
 * cancelled order, an underspent one and one swept at year close are three
 * different conversations with the advisor, so the ledger records which.
 */
export type ReleaseReason = "LIQUIDATION_UNDERRUN" | "CANCELLATION" | "FISCAL_YEAR_CLOSE";

export type ApprovalOutcome =
  | "APPROVED"
  | "INSUFFICIENT_AVAILABLE"
  | "LINE_NOT_FOUND"
  | "LINE_CLOSED"
  | "DUPLICATE_PURCHASE_ORDER";

export type LiquidationOutcome =
  | "LIQUIDATED_IN_FULL"
  | "PARTIALLY_LIQUIDATED"
  | "LIQUIDATED_WITH_UNDERRUN_RELEASED"
  | "REFUSED_OVERAGE_EXCEEDS_AVAILABLE"
  | "REFUSED_NOT_LIQUIDATABLE"
  | "REFUSED_UNKNOWN_ENCUMBRANCE";

export type CancellationOutcome =
  "CANCELLED" | "REFUSED_ALREADY_SETTLED" | "REFUSED_UNKNOWN_ENCUMBRANCE";

export interface BudgetLineInput {
  lineId: string;
  clubId: string;
  fiscalYear: FiscalYear;
  category: string;
  allocatedCents: number;
  openedAt: Date;
  /** Fiscal year close. Encumbrances still outstanding at this instant are swept. */
  closesAt: Date;
}

export interface PurchaseOrderInput {
  purchaseOrderId: string;
  lineId: string;
  vendorName: string;
  /** The treasurer's estimate. The invoice is allowed to disagree with it. */
  estimatedCents: number;
  raisedByUserId: string;
  approvedByUserId: string;
  approvedAt: Date;
}

export interface LiquidationInput {
  encumbranceId: string;
  invoiceId: string;
  invoicedCents: number;
  occurredAt: Date;
  /**
   * True when no further invoice is expected against this order. A catering
   * order that bills a deposit and then a balance sends `final: false` first.
   */
  final: boolean;
}

export interface LedgerEvent {
  sequence: number;
  lineId: string;
  encumbranceId: string | null;
  type: LedgerEventType;
  /** Always a positive magnitude. The type says which bucket it moves and how. */
  amountCents: number;
  reason: ReleaseReason | null;
  occurredAt: Date;
  memo: string;
}

export interface Encumbrance {
  encumbranceId: string;
  purchaseOrderId: string;
  lineId: string;
  vendorName: string;
  committedCents: number;
  liquidatedCents: number;
  status: EncumbranceStatus;
  approvedAt: Date;
  settledAt: Date | null;
}

export interface LineBalance {
  lineId: string;
  allocatedCents: number;
  encumberedCents: number;
  liquidatedCents: number;
  /** allocated - liquidated - encumbered. The only number an approval may read. */
  availableCents: number;
}

export interface ApprovalResult {
  outcome: ApprovalOutcome;
  approved: boolean;
  encumbranceId: string | null;
  /** The line's available balance after the attempt, approved or not. */
  availableAfterCents: number;
  shortfallCents: number;
}

export interface LiquidationResult {
  outcome: LiquidationOutcome;
  liquidatedCents: number;
  releasedCents: number;
  overageCents: number;
  status: EncumbranceStatus | null;
}

export interface SweepResult {
  lineId: string;
  expiredEncumbranceIds: string[];
  releasedCents: number;
}

interface BudgetLine extends BudgetLineInput {
  closed: boolean;
}

export class ClubEncumbranceLedgerService {
  private readonly lines: Map<string, BudgetLine>;
  private readonly encumbrances: Map<string, Encumbrance>;
  private readonly purchaseOrderIndex: Map<string, string>;
  private readonly events: LedgerEvent[];
  private sequence: number;
  private encumbranceSequence: number;

  constructor() {
    this.lines = new Map();
    this.encumbrances = new Map();
    this.purchaseOrderIndex = new Map();
    this.events = [];
    this.sequence = 0;
    this.encumbranceSequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Budget lines
  // ---------------------------------------------------------------------------

  public openLine(input: BudgetLineInput): void {
    if (this.lines.has(input.lineId)) {
      throw new Error(`Budget line ${input.lineId} already exists.`);
    }
    if (!Number.isInteger(input.allocatedCents)) {
      throw new Error(`Allocation for ${input.lineId} must be an integer number of cents.`);
    }
    if (input.allocatedCents < 0) {
      throw new Error(`Allocation for ${input.lineId} cannot be negative.`);
    }
    if (input.closesAt.getTime() <= input.openedAt.getTime()) {
      throw new Error(`Budget line ${input.lineId} must close after it opens.`);
    }

    this.lines.set(input.lineId, { ...input, closed: false });
    this.append({
      lineId: input.lineId,
      encumbranceId: null,
      type: "ALLOCATED",
      amountCents: input.allocatedCents,
      reason: null,
      occurredAt: input.openedAt,
      memo: `Opening allocation for ${input.category} (${input.fiscalYear})`,
    });
  }

  /**
   * A mid-year top-up. Recorded as a further ALLOCATED event rather than by
   * editing the opening figure, so the line's history still shows what it was
   * originally given and when that changed.
   */
  public increaseAllocation(lineId: string, amountCents: number, at: Date, memo: string): void {
    const line = this.requireLine(lineId);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error(`A top-up on ${line.lineId} must be a positive integer number of cents.`);
    }
    this.append({
      lineId,
      encumbranceId: null,
      type: "ALLOCATED",
      amountCents,
      reason: null,
      occurredAt: at,
      memo,
    });
  }

  // ---------------------------------------------------------------------------
  // Approval: check and commit are one operation
  // ---------------------------------------------------------------------------

  /**
   * Approving commits the estimate against the line immediately.
   *
   * The check and the commit happen here together and nothing runs between
   * them. That is the whole point: the failure this feature exists to prevent
   * is two approvals that each read a balance the other was about to spend.
   * The SQL counterpart takes a row lock on the line for the same reason.
   *
   * A refusal is returned rather than thrown. Approvals are frequently
   * processed as a batch from an advisor's queue, and one unaffordable order
   * should not abort the eleven behind it.
   */
  public approvePurchaseOrder(input: PurchaseOrderInput): ApprovalResult {
    if (!Number.isInteger(input.estimatedCents) || input.estimatedCents <= 0) {
      throw new Error(
        `Purchase order ${input.purchaseOrderId} must commit a positive integer number of cents.`,
      );
    }

    const line = this.lines.get(input.lineId);
    if (!line) {
      return this.refusal("LINE_NOT_FOUND", 0, 0);
    }

    if (this.purchaseOrderIndex.has(input.purchaseOrderId)) {
      const balance = this.balanceOf(input.lineId);
      return this.refusal("DUPLICATE_PURCHASE_ORDER", balance.availableCents, 0);
    }

    if (line.closed || input.approvedAt.getTime() >= line.closesAt.getTime()) {
      const balance = this.balanceOf(input.lineId);
      return this.refusal("LINE_CLOSED", balance.availableCents, 0);
    }

    const before = this.balanceOf(input.lineId);
    if (before.availableCents < input.estimatedCents) {
      return this.refusal(
        "INSUFFICIENT_AVAILABLE",
        before.availableCents,
        input.estimatedCents - before.availableCents,
      );
    }

    this.encumbranceSequence += 1;
    const encumbranceId = `ENC-${String(this.encumbranceSequence).padStart(6, "0")}`;

    this.encumbrances.set(encumbranceId, {
      encumbranceId,
      purchaseOrderId: input.purchaseOrderId,
      lineId: input.lineId,
      vendorName: input.vendorName,
      committedCents: input.estimatedCents,
      liquidatedCents: 0,
      status: "OPEN",
      approvedAt: input.approvedAt,
      settledAt: null,
    });
    this.purchaseOrderIndex.set(input.purchaseOrderId, encumbranceId);

    this.append({
      lineId: input.lineId,
      encumbranceId,
      type: "ENCUMBERED",
      amountCents: input.estimatedCents,
      reason: null,
      occurredAt: input.approvedAt,
      memo: `PO ${input.purchaseOrderId} to ${input.vendorName}`,
    });

    return {
      outcome: "APPROVED",
      approved: true,
      encumbranceId,
      availableAfterCents: this.balanceOf(input.lineId).availableCents,
      shortfallCents: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Liquidation
  // ---------------------------------------------------------------------------

  /**
   * Turns committed money into spent money when the invoice arrives.
   *
   * The invoice rarely equals the estimate, and the two directions are not
   * symmetrical. Under the estimate, the difference was never spent and belongs
   * back on the line — but only once the order is final, because a deposit
   * invoice is not evidence that the balance invoice will be small.
   *
   * Over the estimate, the excess was never checked against anything. It is
   * checked here, against the line's available balance, and refused if it does
   * not fit. Letting it through would reproduce the overspend one layer down.
   */
  public liquidate(input: LiquidationInput): LiquidationResult {
    if (!Number.isInteger(input.invoicedCents) || input.invoicedCents <= 0) {
      throw new Error(`Invoice ${input.invoiceId} must be a positive integer number of cents.`);
    }

    const encumbrance = this.encumbrances.get(input.encumbranceId);
    if (!encumbrance) {
      return {
        outcome: "REFUSED_UNKNOWN_ENCUMBRANCE",
        liquidatedCents: 0,
        releasedCents: 0,
        overageCents: 0,
        status: null,
      };
    }

    if (encumbrance.status !== "OPEN" && encumbrance.status !== "PARTIALLY_LIQUIDATED") {
      return {
        outcome: "REFUSED_NOT_LIQUIDATABLE",
        liquidatedCents: 0,
        releasedCents: 0,
        overageCents: 0,
        status: encumbrance.status,
      };
    }

    const remaining = encumbrance.committedCents - encumbrance.liquidatedCents;
    const overage = Math.max(0, input.invoicedCents - remaining);

    if (overage > 0) {
      // Available already counts `remaining` as encumbered, so the net draw on
      // the line is exactly the overage rather than the whole invoice.
      const available = this.balanceOf(encumbrance.lineId).availableCents;
      if (available < overage) {
        return {
          outcome: "REFUSED_OVERAGE_EXCEEDS_AVAILABLE",
          liquidatedCents: 0,
          releasedCents: 0,
          overageCents: overage,
          status: encumbrance.status,
        };
      }
    }

    const releasedFromCommitment = Math.min(input.invoicedCents, remaining);
    this.append({
      lineId: encumbrance.lineId,
      encumbranceId: encumbrance.encumbranceId,
      type: "RELEASED",
      amountCents: releasedFromCommitment,
      reason: null,
      occurredAt: input.occurredAt,
      memo: `Commitment consumed by invoice ${input.invoiceId}`,
    });
    this.append({
      lineId: encumbrance.lineId,
      encumbranceId: encumbrance.encumbranceId,
      type: "LIQUIDATED",
      amountCents: input.invoicedCents,
      reason: null,
      occurredAt: input.occurredAt,
      memo: `Invoice ${input.invoiceId} from ${encumbrance.vendorName}`,
    });

    encumbrance.liquidatedCents += input.invoicedCents;

    const stillCommitted = Math.max(0, remaining - input.invoicedCents);

    if (!input.final && stillCommitted > 0) {
      encumbrance.status = "PARTIALLY_LIQUIDATED";
      return {
        outcome: "PARTIALLY_LIQUIDATED",
        liquidatedCents: input.invoicedCents,
        releasedCents: 0,
        overageCents: 0,
        status: encumbrance.status,
      };
    }

    let underrunReleased = 0;
    if (stillCommitted > 0) {
      underrunReleased = stillCommitted;
      this.append({
        lineId: encumbrance.lineId,
        encumbranceId: encumbrance.encumbranceId,
        type: "RELEASED",
        amountCents: stillCommitted,
        reason: "LIQUIDATION_UNDERRUN",
        occurredAt: input.occurredAt,
        memo: `Underspend on PO ${encumbrance.purchaseOrderId} returned to the line`,
      });
    }

    encumbrance.status = "LIQUIDATED";
    encumbrance.settledAt = input.occurredAt;

    return {
      outcome: underrunReleased > 0 ? "LIQUIDATED_WITH_UNDERRUN_RELEASED" : "LIQUIDATED_IN_FULL",
      liquidatedCents: input.invoicedCents,
      releasedCents: underrunReleased,
      overageCents: overage,
      status: encumbrance.status,
    };
  }

  // ---------------------------------------------------------------------------
  // Cancellation and the year-close sweep
  // ---------------------------------------------------------------------------

  public cancelPurchaseOrder(
    encumbranceId: string,
    at: Date,
    memo: string,
  ): { outcome: CancellationOutcome; releasedCents: number } {
    const encumbrance = this.encumbrances.get(encumbranceId);
    if (!encumbrance) {
      return { outcome: "REFUSED_UNKNOWN_ENCUMBRANCE", releasedCents: 0 };
    }
    if (encumbrance.status !== "OPEN" && encumbrance.status !== "PARTIALLY_LIQUIDATED") {
      // A settled order has nothing left to give back. Releasing against it
      // again would hand the line money it never had.
      return { outcome: "REFUSED_ALREADY_SETTLED", releasedCents: 0 };
    }

    const remaining = encumbrance.committedCents - encumbrance.liquidatedCents;
    if (remaining > 0) {
      this.append({
        lineId: encumbrance.lineId,
        encumbranceId,
        type: "RELEASED",
        amountCents: remaining,
        reason: "CANCELLATION",
        occurredAt: at,
        memo,
      });
    }

    encumbrance.status = "CANCELLED";
    encumbrance.settledAt = at;
    return { outcome: "CANCELLED", releasedCents: remaining };
  }

  /**
   * Sweeps everything still outstanding on a line at fiscal-year close.
   *
   * Idempotent by construction rather than by a guard flag: the sweep only
   * touches encumbrances in a live status and moves them out of it, so a
   * retried sweep — after a timeout, or a cron that fired twice — finds nothing
   * left to act on and releases nothing a second time.
   */
  public sweepFiscalYearClose(lineId: string, closeAt: Date): SweepResult {
    const line = this.requireLine(lineId);
    if (closeAt.getTime() < line.closesAt.getTime()) {
      throw new Error(`Line ${lineId} cannot be swept before its close date.`);
    }

    const expiredEncumbranceIds: string[] = [];
    let releasedCents = 0;

    for (const encumbrance of this.encumbrancesForLine(lineId)) {
      if (encumbrance.status !== "OPEN" && encumbrance.status !== "PARTIALLY_LIQUIDATED") {
        continue;
      }
      const remaining = encumbrance.committedCents - encumbrance.liquidatedCents;
      if (remaining > 0) {
        this.append({
          lineId,
          encumbranceId: encumbrance.encumbranceId,
          type: "RELEASED",
          amountCents: remaining,
          reason: "FISCAL_YEAR_CLOSE",
          occurredAt: closeAt,
          memo: `PO ${encumbrance.purchaseOrderId} unliquidated at ${line.fiscalYear} close`,
        });
        releasedCents += remaining;
      }
      encumbrance.status = "EXPIRED";
      encumbrance.settledAt = closeAt;
      expiredEncumbranceIds.push(encumbrance.encumbranceId);
    }

    line.closed = true;
    return { lineId, expiredEncumbranceIds, releasedCents };
  }

  // ---------------------------------------------------------------------------
  // Balances, all folded from the log
  // ---------------------------------------------------------------------------

  public balanceOf(lineId: string): LineBalance {
    return this.fold(lineId, this.events);
  }

  /**
   * The line as it stood at a given instant, folded from the events on or
   * before it. Used by the year-end reconciliation pack, where the question is
   * always about a date in the past.
   */
  public balanceAsOf(lineId: string, asOf: Date): LineBalance {
    const cutoff = asOf.getTime();
    return this.fold(
      lineId,
      this.events.filter((event) => event.occurredAt.getTime() <= cutoff),
    );
  }

  public committedTo(lineId: string): Encumbrance[] {
    return this.encumbrancesForLine(lineId).filter(
      (encumbrance) =>
        encumbrance.status === "OPEN" || encumbrance.status === "PARTIALLY_LIQUIDATED",
    );
  }

  public encumbranceFor(purchaseOrderId: string): Encumbrance | null {
    const id = this.purchaseOrderIndex.get(purchaseOrderId);
    return id ? (this.encumbrances.get(id) ?? null) : null;
  }

  public eventsFor(lineId: string): readonly LedgerEvent[] {
    return this.events.filter((event) => event.lineId === lineId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private fold(lineId: string, source: readonly LedgerEvent[]): LineBalance {
    let allocatedCents = 0;
    let encumberedCents = 0;
    let liquidatedCents = 0;

    for (const event of source) {
      if (event.lineId !== lineId) continue;
      switch (event.type) {
        case "ALLOCATED":
          allocatedCents += event.amountCents;
          break;
        case "ENCUMBERED":
          encumberedCents += event.amountCents;
          break;
        case "RELEASED":
          encumberedCents -= event.amountCents;
          break;
        case "LIQUIDATED":
          liquidatedCents += event.amountCents;
          break;
      }
    }

    return {
      lineId,
      allocatedCents,
      encumberedCents,
      liquidatedCents,
      availableCents: allocatedCents - liquidatedCents - encumberedCents,
    };
  }

  private encumbrancesForLine(lineId: string): Encumbrance[] {
    return [...this.encumbrances.values()]
      .filter((encumbrance) => encumbrance.lineId === lineId)
      .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());
  }

  private append(event: Omit<LedgerEvent, "sequence">): void {
    this.sequence += 1;
    this.events.push({ sequence: this.sequence, ...event });
  }

  private refusal(
    outcome: ApprovalOutcome,
    availableAfterCents: number,
    shortfallCents: number,
  ): ApprovalResult {
    return { outcome, approved: false, encumbranceId: null, availableAfterCents, shortfallCents };
  }

  private requireLine(lineId: string): BudgetLine {
    const line = this.lines.get(lineId);
    if (!line) {
      throw new Error(`Unknown budget line ${lineId}.`);
    }
    return line;
  }
}
