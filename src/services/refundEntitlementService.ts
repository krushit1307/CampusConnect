/**
 * Module: Ticket Refund Entitlement Engine
 * File: src/services/refundEntitlementService.ts
 * Scope: Classifies a refund request by cause before it computes an amount,
 *        decomposes that amount by tender rather than by percentage, and treats
 *        a material change as a declared event that opens a bounded window over
 *        the tickets sold before it (#5011).
 *
 * A cancellation by the organiser and a change of mind by the buyer are
 * opposite events that happen to produce the same bank transaction. The first
 * is an obligation with a deadline attached; the second is discretion, and
 * discretion granted inconsistently is what generates the complaint. Recording
 * both as a refunded status throws away the only fact anyone later argues
 * about, so cause is an input here rather than something inferred from an
 * amount.
 *
 * The cooling-off right that buyers cite does not apply to a ticket for a
 * specific dated event. That exemption is encoded rather than left to whoever
 * is on the box office, so a buyer's-remorse request is answered as
 * discretionary — still answerable, still grantable, but not owed — while the
 * same request against an undated item is owed outright.
 *
 * Materiality is a judgement but not a free one. A support act change is not
 * the headliner being replaced and a room change within a building is not the
 * event moving three miles, so the kinds that count are enumerated. A declared
 * change opens a window measured from the moment the buyer was *notified*
 * rather than from the moment the change was made, because the buyer cannot
 * act on a change they have not been told about — and it covers only the
 * tickets sold strictly before the declaration, because a buyer who bought
 * after the announcement bought the changed event.
 *
 * Fees are not part of the ticket. A booking fee is consideration for a service
 * that was performed, so it survives a change-of-mind refund and does not
 * survive an organiser cancellation. It is charged once per order, so it is
 * refunded once per order: an engine that refunds a percentage of the order
 * total refunds a per-order fee once per ticket.
 *
 * And a ticket bought with a half-price code, part-paid from credit issued for
 * a previous cancellation, is worth its face value to nobody. Refunding face
 * value in cash converts a cancellation into a way of extracting money from the
 * union, so every refund is decomposed by tender and each component returns to
 * where it came from. Discount and waiver components are extinguished; they
 * were never money.
 */

export type RefundCause =
  | "ORGANISER_CANCELLATION"
  | "MATERIAL_CHANGE"
  | "PARTIAL_PERFORMANCE"
  | "CHANGE_OF_MIND"
  | "DUPLICATE_PURCHASE";

/**
 * Whether the refund is owed or merely available. The distinction is the whole
 * point of classifying by cause, so it survives into the result.
 */
export type Entitlement = "MANDATORY" | "DISCRETIONARY" | "NONE";

export type TenderKind = "CARD" | "ACCOUNT_CREDIT" | "DISCOUNT" | "HARDSHIP_WAIVER";

/** What happens to a tender component when the refund settles. */
export type TenderDisposition = "PAID" | "RETURNED_TO_CREDIT" | "EXTINGUISHED";

export type ChangeKind =
  | "HEADLINE_ACT"
  | "VENUE"
  | "DATE"
  | "START_TIME_MAJOR"
  | "FORMAT"
  | "SUPPORT_ACT"
  | "ROOM_WITHIN_VENUE"
  | "START_TIME_MINOR";

export type RequestOutcome =
  | "REFUND_DUE"
  | "DISCRETIONARY"
  | "REFUSED_UNKNOWN_TICKET"
  | "REFUSED_NOT_HOLDER"
  | "REFUSED_ADMITTED"
  | "REFUSED_EVENT_NOT_CANCELLED"
  | "REFUSED_NO_MATERIAL_CHANGE"
  | "REFUSED_CHANGE_NOT_MATERIAL"
  | "REFUSED_SOLD_AFTER_CHANGE"
  | "REFUSED_WINDOW_CLOSED"
  | "REFUSED_NOTHING_UNPERFORMED"
  | "REFUSED_NO_DUPLICATE";

