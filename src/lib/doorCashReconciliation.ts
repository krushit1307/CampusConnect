/**
 * Door Cash Reconciliation (#3400).
 *
 * The money chain in CampusConnect assumes the money is digital:
 * `stripeConnect.ts` settles cards, `dynamicPricing.ts` prices tiers,
 * `dynamicQrTicket.ts` issues tickets, `clubFinances.ts` aggregates the ledger.
 * Cash taken at the door appears nowhere in it.
 *
 * That is not an edge case. A club sells advance tickets online and then takes
 * walk-ups in cash, because fifteen people each fumbling through a card flow is
 * not a queue anybody survives. The cash goes in a lockbox, gets carried across
 * campus at 23:00, and is deposited some time later. What the treasurer
 * reconciles against is a number on a scrap of paper.
 *
 * This module closes that loop: what the ledger says should be in the drawer,
 * what was actually counted, where the difference is, and who was holding it.
 *
 * Every amount is an integer number of minor units (cents). Floating-point
 * currency in a module whose entire purpose is detecting a discrepancy would
 * be self-defeating; the conversion to major units happens once, at the
 * boundary where `FinancialTransaction` records are emitted.
 */

import type { FinancialTransaction } from "./clubFinances";

/** Face value in minor units. */
export type Denomination = number;

/**
 * Denominations counted, largest first.
 *
 * Counting by denomination rather than typing a total is the point: a single
 * typed total is a number somebody derived by hand, and that derivation is
 * precisely the step that goes wrong. It also makes an arithmetic slip visible
 * as an implausible quantity rather than as an unexplained variance.
 */
export const DEFAULT_DENOMINATIONS: ReadonlyArray<Denomination> = [
  10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1,
];

export type CountStage = "OPENING" | "CLOSING";

export type EntryKind =
  /** Cash taken for a ticket. */
  | "SALE"
  /** Admitted without payment; counts towards attendance, not towards cash. */
  | "COMP"
  /** A sale reversed before the drawer closed. */
  | "VOID"
  /** Cash handed back after the sale completed. */
  | "REFUND"
  /** Cash removed from the drawer mid-shift, e.g. to a safe. */
  | "PAYOUT";

export type VarianceBand = "BALANCED" | "WITHIN_TOLERANCE" | "INVESTIGATE" | "ESCALATE";

export interface DrawerCount {
  stage: CountStage;
  /** Denomination in minor units to the quantity counted. */
  quantities: Record<string, number>;
  countedBy: string;
  countedAt: string;
}

export interface DoorEntry {
  id: string;
  kind: EntryKind;
  /** Charged amount in minor units. Zero for a comp. */
  amountMinor: number;
  ticketTier?: string | null;
  /** Set on a VOID, naming the entry it reverses. */
  voidsEntryId?: string | null;
  reason?: string | null;
  soldBy: string;
  occurredAt: string;
}

export interface CustodyTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  occurredAt: string;
}

export interface Drawer {
  drawerId: string;
  eventId: string;
  clubId: string;
  label: string;
  opening: DrawerCount;
  closing: DrawerCount | null;
  entries: DoorEntry[];
}

export interface VarianceThresholds {
  /** Anything at or below this is treated as counting noise. */
  toleranceMinor: number;
  /** Fraction of takings above which a variance is escalated regardless. */
  investigateFraction: number;
  escalateFraction: number;
  /** Absolute floor above which a variance is escalated regardless. */
  escalateMinor: number;
}

/**
 * A fixed dollar tolerance is absurd at both $50 and $5,000 of takings, so the
 * bands combine an absolute floor with a proportion. The floor stops a small
 * event escalating on rounding; the proportion stops a large one hiding a real
 * loss inside a generous flat allowance.
 */
export const DEFAULT_THRESHOLDS: VarianceThresholds = {
  toleranceMinor: 200,
  investigateFraction: 0.01,
  escalateFraction: 0.05,
  escalateMinor: 10_000,
};

export interface DrawerReconciliation {
  drawerId: string;
  label: string;
  openingFloatMinor: number;
  grossSalesMinor: number;
  refundsMinor: number;
  payoutsMinor: number;
  compCount: number;
  voidCount: number;
  /** What the drawer should hold: float + sales - refunds - payouts. */
  expectedMinor: number;
  countedMinor: number;
  /** Counted minus expected. Positive is an overage. */
  varianceMinor: number;
  band: VarianceBand;
  balanced: boolean;
  /** Attendance admitted through this door, comps included. */
  admittedCount: number;
  anomalies: string[];
}

