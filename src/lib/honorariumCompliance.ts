/**
 * Speaker honorarium tax compliance rules.
 *
 * Paying an outside speaker is only partly a finance problem. Before money can
 * leave the account the club has to know who the payee is for tax purposes,
 * whether the right form is on file and still valid, how much has to be
 * withheld, and whether this payee has crossed the annual reporting threshold
 * across every club that has ever booked them.
 *
 * All of that is decided here, away from Supabase and React, so the numbers can
 * be tested exactly. Money is handled in integer minor units (cents) end to
 * end — no floating point currency arithmetic anywhere in this module.
 */

/** Tax residency of the payee, which drives everything else. */
export type ResidencyStatus = "domestic" | "foreign_treaty" | "foreign_non_treaty";

/** Tax form the payee has actually returned. */
export type TaxFormType = "w9" | "w8ben" | "none";

/** Lifecycle of a single honorarium payment. */
export type PaymentStatus = "draft" | "approved" | "paid" | "cancelled";

/** Why the finance office cannot release a payment yet. */
export type ReleaseBlockReason =
  "missing_form" | "form_expired" | "form_mismatch" | "payment_cancelled";

/** Why an amount is being withheld from the gross honorarium. */
export type WithholdingReason = "none" | "backup_withholding" | "statutory_foreign" | "treaty_rate";

export interface HonorariumPayee {
  id: string;
  fullName: string;
  residency: ResidencyStatus;
  formType: TaxFormType;
  /** ISO date (YYYY-MM-DD) the form was signed. Null when nothing is on file. */
  formSignedOn: string | null;
  /** Treaty rate in percent, only meaningful for `foreign_treaty` payees. */
  treatyRatePercent?: number;
}

export interface HonorariumPayment {
  id: string;
  payeeId: string;
  clubId: string;
  grossCents: number;
  /** ISO date the speaker actually delivered the engagement. */
  engagementDate: string;
  status: PaymentStatus;
}

export interface PaymentEvaluation {
  paymentId: string;
  payeeId: string;
  grossCents: number;
  withholdingCents: number;
  netCents: number;
  withholdingRatePercent: number;
  withholdingReason: WithholdingReason;
  releasable: boolean;
  blockReason: ReleaseBlockReason | null;
  explanation: string;
}

export interface PayeeYearSummary {
  payeeId: string;
  taxYear: number;
  paymentCount: number;
  grossCents: number;
  withheldCents: number;
  netCents: number;
  /** True once gross earnings reach the annual reporting threshold. */
  requiresInformationReturn: boolean;
}

export interface YearEndPack {
  taxYear: number;
  totalGrossCents: number;
  totalWithheldCents: number;
  payeeSummaries: PayeeYearSummary[];
  /** Payees with no valid form on file who were nevertheless paid. */
  payeesMissingForms: string[];
  /** Payees who need a 1099-NEC issued. */
  payeesOverThreshold: string[];
  grossByClubCents: Array<{ clubId: string; grossCents: number }>;
}

/** Statutory rate applied to foreign payees with no treaty relief. */
export const STATUTORY_FOREIGN_RATE_PERCENT = 30;

/** Backup withholding applied when a domestic payee has no valid form. */
export const BACKUP_WITHHOLDING_RATE_PERCENT = 24;

/** Annual gross earnings at which an information return becomes due. */
export const REPORTING_THRESHOLD_CENTS = 60_000;

/**
 * A W-8BEN stays valid until the end of the third calendar year after it was
 * signed. A W-9 does not expire on its own.
 */
export const W8BEN_VALIDITY_YEARS = 3;

/** Form the payee is required to have returned for their residency status. */
export function requiredFormFor(residency: ResidencyStatus): Exclude<TaxFormType, "none"> {
  return residency === "domestic" ? "w9" : "w8ben";
}

/**
 * Last day the payee's form is good for, or null when nothing is on file and
 * when the form never expires.
 */
export function formExpiryDate(payee: HonorariumPayee): string | null {
  if (payee.formType !== "w8ben" || !payee.formSignedOn) return null;
  const signedYear = yearOf(payee.formSignedOn);
  if (signedYear === null) return null;
  return `${signedYear + W8BEN_VALIDITY_YEARS}-12-31`;
}