/**
 * The changes that open a refund window. A support act, a room within the same
 * building and a twenty-minute shift are changes; they are not this. Keeping
 * the list here rather than in a caller's conditional is what stops the set
 * drifting per committee.
 */
export const MATERIAL_CHANGE_KINDS: readonly ChangeKind[] = [
  "HEADLINE_ACT",
  "VENUE",
  "DATE",
  "START_TIME_MAJOR",
  "FORMAT",
];

/** Default hours a buyer has to act, measured from notification. */
export const DEFAULT_MATERIAL_CHANGE_WINDOW_HOURS = 72;

export interface EventSession {
  sessionId: string;
  startAt: Date;
  endAt: Date;
  /** Relative worth of the session for pro-rata purposes. A keynote day is not half a workshop day. */
  weight: number;
}

export interface TicketedEvent {
  eventId: string;
  title: string;
  /**
   * Whether this is a ticket for a specific dated event. The cooling-off
   * exemption turns on this and nothing else.
   */
  dated: boolean;
  sessions: EventSession[];
  cancelledAt: Date | null;
  /** The moment the event stopped happening. Sessions starting after it were not performed. */
  abandonedAt: Date | null;
}

export interface TenderComponent {
  kind: TenderKind;
  amountMinor: number;
}

export interface OrderTicket {
  ticketId: string;
  orderId: string;
  eventId: string;
  /** Advertised price. Nobody paid this; the tender breakdown is what was paid. */
  faceValueMinor: number;
  tender: TenderComponent[];
  /** Sessions this specific ticket admits to. A day-two ticket is not a full pass. */
  sessionIds: string[];
  soldAt: Date;
  holderId: string;
  admittedAt: Date | null;
}

export interface TicketOrder {
  orderId: string;
  buyerId: string;
  eventId: string;
  purchasedAt: Date;
  /** Charged once for the order, however many tickets it contains. */
  perOrderFeeMinor: number;
}

export interface MaterialChange {
  changeId: string;
  eventId: string;
  kind: ChangeKind;
  description: string;
  declaredAt: Date;
  /** When the buyer was actually told. The window runs from here. */
  notifiedAt: Date;
  windowHours: number;
}

export interface RefundComponent {
  kind: TenderKind;
  amountMinor: number;
  disposition: TenderDisposition;
}

export interface RefundBreakdown {
  /** Everything being reversed, money or not. */
  grossMinor: number;
  /** The part that leaves the union's bank account or returns to a credit balance. */
  payableMinor: number;
  /** Discount and waiver value, reversed but never paid. */
  extinguishedMinor: number;
  components: RefundComponent[];
}

export interface RefundRequest {
  requestId: string;
  ticketId: string;
  cause: RefundCause;
  requestedBy: string;
  requestedAt: Date;
}

export interface RefundDecision {
  requestId: string;
  ticketId: string;
  cause: RefundCause;
  outcome: RequestOutcome;
  entitlement: Entitlement;
  /** Present whenever the outcome is REFUND_DUE or DISCRETIONARY. */
  breakdown: RefundBreakdown | null;
  /** Whether the per-order booking fee was included in this decision. */
  feeRefunded: boolean;
  /** Fraction of the ticket being reversed. 1 for everything but partial performance. */
  proRataNumerator: number;
  proRataDenominator: number;
  reason: string;
  decidedAt: Date;
  /** True when this decision was replayed from an earlier settled request. */
  replayed: boolean;
}

function isMaterial(kind: ChangeKind): boolean {
  return MATERIAL_CHANGE_KINDS.includes(kind);
}

/**
 * Split `gross` across `weights` in integer minor units, giving the remainder to
 * the largest weights first. Splitting by rounding each share independently
 * loses or invents a penny, and a refund that does not sum to the amount
 * authorised is a reconciliation problem rather than a rounding one.
 */
