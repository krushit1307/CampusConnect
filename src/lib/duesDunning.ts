/**
 * Club membership dues: billing periods, proration, standing and dunning.
 *
 * Treasurers currently chase dues by hand, which means a member's standing
 * depends on who is doing the chasing and how recently they looked at the
 * spreadsheet. This module turns that into arithmetic: given a plan, a set of
 * invoices and today's date, it decides what each member owes, what standing
 * they are in, and which reminder is due next.
 *
 * Every amount is an integer number of minor units (cents). Dates are ISO
 * calendar dates (YYYY-MM-DD) handled in UTC, so a treasurer in a different
 * timezone sees the same standing as the member does.
 */

/** How often the club charges dues. */
export type BillingPeriod = "monthly" | "semester" | "annual";

/** How a member who joins mid-cycle is charged. */
export type ProrationPolicy = "daily" | "none" | "half_cycle";

/** Where a member sits against their invoice today. */
export type MemberStanding = "paid" | "pending" | "grace" | "delinquent" | "suspended" | "waived";

/** Lifecycle of a single dues invoice. */
export type InvoiceStatus = "issued" | "paid" | "waived" | "void";

/** Channel a dunning reminder goes out on. */
export type DunningChannel = "email" | "push" | "in_app";

export interface DunningStep {
  /** Stable identifier recorded once the step has been sent. */
  key: string;
  /** Days after the due date this step fires. Negative values pre-warn. */
  offsetDays: number;
  channel: DunningChannel;
  template: string;
}

export interface DuesPlan {
  id: string;
  clubId: string;
  amountCents: number;
  billingPeriod: BillingPeriod;
  /** Date the first billing cycle started, e.g. the start of the academic year. */
  cycleAnchor: string;
  /** Days after the due date before a member loses good standing. */
  graceDays: number;
  /** Days after the due date before membership is suspended. */
  suspendAfterDays: number;
  proration: ProrationPolicy;
  dunningSteps: DunningStep[];
}

export interface DuesInvoice {
  id: string;
  memberId: string;
  planId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDueCents: number;
  amountPaidCents: number;
  status: InvoiceStatus;
  /** Keys of dunning steps already sent for this invoice. */
  sentStepKeys: string[];
}

export interface CollectionSummary {
  invoiceCount: number;
  collectedCents: number;
  outstandingCents: number;
  waivedCount: number;
  delinquentCount: number;
  suspendedCount: number;
  /** Collected as a share of everything actually billed, 0 to 1. */
  collectionRate: number;
}

/** Number of whole months in each billing period. */
export const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  semester: 6,
  annual: 12,
};

/**
 * Start and end of the billing period that contains `asOf`, counting forward
 * from the plan's anchor date. The end date is inclusive, which is what a
 * member expects when they are told their cover runs "to the 31st".
 */
export function periodBoundsFor(
  plan: DuesPlan,
  asOf: string,
): { periodStart: string; periodEnd: string } {
  const months = PERIOD_MONTHS[plan.billingPeriod];
  const anchor = parseIsoDate(plan.cycleAnchor);
  const target = parseIsoDate(asOf);

  if (!anchor || !target || target < anchor) {
    const fallbackEnd = addDays(addMonths(plan.cycleAnchor, months), -1);
    return { periodStart: plan.cycleAnchor, periodEnd: fallbackEnd };
  }

  const elapsedMonths =
    (target.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - anchor.getUTCMonth());

  let cycles = Math.floor(elapsedMonths / months);
  let periodStart = addMonths(plan.cycleAnchor, cycles * months);

  // The day of month can push us into the previous cycle, e.g. an anchor on the
  // 15th with a date on the 3rd of the following month.
  if (parseIsoDate(periodStart)! > target) {
    cycles -= 1;
    periodStart = addMonths(plan.cycleAnchor, cycles * months);
  }

  return {
    periodStart,
    periodEnd: addDays(addMonths(periodStart, months), -1),
  };
}

/**
 * What a member joining part way through a cycle should be charged.
 *
 * Daily proration charges for the days actually covered. Half cycle charges
 * full price up to the midpoint and half after it. The result is always a whole
 * number of cents between zero and the full plan amount.
 */
export function prorateAmount(
  plan: DuesPlan,
  joinDate: string,
  periodStart: string,
  periodEnd: string,
): number {
  const full = Math.max(0, Math.round(plan.amountCents));
  if (full === 0 || plan.proration === "none") return full;

  const start = parseIsoDate(periodStart);
  const end = parseIsoDate(periodEnd);
  const join = parseIsoDate(joinDate);
  if (!start || !end || !join || end < start) return full;

  if (join <= start) return full;
  if (join > end) return 0;

  const totalDays = daysBetween(periodStart, periodEnd) + 1;
  const remainingDays = daysBetween(joinDate, periodEnd) + 1;

  if (plan.proration === "half_cycle") {
    const midpoint = addDays(periodStart, Math.floor(totalDays / 2));
    return join < parseIsoDate(midpoint)! ? full : Math.round(full / 2);
  }

  const prorated = Math.round((full * remainingDays) / totalDays);
  return Math.min(full, Math.max(0, prorated));
}

/** What is still owed on an invoice. Overpayment never goes negative. */
export function outstandingCents(invoice: DuesInvoice): number {
  if (invoice.status === "waived" || invoice.status === "void") return 0;
  const due = Math.max(0, Math.round(invoice.amountDueCents));
  const paid = Math.max(0, Math.round(invoice.amountPaidCents));
  return Math.max(0, due - paid);
}