/** Whether the form on file is both the right type and still in date. */
export function isFormValidOn(payee: HonorariumPayee, asOf: string): boolean {
  if (payee.formType === "none" || !payee.formSignedOn) return false;
  if (payee.formType !== requiredFormFor(payee.residency)) return false;

  const expiry = formExpiryDate(payee);
  if (!expiry) return true;
  return compareIsoDates(asOf, expiry) <= 0;
}

/**
 * Rate that has to be withheld from a payment, and the reason for it.
 *
 * A domestic payee with a valid W-9 keeps the whole honorarium. Without one,
 * backup withholding applies. Foreign payees are withheld at the statutory rate
 * unless a treaty brings it down, which only counts when the W-8BEN supporting
 * the claim is valid.
 */
export function withholdingFor(
  payee: HonorariumPayee,
  asOf: string,
): { ratePercent: number; reason: WithholdingReason } {
  const formValid = isFormValidOn(payee, asOf);

  if (payee.residency === "domestic") {
    return formValid
      ? { ratePercent: 0, reason: "none" }
      : { ratePercent: BACKUP_WITHHOLDING_RATE_PERCENT, reason: "backup_withholding" };
  }

  if (payee.residency === "foreign_treaty" && formValid) {
    const treatyRate = clampPercent(payee.treatyRatePercent ?? STATUTORY_FOREIGN_RATE_PERCENT);
    return { ratePercent: treatyRate, reason: "treaty_rate" };
  }

  return { ratePercent: STATUTORY_FOREIGN_RATE_PERCENT, reason: "statutory_foreign" };
}

/**
 * Whether the finance office may release the payment, and if not, why.
 *
 * Withholding and release are separate questions. A payment can have a
 * perfectly well defined withholding rate and still be blocked because the
 * paperwork behind it is missing.
 */
export function releaseDecision(
  payee: HonorariumPayee,
  payment: HonorariumPayment,
): { releasable: boolean; blockReason: ReleaseBlockReason | null } {
  if (payment.status === "cancelled") {
    return { releasable: false, blockReason: "payment_cancelled" };
  }
  if (payee.formType === "none" || !payee.formSignedOn) {
    return { releasable: false, blockReason: "missing_form" };
  }
  if (payee.formType !== requiredFormFor(payee.residency)) {
    return { releasable: false, blockReason: "form_mismatch" };
  }
  if (!isFormValidOn(payee, payment.engagementDate)) {
    return { releasable: false, blockReason: "form_expired" };
  }
  return { releasable: true, blockReason: null };
}

/** Full assessment of one payment: what is withheld, what is paid, what blocks it. */
export function evaluatePayment(
  payee: HonorariumPayee,
  payment: HonorariumPayment,
): PaymentEvaluation {
  const gross = Math.max(0, Math.round(payment.grossCents));
  const { ratePercent, reason } = withholdingFor(payee, payment.engagementDate);
  const withholdingCents = Math.min(gross, Math.round((gross * ratePercent) / 100));
  const { releasable, blockReason } = releaseDecision(payee, payment);

  return {
    paymentId: payment.id,
    payeeId: payee.id,
    grossCents: gross,
    withholdingCents,
    netCents: gross - withholdingCents,
    withholdingRatePercent: ratePercent,
    withholdingReason: reason,
    releasable,
    blockReason,
    explanation: explain(payee, ratePercent, reason, blockReason),
  };
}

/**
 * Year-to-date position for one payee across every club that has paid them.
 * Cancelled payments are ignored; drafts are included, because a treasurer
 * needs to see the threshold coming before they commit to it.
 */
export function summarisePayeeYear(
  payee: HonorariumPayee,
  payments: HonorariumPayment[],
  taxYear: number,
): PayeeYearSummary {
  const relevant = payments.filter(
    (payment) =>
      payment.payeeId === payee.id &&
      payment.status !== "cancelled" &&
      yearOf(payment.engagementDate) === taxYear,
  );

  let grossCents = 0;
  let withheldCents = 0;

  for (const payment of relevant) {
    const evaluation = evaluatePayment(payee, payment);
    grossCents += evaluation.grossCents;
    withheldCents += evaluation.withholdingCents;
  }

  return {
    payeeId: payee.id,
    taxYear,
    paymentCount: relevant.length,
    grossCents,
    withheldCents,
    netCents: grossCents - withheldCents,
    requiresInformationReturn:
      payee.residency === "domestic" && grossCents >= REPORTING_THRESHOLD_CENTS,
  };
}