function allocate(gross: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || gross <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (gross * weight) / total);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = gross - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value), weight: weights[index] }))
    .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || a.index - b.index);

  for (const entry of order) {
    if (remaining <= 0) break;
    floors[entry.index] += 1;
    remaining -= 1;
  }

  return floors;
}

function dispositionFor(kind: TenderKind): TenderDisposition {
  switch (kind) {
    case "CARD":
      return "PAID";
    case "ACCOUNT_CREDIT":
      return "RETURNED_TO_CREDIT";
    default:
      // A discount was never money and a hardship waiver was never the buyer's.
      // Both are reversed so the ledger balances; neither is paid to anyone.
      return "EXTINGUISHED";
  }
}

export class RefundEntitlementService {
  private readonly events = new Map<string, TicketedEvent>();
  private readonly orders = new Map<string, TicketOrder>();
  private readonly tickets = new Map<string, OrderTicket>();
  private readonly changes = new Map<string, MaterialChange[]>();
  /** Settled decisions by ticket, so a second request replays rather than re-pays. */
  private readonly settled = new Map<string, RefundDecision>();
  /** Orders whose per-order fee has already been reversed. */
  private readonly feeReversedOrders = new Set<string>();

  registerEvent(event: TicketedEvent): void {
    this.events.set(event.eventId, {
      ...event,
      sessions: event.sessions.map((session) => ({ ...session })),
    });
  }

  registerOrder(order: TicketOrder, tickets: OrderTicket[]): void {
    this.orders.set(order.orderId, { ...order });
    for (const ticket of tickets) {
      this.tickets.set(ticket.ticketId, {
        ...ticket,
        tender: ticket.tender.map((component) => ({ ...component })),
        sessionIds: [...ticket.sessionIds],
      });
    }
  }

  cancelEvent(eventId: string, at: Date): void {
    const event = this.events.get(eventId);
    if (event) event.cancelledAt = at;
  }

  /** The event started and stopped. Sessions beginning after this were not performed. */
  abandonEvent(eventId: string, at: Date): void {
    const event = this.events.get(eventId);
    if (event) event.abandonedAt = at;
  }

  declareMaterialChange(change: MaterialChange): void {
    const list = this.changes.get(change.eventId) ?? [];
    list.push({ ...change });
    this.changes.set(change.eventId, list);
  }

  admitTicket(ticketId: string, at: Date): void {
    const ticket = this.tickets.get(ticketId);
    if (ticket) ticket.admittedAt = at;
  }

  /** The ticket moves; the entitlement moves with it, to the current holder. */
  transferTicket(ticketId: string, toHolderId: string): void {
    const ticket = this.tickets.get(ticketId);
    if (ticket) ticket.holderId = toHolderId;
  }

  getTicket(ticketId: string): OrderTicket | undefined {
    const ticket = this.tickets.get(ticketId);
    return ticket ? { ...ticket, tender: ticket.tender.map((c) => ({ ...c })) } : undefined;
  }

  /**
   * The material change in force for a ticket at a moment: declared before the
   * request, material in kind, and declared after the ticket was sold. Where
   * several qualify the most recent declaration wins, because that is the one
   * the buyer is reacting to.
   */
  findApplicableChange(ticket: OrderTicket, at: Date): MaterialChange | null {
    const declared = (this.changes.get(ticket.eventId) ?? []).filter(
      (change) => change.declaredAt.getTime() <= at.getTime(),
    );
    if (declared.length === 0) return null;

    const material = declared.filter((change) => isMaterial(change.kind));
    if (material.length === 0) return null;

    const applicable = material.filter(
      (change) => ticket.soldAt.getTime() < change.declaredAt.getTime(),
    );
    const pool = applicable.length > 0 ? applicable : material;

    return pool.reduce((latest, change) =>
      change.declaredAt.getTime() > latest.declaredAt.getTime() ? change : latest,
    );
  }