/** Sums a denomination breakdown. */
export function countTotal(count: DrawerCount): number {
  let total = 0;

  for (const [denomination, quantity] of Object.entries(count.quantities)) {
    const face = Number.parseInt(denomination, 10);
    if (!Number.isFinite(face) || face <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    total += face * Math.trunc(quantity);
  }

  return total;
}

/**
 * Quantities that suggest a miscount rather than a genuine holding.
 *
 * A drawer holding four hundred pennies or an unrecognised denomination is
 * almost always a transcription error, and finding it here is far cheaper than
 * finding it as an unexplained variance an hour later.
 */
export function implausibleQuantities(
  count: DrawerCount,
  denominations: ReadonlyArray<Denomination> = DEFAULT_DENOMINATIONS,
  maxPerDenomination = 300,
): string[] {
  const known = new Set(denominations);
  const notes: string[] = [];

  for (const [denomination, quantity] of Object.entries(count.quantities)) {
    const face = Number.parseInt(denomination, 10);

    if (!known.has(face)) {
      notes.push(
        `Unrecognised denomination ${denomination} in the ${count.stage.toLowerCase()} count.`,
      );
      continue;
    }

    if (quantity < 0) {
      notes.push(
        `Negative quantity for ${denomination} in the ${count.stage.toLowerCase()} count.`,
      );
      continue;
    }

    if (quantity > maxPerDenomination) {
      notes.push(
        `${quantity} of denomination ${denomination} in the ${count.stage.toLowerCase()} count looks like a miscount.`,
      );
    }
  }

  return notes.sort();
}

/**
 * What the drawer should hold, derived from the entries rather than asserted.
 *
 * Voided sales are excluded, and the entry they void is excluded with them, so
 * a reversal nets to nothing without either row disappearing. A void that
 * leaves no trace is indistinguishable from theft, which is exactly why the
 * rows stay.
 */
export function expectedCash(drawer: Drawer): {
  grossSalesMinor: number;
  refundsMinor: number;
  payoutsMinor: number;
  expectedMinor: number;
  voidedEntryIds: Set<string>;
} {
  const voidedEntryIds = new Set<string>();
  for (const entry of drawer.entries) {
    if (entry.kind === "VOID" && entry.voidsEntryId) {
      voidedEntryIds.add(entry.voidsEntryId);
    }
  }

  let grossSalesMinor = 0;
  let refundsMinor = 0;
  let payoutsMinor = 0;

  for (const entry of drawer.entries) {
    if (entry.kind === "SALE" && !voidedEntryIds.has(entry.id)) {
      grossSalesMinor += entry.amountMinor;
    } else if (entry.kind === "REFUND") {
      refundsMinor += entry.amountMinor;
    } else if (entry.kind === "PAYOUT") {
      payoutsMinor += entry.amountMinor;
    }
  }

  const openingFloatMinor = countTotal(drawer.opening);

  return {
    grossSalesMinor,
    refundsMinor,
    payoutsMinor,
    expectedMinor: openingFloatMinor + grossSalesMinor - refundsMinor - payoutsMinor,
    voidedEntryIds,
  };
}

/**
 * Grades the difference.
 *
 * An overage is not benign and is graded exactly as a shortage would be: money
 * in the drawer that the ledger does not know about usually means a sale went
 * unrecorded, which is the same failure seen from the other side.
 */
export function classifyVariance(
  varianceMinor: number,
  takingsMinor: number,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS,
): VarianceBand {
  const magnitude = Math.abs(varianceMinor);

  if (magnitude === 0) return "BALANCED";
  if (magnitude <= thresholds.toleranceMinor) return "WITHIN_TOLERANCE";

  if (magnitude >= thresholds.escalateMinor) return "ESCALATE";

  if (takingsMinor > 0) {
    const fraction = magnitude / takingsMinor;
    if (fraction >= thresholds.escalateFraction) return "ESCALATE";
    if (fraction >= thresholds.investigateFraction) return "INVESTIGATE";
    return "WITHIN_TOLERANCE";
  }

  // Cash in a drawer that took nothing has no proportion to be measured
  // against, and is an anomaly by its existence.
  return "ESCALATE";
}

/** Reconciles one drawer against its own entries. */
export function reconcileDrawer(
  drawer: Drawer,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS,
): DrawerReconciliation {
  const { grossSalesMinor, refundsMinor, payoutsMinor, expectedMinor, voidedEntryIds } =
    expectedCash(drawer);

  const openingFloatMinor = countTotal(drawer.opening);
  const countedMinor = drawer.closing ? countTotal(drawer.closing) : 0;

  const compCount = drawer.entries.filter((entry) => entry.kind === "COMP").length;
  const voidCount = drawer.entries.filter((entry) => entry.kind === "VOID").length;

  const admittedCount = drawer.entries.filter(
    (entry) => (entry.kind === "SALE" && !voidedEntryIds.has(entry.id)) || entry.kind === "COMP",
  ).length;

  const anomalies: string[] = [...implausibleQuantities(drawer.opening)];

  if (!drawer.closing) {
    anomalies.push("The drawer has not been counted down; the reconciliation is incomplete.");
  } else {
    anomalies.push(...implausibleQuantities(drawer.closing));
  }

  // A void naming an entry that is not in this drawer cannot be checked, and
  // an unverifiable reversal is worth surfacing rather than trusting.
  const entryIds = new Set(drawer.entries.map((entry) => entry.id));
  for (const entry of drawer.entries) {
    if (entry.kind === "VOID" && entry.voidsEntryId && !entryIds.has(entry.voidsEntryId)) {
      anomalies.push(
        `Void ${entry.id} references sale ${entry.voidsEntryId}, which is not in this drawer.`,
      );
    }
    if (entry.kind === "VOID" && !entry.reason) {
      anomalies.push(`Void ${entry.id} has no reason recorded.`);
    }
    if (entry.kind === "COMP" && entry.amountMinor !== 0) {
      anomalies.push(`Comp ${entry.id} carries a non-zero amount.`);
    }
  }

  const varianceMinor = drawer.closing ? countedMinor - expectedMinor : 0;
  const band = drawer.closing
    ? classifyVariance(varianceMinor, grossSalesMinor, thresholds)
    : "ESCALATE";

  return {
    drawerId: drawer.drawerId,
    label: drawer.label,
    openingFloatMinor,
    grossSalesMinor,
    refundsMinor,
    payoutsMinor,
    compCount,
    voidCount,
    expectedMinor,
    countedMinor,
    varianceMinor,
    band,
    balanced: drawer.closing !== null && varianceMinor === 0,
    admittedCount,
    anomalies: anomalies.sort(),
  };
}

export interface EventReconciliation {
  eventId: string;
  drawers: DrawerReconciliation[];
  totalExpectedMinor: number;
  totalCountedMinor: number;
  totalVarianceMinor: number;
  band: VarianceBand;
  /** Drawers that did not balance, so the sound ones are not searched. */
  offending: DrawerReconciliation[];
  totalAdmitted: number;
}

/**
 * Reconciles every drawer at an event independently, then rolls them up.
 *
 * Independently, because a single shortfall is enormously easier to locate when
 * the other two doors balance. Merging the counts at the point of counting
 * throws that information away permanently, and it cannot be recovered later.
 */
export function reconcileEvent(
  drawers: ReadonlyArray<Drawer>,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS,
): EventReconciliation {
  const reconciled = drawers
    .map((drawer) => reconcileDrawer(drawer, thresholds))
    .sort((a, b) => a.label.localeCompare(b.label) || a.drawerId.localeCompare(b.drawerId));

  const totalExpectedMinor = reconciled.reduce((sum, entry) => sum + entry.expectedMinor, 0);
  const totalCountedMinor = reconciled.reduce((sum, entry) => sum + entry.countedMinor, 0);
  const totalSalesMinor = reconciled.reduce((sum, entry) => sum + entry.grossSalesMinor, 0);
  const totalVarianceMinor = totalCountedMinor - totalExpectedMinor;

  return {
    eventId: drawers[0]?.eventId ?? "",
    drawers: reconciled,
    totalExpectedMinor,
    totalCountedMinor,
    totalVarianceMinor,
    band: classifyVariance(totalVarianceMinor, totalSalesMinor, thresholds),
    offending: reconciled.filter(
      (entry) => entry.band !== "BALANCED" && entry.band !== "WITHIN_TOLERANCE",
    ),
    totalAdmitted: reconciled.reduce((sum, entry) => sum + entry.admittedCount, 0),
  };
}

export type CustodyFaultKind =
  "AMOUNT_CHANGED" | "BROKEN_CHAIN" | "UNRECONCILED_HOLDER" | "OUT_OF_ORDER";

export interface CustodyFault {
  kind: CustodyFaultKind;
  /** The handover the fault sits on, so the loss is located rather than totalled. */
  transferId: string;
  fromUserId: string;
  toUserId: string;
  deltaMinor: number;
  explanation: string;
}

/**
 * Walks the handover chain from the door to the deposit.
 *
 * The value here is naming the *segment* where the money changed rather than
 * reporting an end-to-end mismatch. "We are $180 short somewhere between the
 * door and the bank" is not something anybody can act on; "the amount dropped
 * by $180 between the second and third handover" is.
 */
export function validateCustodyChain(
  transfers: ReadonlyArray<CustodyTransfer>,
  startingAmountMinor: number,
): { faults: CustodyFault[]; finalHolder: string | null; finalAmountMinor: number } {
  const ordered = [...transfers].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
      a.id.localeCompare(b.id),
  );

  const faults: CustodyFault[] = [];
  let expectedAmount = startingAmountMinor;
  let holder: string | null = null;

  for (const transfer of ordered) {
    if (holder !== null && transfer.fromUserId !== holder) {
      faults.push({
        kind: "BROKEN_CHAIN",
        transferId: transfer.id,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        deltaMinor: 0,
        explanation:
          `${transfer.fromUserId} handed over money that ${holder} was last recorded as holding. ` +
          `There is no handover between them.`,
      });
    }

    if (transfer.amountMinor !== expectedAmount) {
      faults.push({
        kind: "AMOUNT_CHANGED",
        transferId: transfer.id,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        deltaMinor: transfer.amountMinor - expectedAmount,
        explanation:
          `The amount changed by ${transfer.amountMinor - expectedAmount} minor units between ` +
          `${holder ?? "the drawer"} and ${transfer.toUserId}.`,
      });
    }

    if (transfer.fromUserId === transfer.toUserId) {
      faults.push({
        kind: "OUT_OF_ORDER",
        transferId: transfer.id,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        deltaMinor: 0,
        explanation: "A handover cannot be to the person who already holds the money.",
      });
    }

    expectedAmount = transfer.amountMinor;
    holder = transfer.toUserId;
  }

  return { faults, finalHolder: holder, finalAmountMinor: expectedAmount };
}

