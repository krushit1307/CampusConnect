/**
 * Ticket resale guard.
 *
 * Transfers exist so that a student who falls ill can pass their ticket to a
 * friend. Left unconstrained they turn into a secondary market: a handful of
 * accounts buy in bulk, flip at three times face value, and the people the
 * event was for end up locked out.
 *
 * This module decides whether a proposed transfer is allowed, needs a human to
 * look at it, or has to be blocked outright. It is deliberately pure so the
 * same evaluation runs in the browser (to warn the seller before they agree a
 * price) and on the server (to actually enforce it). The two can never disagree
 * about the rules, only about how fresh their data is.
 */

/** How the organiser caps what a ticket may be resold for. */
export type PriceCapMode = "face_value" | "percentage" | "fixed_ceiling" | "free_only";

/** Outcome of evaluating a proposed transfer. */
export type TransferDecision = "allow" | "review" | "block";

/** Machine readable reason a transfer failed a rule. */
export type ViolationCode =
  | "self_transfer"
  | "paid_transfer_not_allowed"
  | "price_above_cap"
  | "cooldown_active"
  | "ticket_transfer_limit"
  | "seller_resale_limit"
  | "circular_transfer"
  | "event_already_started";

export interface ResalePolicy {
  eventId: string;
  capMode: PriceCapMode;
  /** Percent uplift for `percentage`, cents for `fixed_ceiling`. Ignored otherwise. */
  capValue: number;
  /** Minimum hours between consecutive transfers of the same ticket. */
  cooldownHours: number;
  /** How many times one ticket may ever change hands. */
  maxTransfersPerTicket: number;
  /** How many tickets one seller may pass on for this event. */
  maxResalesPerSeller: number;
  /** Risk score at or above which a transfer is held for review. */
  reviewRiskThreshold: number;
  /** Transfers inside this many hours of the doors opening are reviewed. */
  finalHoursReviewWindow: number;
}

export interface TicketContext {
  ticketId: string;
  faceValueCents: number;
  /** How many times this ticket has already been transferred. */
  transferCount: number;
  /** ISO timestamp of the most recent transfer, or null if never transferred. */
  lastTransferAt: string | null;
  /** Everyone who has held this ticket, used to catch laundering loops. */
  previousHolderIds: string[];
}

export interface SellerContext {
  sellerId: string;
  accountAgeDays: number;
  /** Share of past events the seller RSVP'd to and did not attend, 0 to 1. */
  priorNoShowRate: number;
  /** Tickets this account currently holds for the same event. */
  ticketsHeldForEvent: number;
  /** Tickets this account has already passed on for this event. */
  resalesThisEvent: number;
  /** Transfers initiated by this account in the last 24 hours. */
  transfersLast24h: number;
}

export interface TransferRequest {
  sellerId: string;
  buyerId: string;
  askingPriceCents: number;
  /** ISO timestamp of the request. */
  requestedAt: string;
  /** ISO timestamp the event starts. */
  eventStartsAt: string;
}

export interface Violation {
  code: ViolationCode;
  message: string;
}

export interface RiskFactor {
  label: string;
  points: number;
}

export interface TransferAssessment {
  decision: TransferDecision;
  violations: Violation[];
  riskScore: number;
  riskFactors: RiskFactor[];
  /** Highest price this ticket may legally be sold for, in cents. */
  maxPriceCents: number;
  /** One line the seller and buyer both see. */
  summary: string;
}

/** Risk points awarded per factor. Kept in one place so a tweak is one diff. */
export const RISK_WEIGHTS = {
  brandNewAccount: 40,
  youngAccount: 25,
  noShowHistory: 25,
  extraTicketsHeld: 12,
  transfersPerDay: 10,
  nearEventWindow: 15,
} as const;

/** Account younger than this many days counts as brand new. */
export const BRAND_NEW_ACCOUNT_DAYS = 7;

/** Account younger than this many days counts as young. */
export const YOUNG_ACCOUNT_DAYS = 30;

/** Tickets a genuine attendee might reasonably hold for one event. */
export const NORMAL_TICKETS_HELD = 2;

/**
 * The most a ticket may be sold for under this policy.
 *
 * A free-only policy returns zero, which is the whole point: the ticket may
 * move, the money may not.
 */