  /**
   * The share of a ticket that was not performed, expressed against the
   * sessions that specific ticket admitted to. A day-two-only ticket for an
   * event abandoned on day two is a whole refund; a full pass for the same
   * event is not.
   */
  unperformedShare(ticket: OrderTicket): { numerator: number; denominator: number } {
    const event = this.events.get(ticket.eventId);
    if (!event) return { numerator: 0, denominator: 1 };

    const admitted = event.sessions.filter((session) =>
      ticket.sessionIds.includes(session.sessionId),
    );
    const denominator = admitted.reduce((sum, session) => sum + session.weight, 0);
    if (denominator <= 0) return { numerator: 0, denominator: 1 };

    if (event.cancelledAt) return { numerator: denominator, denominator };
    if (!event.abandonedAt) return { numerator: 0, denominator };

    const cutoff = event.abandonedAt.getTime();
    const numerator = admitted
      .filter((session) => session.startAt.getTime() >= cutoff)
      .reduce((sum, session) => sum + session.weight, 0);

    return { numerator, denominator };
  }

  private buildBreakdown(
    ticket: OrderTicket,
    numerator: number,
    denominator: number,
    includeFee: boolean,
  ): RefundBreakdown {
    const paidTotal = ticket.tender.reduce((sum, component) => sum + component.amountMinor, 0);
    const reversible =
      denominator === numerator
        ? paidTotal
        : Math.round((paidTotal * numerator) / Math.max(denominator, 1));

    const weights = ticket.tender.map((component) => component.amountMinor);
    const shares = allocate(reversible, weights);

    const byKind = new Map<TenderKind, number>();
    ticket.tender.forEach((component, index) => {
      if (shares[index] <= 0) return;
      byKind.set(component.kind, (byKind.get(component.kind) ?? 0) + shares[index]);
    });

    if (includeFee) {
      const order = this.orders.get(ticket.orderId);
      const fee = order?.perOrderFeeMinor ?? 0;
      // The fee was taken as money, so it comes back as money regardless of how
      // the ticket itself was tendered.
      if (fee > 0) byKind.set("CARD", (byKind.get("CARD") ?? 0) + fee);
    }

    const order: TenderKind[] = ["CARD", "ACCOUNT_CREDIT", "DISCOUNT", "HARDSHIP_WAIVER"];
    const components: RefundComponent[] = order
      .filter((kind) => (byKind.get(kind) ?? 0) > 0)
      .map((kind) => ({
        kind,
        amountMinor: byKind.get(kind) as number,
        disposition: dispositionFor(kind),
      }));

    const grossMinor = components.reduce((sum, component) => sum + component.amountMinor, 0);
    const extinguishedMinor = components
      .filter((component) => component.disposition === "EXTINGUISHED")
      .reduce((sum, component) => sum + component.amountMinor, 0);

    return {
      grossMinor,
      payableMinor: grossMinor - extinguishedMinor,
      extinguishedMinor,
      components,
    };
  }

  private refuse(request: RefundRequest, outcome: RequestOutcome, reason: string): RefundDecision {
    return {
      requestId: request.requestId,
      ticketId: request.ticketId,
      cause: request.cause,
      outcome,
      entitlement: "NONE",
      breakdown: null,
      feeRefunded: false,
      proRataNumerator: 0,
      proRataDenominator: 1,
      reason,
      decidedAt: request.requestedAt,
      replayed: false,
    };
  }