/**
 * Converts a reconciliation into ledger records.
 *
 * This is the point of the whole exercise: cash becomes part of the club's
 * balance through the same `FinancialTransaction` shape that
 * `calculateClubBalanceSummary` and `generateAuditCsvReport` already consume,
 * rather than living in a parallel spreadsheet.
 *
 * The float is deliberately not income — it was the club's money before the
 * doors opened and counting it as takings would inflate every event by the
 * size of its own change box. A variance is posted as its own line rather than
 * being folded into the takings, because a total that has silently absorbed a
 * discrepancy is exactly what an audit is trying to see through.
 */
export function toFinancialTransactions(
  reconciliation: DrawerReconciliation,
  context: { clubId: string; eventId: string; settledAt: string },
): FinancialTransaction[] {
  const toMajor = (minor: number) => Number((minor / 100).toFixed(2));
  const transactions: FinancialTransaction[] = [];

  if (reconciliation.grossSalesMinor > 0) {
    transactions.push({
      id: `${reconciliation.drawerId}_sales`,
      clubId: context.clubId,
      amount: toMajor(reconciliation.grossSalesMinor),
      transactionType: "INCOME",
      category: "Door Sales (Cash)",
      description: `Cash door sales at ${reconciliation.label} for event ${context.eventId}.`,
      createdAt: context.settledAt,
    });
  }

  if (reconciliation.refundsMinor > 0) {
    transactions.push({
      id: `${reconciliation.drawerId}_refunds`,
      clubId: context.clubId,
      amount: -toMajor(reconciliation.refundsMinor),
      transactionType: "EXPENSE",
      category: "Door Refunds (Cash)",
      description: `Cash refunds issued at ${reconciliation.label}.`,
      createdAt: context.settledAt,
    });
  }

  if (reconciliation.varianceMinor !== 0) {
    const shortage = reconciliation.varianceMinor < 0;
    transactions.push({
      id: `${reconciliation.drawerId}_variance`,
      clubId: context.clubId,
      amount: toMajor(reconciliation.varianceMinor),
      transactionType: shortage ? "EXPENSE" : "INCOME",
      category: shortage ? "Cash Shortage" : "Cash Overage",
      description:
        `${shortage ? "Shortage" : "Overage"} of ${Math.abs(toMajor(reconciliation.varianceMinor))} ` +
        `at ${reconciliation.label} (${reconciliation.band}).`,
      createdAt: context.settledAt,
    });
  }

  return transactions;
}