export function maximumPriceCents(policy: ResalePolicy, ticket: TicketContext): number {
  const faceValue = Math.max(0, Math.round(ticket.faceValueCents));

  switch (policy.capMode) {
    case "free_only":
      return 0;
    case "face_value":
      return faceValue;
    case "percentage": {
      const uplift = Math.max(0, policy.capValue);
      return Math.round(faceValue * (1 + uplift / 100));
    }
    case "fixed_ceiling":
      return Math.max(0, Math.round(policy.capValue));
    default:
      return faceValue;
  }
}

/**
 * Hard rules. Every one of these blocks the transfer on its own, and each has a
 * distinct code so the UI can explain precisely what went wrong.
 */
export function findViolations(
  policy: ResalePolicy,
  ticket: TicketContext,
  seller: SellerContext,
  request: TransferRequest,
): Violation[] {
  const violations: Violation[] = [];
  const price = Math.max(0, Math.round(request.askingPriceCents));
  const maxPrice = maximumPriceCents(policy, ticket);

  if (request.sellerId === request.buyerId) {
    violations.push({
      code: "self_transfer",
      message: "A ticket cannot be transferred to the account that already holds it.",
    });
  }

  if (policy.capMode === "free_only" && price > 0) {
    violations.push({
      code: "paid_transfer_not_allowed",
      message: "This organiser only permits free transfers.",
    });
  } else if (price > maxPrice) {
    violations.push({
      code: "price_above_cap",
      message: `The asking price is above the ${formatCents(maxPrice)} cap for this ticket.`,
    });
  }

  if (ticket.transferCount >= policy.maxTransfersPerTicket) {
    violations.push({
      code: "ticket_transfer_limit",
      message: `This ticket has already changed hands ${ticket.transferCount} times, which is the limit.`,
    });
  }

  const hoursSinceLastTransfer = hoursBetween(ticket.lastTransferAt, request.requestedAt);
  if (hoursSinceLastTransfer !== null && hoursSinceLastTransfer < policy.cooldownHours) {
    const remaining = Math.ceil(policy.cooldownHours - hoursSinceLastTransfer);
    violations.push({
      code: "cooldown_active",
      message: `This ticket was transferred recently. It can move again in ${remaining} hour${
        remaining === 1 ? "" : "s"
      }.`,
    });
  }

  if (seller.resalesThisEvent >= policy.maxResalesPerSeller) {
    violations.push({
      code: "seller_resale_limit",
      message: `You have already passed on ${seller.resalesThisEvent} tickets for this event.`,
    });
  }

  if (ticket.previousHolderIds.includes(request.buyerId)) {
    violations.push({
      code: "circular_transfer",
      message: "This ticket has already been held by that account.",
    });
  }

  const hoursUntilEvent = hoursBetween(request.requestedAt, request.eventStartsAt);
  if (hoursUntilEvent !== null && hoursUntilEvent < 0) {
    violations.push({
      code: "event_already_started",
      message: "The event has already started, so tickets can no longer be transferred.",
    });
  }

  return violations;
}

/**
 * Soft signals, scored 0 to 100.
 *
 * None of these is proof of anything on its own. A new account transferring a
 * ticket the night before a sold-out event is usually a friend doing a favour,
 * so a high score sends the transfer for review rather than refusing it.
 */