/**
 * Standing of a member against one invoice.
 *
 * This is a pure function of the invoice and the date, so the roster, the
 * reminder job and the election eligibility check can never disagree about
 * whether somebody is in arrears.
 */
export function standingFor(plan: DuesPlan, invoice: DuesInvoice, asOf: string): MemberStanding {
  if (invoice.status === "waived") return "waived";
  if (invoice.status === "void") return "paid";
  if (outstandingCents(invoice) === 0) return "paid";

  const daysLate = daysBetween(invoice.dueDate, asOf);
  if (daysLate <= 0) return "pending";

  const graceDays = Math.max(0, plan.graceDays);
  const suspendAfter = Math.max(graceDays, plan.suspendAfterDays);

  if (daysLate <= graceDays) return "grace";
  if (daysLate <= suspendAfter) return "delinquent";
  return "suspended";
}

/**
 * The dunning step that is due now, or null when nothing should be sent.
 *
 * Only one step is returned per call: if a member has been ignored for weeks
 * the treasurer sends the latest applicable reminder, not the whole backlog.
 * Fully paid and waived invoices are never chased.
 */
export function nextDunningStep(
  plan: DuesPlan,
  invoice: DuesInvoice,
  asOf: string,
): DunningStep | null {
  const standing = standingFor(plan, invoice, asOf);
  if (standing === "paid" || standing === "waived") return null;

  const sent = new Set(invoice.sentStepKeys ?? []);
  const dueSteps = [...plan.dunningSteps]
    .filter((step) => !sent.has(step.key))
    .filter((step) => daysBetween(invoice.dueDate, asOf) >= step.offsetDays)
    .sort((a, b) => a.offsetDays - b.offsetDays);

  return dueSteps.length > 0 ? dueSteps[dueSteps.length - 1] : null;
}

/**
 * Every reminder that is currently overdue, latest first. Useful for showing a
 * treasurer what a member has already been sent versus what is waiting.
 */
export function pendingDunningSteps(
  plan: DuesPlan,
  invoice: DuesInvoice,
  asOf: string,
): DunningStep[] {
  const standing = standingFor(plan, invoice, asOf);
  if (standing === "paid" || standing === "waived") return [];

  const sent = new Set(invoice.sentStepKeys ?? []);
  return [...plan.dunningSteps]
    .filter((step) => !sent.has(step.key))
    .filter((step) => daysBetween(invoice.dueDate, asOf) >= step.offsetDays)
    .sort((a, b) => b.offsetDays - a.offsetDays);
}

/** Club-wide collection position for a set of invoices. */
export function summariseCollections(
  plan: DuesPlan,
  invoices: DuesInvoice[],
  asOf: string,
): CollectionSummary {
  let collectedCents = 0;
  let outstanding = 0;
  let billedCents = 0;
  let waivedCount = 0;
  let delinquentCount = 0;
  let suspendedCount = 0;

  for (const invoice of invoices) {
    const standing = standingFor(plan, invoice, asOf);

    if (standing === "waived") {
      waivedCount += 1;
      continue;
    }
    if (invoice.status === "void") continue;

    billedCents += Math.max(0, Math.round(invoice.amountDueCents));
    collectedCents += Math.min(
      Math.max(0, Math.round(invoice.amountPaidCents)),
      Math.max(0, Math.round(invoice.amountDueCents)),
    );
    outstanding += outstandingCents(invoice);

    if (standing === "delinquent") delinquentCount += 1;
    if (standing === "suspended") suspendedCount += 1;
  }

  return {
    invoiceCount: invoices.length,
    collectedCents,
    outstandingCents: outstanding,
    waivedCount,
    delinquentCount,
    suspendedCount,
    collectionRate: billedCents === 0 ? 1 : collectedCents / billedCents,
  };
}

/** Whether a member in this standing keeps their member-only privileges. */
export function isInGoodStanding(standing: MemberStanding): boolean {
  return standing === "paid" || standing === "waived" || standing === "pending";
}

/** Label for the roster, e.g. "In arrears (14 days)". */
export function describeStanding(
  plan: DuesPlan,
  invoice: DuesInvoice,
  asOf: string,
): { standing: MemberStanding; label: string } {
  const standing = standingFor(plan, invoice, asOf);
  const daysLate = Math.max(0, daysBetween(invoice.dueDate, asOf));

  switch (standing) {
    case "paid":
      return { standing, label: "Paid" };
    case "waived":
      return { standing, label: "Waived" };
    case "pending":
      return { standing, label: `Due ${invoice.dueDate}` };
    case "grace":
      return { standing, label: `In grace period (${daysLate} days late)` };
    case "delinquent":
      return { standing, label: `In arrears (${daysLate} days)` };
    default:
      return { standing, label: `Suspended (${daysLate} days late)` };
  }
}

// ---------------------------------------------------------------------------
// Date helpers. Everything is UTC so a member's standing does not depend on
// which side of midnight the treasurer happens to be looking from.
// ---------------------------------------------------------------------------

/** Parses YYYY-MM-DD into a UTC date, or null when it cannot be read. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a UTC date back to YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Adds whole days to an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/**
 * Adds whole months, clamping the day of month so that adding a month to the
 * 31st of January lands on the last day of February rather than in March.
 */
export function addMonths(isoDate: string, months: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;

  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();

  shifted.setUTCDate(Math.min(day, daysInMonth));
  return toIsoDate(shifted);
}