/**
 * Everything the finance office needs at year end: per-payee totals, who still
 * owes paperwork, who needs an information return, and the spend per club.
 */
export function buildYearEndPack(
  payees: HonorariumPayee[],
  payments: HonorariumPayment[],
  taxYear: number,
): YearEndPack {
  const payeeSummaries: PayeeYearSummary[] = [];
  const payeesMissingForms: string[] = [];
  const payeesOverThreshold: string[] = [];
  const grossByClub = new Map<string, number>();

  for (const payee of payees) {
    const summary = summarisePayeeYear(payee, payments, taxYear);
    if (summary.paymentCount === 0) continue;

    payeeSummaries.push(summary);
    if (summary.requiresInformationReturn) payeesOverThreshold.push(payee.id);

    const paidInYear = payments.filter(
      (payment) =>
        payment.payeeId === payee.id &&
        payment.status !== "cancelled" &&
        yearOf(payment.engagementDate) === taxYear,
    );

    if (paidInYear.some((payment) => !isFormValidOn(payee, payment.engagementDate))) {
      payeesMissingForms.push(payee.id);
    }

    for (const payment of paidInYear) {
      grossByClub.set(
        payment.clubId,
        (grossByClub.get(payment.clubId) ?? 0) + Math.max(0, Math.round(payment.grossCents)),
      );
    }
  }

  return {
    taxYear,
    totalGrossCents: payeeSummaries.reduce((total, row) => total + row.grossCents, 0),
    totalWithheldCents: payeeSummaries.reduce((total, row) => total + row.withheldCents, 0),
    payeeSummaries: payeeSummaries.sort((a, b) => b.grossCents - a.grossCents),
    payeesMissingForms,
    payeesOverThreshold,
    grossByClubCents: [...grossByClub.entries()]
      .map(([clubId, grossCents]) => ({ clubId, grossCents }))
      .sort((a, b) => b.grossCents - a.grossCents),
  };
}

/** Formats integer cents for display, e.g. 125050 becomes "$1,250.50". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(Math.round(cents));
  const dollars = Math.floor(absolute / 100).toLocaleString("en-US");
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars}.${remainder}`;
}

/** Human readable label for a block reason, for the treasurer's dashboard. */
export function describeBlockReason(reason: ReleaseBlockReason | null): string {
  switch (reason) {
    case "missing_form":
      return "No tax form on file";
    case "form_expired":
      return "Tax form has expired";
    case "form_mismatch":
      return "Wrong tax form for this residency";
    case "payment_cancelled":
      return "Payment was cancelled";
    default:
      return "Cleared for release";
  }
}

function explain(
  payee: HonorariumPayee,
  ratePercent: number,
  reason: WithholdingReason,
  blockReason: ReleaseBlockReason | null,
): string {
  if (blockReason) {
    return `${describeBlockReason(blockReason)} — collect a ${requiredFormFor(
      payee.residency,
    ).toUpperCase()} before releasing this payment.`;
  }
  switch (reason) {
    case "treaty_rate":
      return `Treaty rate of ${ratePercent}% applied under the payee's W-8BEN claim.`;
    case "statutory_foreign":
      return `Statutory ${ratePercent}% withholding applied to a foreign payee.`;
    case "backup_withholding":
      return `Backup withholding of ${ratePercent}% applied while the W-9 is outstanding.`;
    default:
      return "No withholding due.";
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, value);
}

/** Calendar year of an ISO date, or null when the date cannot be read. */
export function yearOf(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  return match ? Number(match[1]) : null;
}

/** Compares two ISO dates lexicographically, which is also chronologically. */
function compareIsoDates(left: string, right: string): number {
  const a = (left ?? "").slice(0, 10);
  const b = (right ?? "").slice(0, 10);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