export function computeRiskScore(
  policy: ResalePolicy,
  ticket: TicketContext,
  seller: SellerContext,
  request: TransferRequest,
): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];

  if (seller.accountAgeDays < BRAND_NEW_ACCOUNT_DAYS) {
    factors.push({ label: "Account opened this week", points: RISK_WEIGHTS.brandNewAccount });
  } else if (seller.accountAgeDays < YOUNG_ACCOUNT_DAYS) {
    factors.push({ label: "Account less than a month old", points: RISK_WEIGHTS.youngAccount });
  }

  const noShowRate = clamp01(seller.priorNoShowRate);
  if (noShowRate > 0) {
    factors.push({
      label: `${Math.round(noShowRate * 100)}% no-show history`,
      points: Math.round(noShowRate * RISK_WEIGHTS.noShowHistory),
    });
  }

  const extraTickets = Math.max(0, seller.ticketsHeldForEvent - NORMAL_TICKETS_HELD);
  if (extraTickets > 0) {
    factors.push({
      label: `Holding ${seller.ticketsHeldForEvent} tickets for this event`,
      points: Math.min(24, extraTickets * RISK_WEIGHTS.extraTicketsHeld),
    });
  }

  if (seller.transfersLast24h > 0) {
    factors.push({
      label: `${seller.transfersLast24h} transfers in the last day`,
      points: Math.min(30, seller.transfersLast24h * RISK_WEIGHTS.transfersPerDay),
    });
  }

  const hoursUntilEvent = hoursBetween(request.requestedAt, request.eventStartsAt);
  if (
    hoursUntilEvent !== null &&
    hoursUntilEvent >= 0 &&
    hoursUntilEvent <= policy.finalHoursReviewWindow
  ) {
    factors.push({ label: "Transfer close to the event", points: RISK_WEIGHTS.nearEventWindow });
  }

  if (ticket.transferCount > 0) {
    factors.push({
      label: `Ticket already transferred ${ticket.transferCount} time${
        ticket.transferCount === 1 ? "" : "s"
      }`,
      points: Math.min(20, ticket.transferCount * 10),
    });
  }

  const score = Math.min(
    100,
    factors.reduce((total, factor) => total + factor.points, 0),
  );

  return { score, factors: factors.sort((a, b) => b.points - a.points) };
}

/**
 * Full assessment of a proposed transfer: allow it, hold it for review, or
 * block it, together with everything needed to explain that to a human.
 */
export function evaluateTransfer(
  policy: ResalePolicy,
  ticket: TicketContext,
  seller: SellerContext,
  request: TransferRequest,
): TransferAssessment {
  const violations = findViolations(policy, ticket, seller, request);
  const { score, factors } = computeRiskScore(policy, ticket, seller, request);
  const maxPriceCents = maximumPriceCents(policy, ticket);

  const hoursUntilEvent = hoursBetween(request.requestedAt, request.eventStartsAt);
  const insideFinalWindow =
    hoursUntilEvent !== null &&
    hoursUntilEvent >= 0 &&
    hoursUntilEvent <= policy.finalHoursReviewWindow;

  let decision: TransferDecision = "allow";
  if (violations.length > 0) {
    decision = "block";
  } else if (score >= policy.reviewRiskThreshold || insideFinalWindow) {
    decision = "review";
  }

  return {
    decision,
    violations,
    riskScore: score,
    riskFactors: factors,
    maxPriceCents,
    summary: summarise(decision, violations, maxPriceCents, policy),
  };
}

/** Human readable label for a violation code, for logs and organiser reports. */
export function describeViolation(code: ViolationCode): string {
  switch (code) {
    case "self_transfer":
      return "Transfer to self";
    case "paid_transfer_not_allowed":
      return "Paid transfer on a free-only event";
    case "price_above_cap":
      return "Asking price above the cap";
    case "cooldown_active":
      return "Transfer cooldown still running";
    case "ticket_transfer_limit":
      return "Ticket transfer limit reached";
    case "seller_resale_limit":
      return "Seller resale limit reached";
    case "circular_transfer":
      return "Ticket returning to a previous holder";
    default:
      return "Event already started";
  }
}

/** Sentence the buyer sees before they agree to anything. */
export function describePriceCap(policy: ResalePolicy, ticket: TicketContext): string {
  const max = maximumPriceCents(policy, ticket);
  if (policy.capMode === "free_only") {
    return "Tickets for this event may only be transferred free of charge.";
  }
  return `Tickets for this event may not be resold for more than ${formatCents(max)}.`;
}

function summarise(
  decision: TransferDecision,
  violations: Violation[],
  maxPriceCents: number,
  policy: ResalePolicy,
): string {
  if (decision === "block") {
    return violations[0].message;
  }
  if (decision === "review") {
    return "This transfer has been sent to the organiser for a quick check.";
  }
  return policy.capMode === "free_only"
    ? "Transfer allowed. No money may change hands."
    : `Transfer allowed, up to ${formatCents(maxPriceCents)}.`;
}

/** Hours from one ISO timestamp to another, or null when either is missing. */
export function hoursBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / 3_600_000;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatCents(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100).toLocaleString("en-US");
  const remainder = String(Math.abs(cents) % 100).padStart(2, "0");
  return `$${dollars}.${remainder}`;
}