  /**
   * Resolve a request to one answer. The same request against the same ticket
   * under a different cause is a different question and gets a different
   * answer; the same request twice is the same question and gets the same one.
   */
  requestRefund(request: RefundRequest): RefundDecision {
    const ticket = this.tickets.get(request.ticketId);
    if (!ticket) {
      return this.refuse(request, "REFUSED_UNKNOWN_TICKET", "No such ticket.");
    }

    const previous = this.settled.get(request.ticketId);
    if (previous) {
      // Two requests against one ticket resolve to the first outcome rather
      // than to whichever was processed second.
      return { ...previous, requestId: request.requestId, replayed: true };
    }

    if (request.requestedBy !== ticket.holderId) {
      return this.refuse(
        request,
        "REFUSED_NOT_HOLDER",
        "Refund resolves against the current holder of the ticket, not the original buyer.",
      );
    }

    const admitted =
      ticket.admittedAt !== null && ticket.admittedAt.getTime() <= request.requestedAt.getTime();
    if (admitted && request.cause !== "PARTIAL_PERFORMANCE") {
      return this.refuse(
        request,
        "REFUSED_ADMITTED",
        "Ticket was scanned in at the door; only a partial performance claim survives admission.",
      );
    }

    const decision = this.decide(request, ticket);
    if (decision.outcome === "REFUND_DUE" || decision.outcome === "DISCRETIONARY") {
      this.settled.set(ticket.ticketId, decision);
      if (decision.feeRefunded) this.feeReversedOrders.add(ticket.orderId);
    }
    return decision;
  }

  private decide(request: RefundRequest, ticket: OrderTicket): RefundDecision {
    const event = this.events.get(ticket.eventId);
    const base = {
      requestId: request.requestId,
      ticketId: ticket.ticketId,
      cause: request.cause,
      decidedAt: request.requestedAt,
      replayed: false,
    };

    // A per-order fee is refundable once per order, and only where the cause
    // means the booking service itself failed.
    const feeAvailable = !this.feeReversedOrders.has(ticket.orderId);

    switch (request.cause) {
      case "ORGANISER_CANCELLATION": {
        if (!event?.cancelledAt || event.cancelledAt.getTime() > request.requestedAt.getTime()) {
          return this.refuse(
            request,
            "REFUSED_EVENT_NOT_CANCELLED",
            "Event is not cancelled; a cancellation claim needs a cancellation.",
          );
        }
        const share = this.unperformedShare(ticket);
        return {
          ...base,
          outcome: "REFUND_DUE",
          entitlement: "MANDATORY",
          breakdown: this.buildBreakdown(ticket, share.numerator, share.denominator, feeAvailable),
          feeRefunded: feeAvailable,
          proRataNumerator: share.numerator,
          proRataDenominator: share.denominator,
          reason: "Organiser cancelled the event; the booking fee does not survive it.",
        };
      }

      case "MATERIAL_CHANGE": {
        const change = this.findApplicableChange(ticket, request.requestedAt);
        if (!change) {
          const anyDeclared = (this.changes.get(ticket.eventId) ?? []).filter(
            (candidate) => candidate.declaredAt.getTime() <= request.requestedAt.getTime(),
          );
          if (anyDeclared.length > 0) {
            return this.refuse(
              request,
              "REFUSED_CHANGE_NOT_MATERIAL",
              "Declared change is not of a kind that opens a refund window.",
            );
          }
          return this.refuse(
            request,
            "REFUSED_NO_MATERIAL_CHANGE",
            "No material change has been declared for this event.",
          );
        }

        if (ticket.soldAt.getTime() >= change.declaredAt.getTime()) {
          return this.refuse(
            request,
            "REFUSED_SOLD_AFTER_CHANGE",
            "Ticket was sold after the change was announced; the buyer bought the changed event.",
          );
        }

        // The window runs from notification, not from the change. A buyer
        // cannot act on something they have not been told.
        const windowEnd = change.notifiedAt.getTime() + change.windowHours * 3_600_000;
        if (request.requestedAt.getTime() > windowEnd) {
          return this.refuse(
            request,
            "REFUSED_WINDOW_CLOSED",
            `Refund window closed ${change.windowHours}h after buyers were notified.`,
          );
        }

        const share = this.unperformedShare(ticket);
        const denominator = share.denominator;
        return {
          ...base,
          outcome: "REFUND_DUE",
          entitlement: "MANDATORY",
          breakdown: this.buildBreakdown(ticket, denominator, denominator, feeAvailable),
          feeRefunded: feeAvailable,
          proRataNumerator: denominator,
          proRataDenominator: denominator,
          reason: `Material change (${change.kind}) declared after this ticket was sold.`,
        };
      }

      case "PARTIAL_PERFORMANCE": {
        const share = this.unperformedShare(ticket);
        if (share.numerator <= 0) {
          return this.refuse(
            request,
            "REFUSED_NOTHING_UNPERFORMED",
            "Every session this ticket admitted to went ahead.",
          );
        }
        return {
          ...base,
          outcome: "REFUND_DUE",
          entitlement: "MANDATORY",
          // The booking was performed and so was part of the event; the fee stands.
          breakdown: this.buildBreakdown(ticket, share.numerator, share.denominator, false),
          feeRefunded: false,
          proRataNumerator: share.numerator,
          proRataDenominator: share.denominator,
          reason: "Pro-rata against the sessions this ticket admitted to that did not happen.",
        };
      }

      case "CHANGE_OF_MIND": {
        // The cooling-off right does not reach a ticket for a specific dated
        // event. Saying so plainly is what makes the answer consistent.
        const mandatory = event ? !event.dated : false;
        return {
          ...base,
          outcome: mandatory ? "REFUND_DUE" : "DISCRETIONARY",
          entitlement: mandatory ? "MANDATORY" : "DISCRETIONARY",
          // The booking service was performed either way, so the fee stands.
          breakdown: this.buildBreakdown(ticket, 1, 1, false),
          feeRefunded: false,
          proRataNumerator: 1,
          proRataDenominator: 1,
          reason: mandatory
            ? "Undated item; the cancellation right applies."
            : "Dated event; the cooling-off exemption applies, so this is discretionary rather than owed.",
        };
      }

      case "DUPLICATE_PURCHASE": {
        const duplicate = [...this.tickets.values()].find(
          (candidate) =>
            candidate.ticketId !== ticket.ticketId &&
            candidate.eventId === ticket.eventId &&
            candidate.orderId !== ticket.orderId &&
            candidate.holderId === ticket.holderId &&
            candidate.sessionIds.join("|") === ticket.sessionIds.join("|"),
        );
        if (!duplicate) {
          return this.refuse(
            request,
            "REFUSED_NO_DUPLICATE",
            "No second ticket to the same sessions is held by this person.",
          );
        }
        return {
          ...base,
          outcome: "REFUND_DUE",
          entitlement: "MANDATORY",
          // The whole order was the mistake, fee included.
          breakdown: this.buildBreakdown(ticket, 1, 1, feeAvailable),
          feeRefunded: feeAvailable,
          proRataNumerator: 1,
          proRataDenominator: 1,
          reason: `Duplicate of ticket ${duplicate.ticketId} on a separate order.`,
        };
      }

      default:
        return this.refuse(request, "REFUSED_NO_MATERIAL_CHANGE", "Unrecognised cause.");
    }
  }

  /**
   * Every ticket entitled to act on a declared change: sold before it, not yet
   * admitted, not yet settled, and still inside the notification window.
   */
  ticketsEntitledUnder(changeId: string, at: Date): OrderTicket[] {
    const change = [...this.changes.values()].flat().find((item) => item.changeId === changeId);
    if (!change || !isMaterial(change.kind)) return [];

    const windowEnd = change.notifiedAt.getTime() + change.windowHours * 3_600_000;
    if (at.getTime() > windowEnd) return [];

    return [...this.tickets.values()].filter(
      (ticket) =>
        ticket.eventId === change.eventId &&
        ticket.soldAt.getTime() < change.declaredAt.getTime() &&
        ticket.admittedAt === null &&
        !this.settled.has(ticket.ticketId),
    );
  }
}
