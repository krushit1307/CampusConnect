/**
 * Test suite: Ticket Refund Entitlement Engine (#5011)
 * File: tests/services/refundEntitlementService.test.ts
 *
 * The cases worth writing down are the ones a percentage of the order total
 * gets wrong: two identical tickets that are owed different amounts because
 * they were asked about for different reasons, a per-order fee that is charged
 * once and would otherwise be refunded once per ticket, a ticket bought with a
 * discount code that is worth its face value to nobody, and a window that has
 * closed measured from a change the buyer was told about two days late.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  RefundEntitlementService,
  MATERIAL_CHANGE_KINDS,
  DEFAULT_MATERIAL_CHANGE_WINDOW_HOURS,
  type OrderTicket,
} from "../../src/services/refundEntitlementService";

const BASE = new Date("2028-03-01T12:00:00.000Z");
const HOUR = 3_600_000;

function at(hours: number): Date {
  return new Date(BASE.getTime() + hours * HOUR);
}

const BALL = "event-spring-ball";
const CONFERENCE = "event-careers-conference";
const MEMBERSHIP = "event-society-membership";
const WORKSHOP = "event-three-day-workshop";

const ALICE = "user-alice";
const BOB = "user-bob";
const CAROL = "user-carol";
const DAN = "user-dan";
const ERIN = "user-erin";
const ZOE = "user-zoe";

function ticket(
  overrides: Partial<OrderTicket> & Pick<OrderTicket, "ticketId" | "orderId" | "eventId">,
): OrderTicket {
  return {
    faceValueMinor: 2_000,
    tender: [{ kind: "CARD", amountMinor: 2_000 }],
    sessionIds: ["ball-main"],
    soldAt: BASE,
    holderId: ALICE,
    admittedAt: null,
    ...overrides,
  };
}

function build(): RefundEntitlementService {
  const service = new RefundEntitlementService();

  service.registerEvent({
    eventId: BALL,
    title: "Spring Ball",
    dated: true,
    sessions: [{ sessionId: "ball-main", startAt: at(240), endAt: at(246), weight: 1 }],
    cancelledAt: null,
    abandonedAt: null,
  });

  service.registerEvent({
    eventId: CONFERENCE,
    title: "Careers Conference",
    dated: true,
    sessions: [
      { sessionId: "conf-day-1", startAt: at(200), endAt: at(208), weight: 1 },
      { sessionId: "conf-day-2", startAt: at(224), endAt: at(232), weight: 1 },
    ],
    cancelledAt: null,
    abandonedAt: null,
  });

  service.registerEvent({
    eventId: MEMBERSHIP,
    title: "Annual society membership",
    // Not a ticket for a specific dated event, so the exemption does not reach it.
    dated: false,
    sessions: [{ sessionId: "membership-year", startAt: at(0), endAt: at(8_760), weight: 1 }],
    cancelledAt: null,
    abandonedAt: null,
  });

  service.registerEvent({
    eventId: WORKSHOP,
    title: "Three-day workshop",
    dated: true,
    sessions: [
      { sessionId: "ws-1", startAt: at(300), endAt: at(306), weight: 1 },
      { sessionId: "ws-2", startAt: at(324), endAt: at(330), weight: 1 },
      { sessionId: "ws-3", startAt: at(348), endAt: at(354), weight: 1 },
    ],
    cancelledAt: null,
    abandonedAt: null,
  });

  // Two tickets on one order, so the per-order fee has somewhere to go wrong.
  service.registerOrder(
    { orderId: "order-a", buyerId: ALICE, eventId: BALL, purchasedAt: BASE, perOrderFeeMinor: 250 },
    [
      ticket({ ticketId: "t-ball-1", orderId: "order-a", eventId: BALL }),
      ticket({ ticketId: "t-ball-2", orderId: "order-a", eventId: BALL }),
    ],
  );

  // Card, credit from a previous cancellation, and a half-price code.
  service.registerOrder(
    { orderId: "order-b", buyerId: BOB, eventId: BALL, purchasedAt: BASE, perOrderFeeMinor: 250 },
    [
      ticket({
        ticketId: "t-ball-mixed",
        orderId: "order-b",
        eventId: BALL,
        holderId: BOB,
        tender: [
          { kind: "CARD", amountMinor: 700 },
          { kind: "ACCOUNT_CREDIT", amountMinor: 300 },
          { kind: "DISCOUNT", amountMinor: 1_000 },
        ],
      }),
    ],
  );

  // A full pass and a day-two-only ticket to the same conference.
  service.registerOrder(
    {
      orderId: "order-c",
      buyerId: CAROL,
      eventId: CONFERENCE,
      purchasedAt: BASE,
      perOrderFeeMinor: 500,
    },
    [
      ticket({
        ticketId: "t-conf-full",
        orderId: "order-c",
        eventId: CONFERENCE,
        holderId: CAROL,
        faceValueMinor: 8_000,
        tender: [{ kind: "CARD", amountMinor: 8_000 }],
        sessionIds: ["conf-day-1", "conf-day-2"],
      }),
    ],
  );

  service.registerOrder(
    {
      orderId: "order-d",
      buyerId: DAN,
      eventId: CONFERENCE,
      purchasedAt: BASE,
      perOrderFeeMinor: 500,
    },
    [
      ticket({
        ticketId: "t-conf-day-two",
        orderId: "order-d",
        eventId: CONFERENCE,
        holderId: DAN,
        faceValueMinor: 5_000,
        tender: [{ kind: "CARD", amountMinor: 5_000 }],
        sessionIds: ["conf-day-2"],
      }),
    ],
  );

  service.registerOrder(
    {
      orderId: "order-e",
      buyerId: ERIN,
      eventId: MEMBERSHIP,
      purchasedAt: BASE,
      perOrderFeeMinor: 0,
    },
    [
      ticket({
        ticketId: "t-membership",
        orderId: "order-e",
        eventId: MEMBERSHIP,
        holderId: ERIN,
        faceValueMinor: 1_500,
        tender: [{ kind: "CARD", amountMinor: 1_500 }],
        sessionIds: ["membership-year"],
      }),
    ],
  );

  // An amount that does not divide cleanly across two tenders.
  service.registerOrder(
    {
      orderId: "order-f",
      buyerId: CAROL,
      eventId: WORKSHOP,
      purchasedAt: BASE,
      perOrderFeeMinor: 0,
    },
    [
      ticket({
        ticketId: "t-workshop",
        orderId: "order-f",
        eventId: WORKSHOP,
        holderId: CAROL,
        faceValueMinor: 1_000,
        tender: [
          { kind: "CARD", amountMinor: 667 },
          { kind: "ACCOUNT_CREDIT", amountMinor: 333 },
        ],
        sessionIds: ["ws-1", "ws-2", "ws-3"],
      }),
    ],
  );

  return service;
}

function declareHeadlineChange(service: RefundEntitlementService): void {
  service.declareMaterialChange({
    changeId: "change-headliner",
    eventId: BALL,
    kind: "HEADLINE_ACT",
    description: "Headline act replaced.",
    declaredAt: at(24),
    // Buyers were only emailed two days after the decision was taken.
    notifiedAt: at(72),
    windowHours: DEFAULT_MATERIAL_CHANGE_WINDOW_HOURS,
  });
}

describe("RefundEntitlementService — cause decides the answer", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
  });

  test("identical tickets diverge on cause alone", () => {
    service.cancelEvent(BALL, at(100));

    const cancelled = service.requestRefund({
      requestId: "req-1",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(101),
    });

    const remorse = service.requestRefund({
      requestId: "req-2",
      ticketId: "t-ball-2",
      cause: "CHANGE_OF_MIND",
      requestedBy: ALICE,
      requestedAt: at(101),
    });

    expect(cancelled.entitlement).toBe("MANDATORY");
    expect(cancelled.outcome).toBe("REFUND_DUE");
    expect(remorse.entitlement).toBe("DISCRETIONARY");
    expect(remorse.outcome).toBe("DISCRETIONARY");
    // Same ticket price, different amounts, because the fee follows the cause.
    expect(cancelled.breakdown?.grossMinor).toBe(2_250);
    expect(remorse.breakdown?.grossMinor).toBe(2_000);
  });

  test("a change of mind about an undated item is owed, not discretionary", () => {
    const decision = service.requestRefund({
      requestId: "req-3",
      ticketId: "t-membership",
      cause: "CHANGE_OF_MIND",
      requestedBy: ERIN,
      requestedAt: at(20),
    });

    expect(decision.outcome).toBe("REFUND_DUE");
    expect(decision.entitlement).toBe("MANDATORY");
  });

  test("a cancellation claim without a cancellation is refused", () => {
    const decision = service.requestRefund({
      requestId: "req-4",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(30),
    });

    expect(decision.outcome).toBe("REFUSED_EVENT_NOT_CANCELLED");
    expect(decision.breakdown).toBeNull();
  });

  test("an unknown ticket is refused rather than priced", () => {
    const decision = service.requestRefund({
      requestId: "req-5",
      ticketId: "t-does-not-exist",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(30),
    });

    expect(decision.outcome).toBe("REFUSED_UNKNOWN_TICKET");
  });
});

describe("RefundEntitlementService — the per-order fee is charged once", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
    service.cancelEvent(BALL, at(100));
  });

  test("the fee is reversed on the first ticket of an order and not the second", () => {
    const first = service.requestRefund({
      requestId: "req-6",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(101),
    });
    const second = service.requestRefund({
      requestId: "req-7",
      ticketId: "t-ball-2",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(102),
    });

    expect(first.feeRefunded).toBe(true);
    expect(first.breakdown?.grossMinor).toBe(2_250);
    expect(second.feeRefunded).toBe(false);
    expect(second.breakdown?.grossMinor).toBe(2_000);

    const totalFee =
      (first.breakdown?.grossMinor ?? 0) + (second.breakdown?.grossMinor ?? 0) - 4_000;
    expect(totalFee).toBe(250);
  });

  test("a booking fee survives a discretionary refund", () => {
    const decision = service.requestRefund({
      requestId: "req-8",
      ticketId: "t-ball-2",
      cause: "CHANGE_OF_MIND",
      requestedBy: ALICE,
      requestedAt: at(101),
    });

    expect(decision.feeRefunded).toBe(false);
    expect(decision.breakdown?.grossMinor).toBe(2_000);
  });
});

describe("RefundEntitlementService — tender decomposition", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
  });

  test("a discounted, part-credit ticket refunds less cash than its face value", () => {
    service.cancelEvent(BALL, at(100));

    const decision = service.requestRefund({
      requestId: "req-9",
      ticketId: "t-ball-mixed",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: BOB,
      requestedAt: at(101),
    });

    const components = decision.breakdown?.components ?? [];
    const byKind = Object.fromEntries(components.map((c) => [c.kind, c]));

    // 700 paid on the card plus the 250 order fee, which was money.
    expect(byKind.CARD.amountMinor).toBe(950);
    expect(byKind.CARD.disposition).toBe("PAID");
    expect(byKind.ACCOUNT_CREDIT.amountMinor).toBe(300);
    expect(byKind.ACCOUNT_CREDIT.disposition).toBe("RETURNED_TO_CREDIT");
    // The half-price code was never money and does not become money here.
    expect(byKind.DISCOUNT.amountMinor).toBe(1_000);
    expect(byKind.DISCOUNT.disposition).toBe("EXTINGUISHED");

    expect(decision.breakdown?.grossMinor).toBe(2_250);
    expect(decision.breakdown?.payableMinor).toBe(1_250);
    expect(decision.breakdown?.extinguishedMinor).toBe(1_000);
  });

  test("a pro-rata split across tenders sums exactly to the amount reversed", () => {
    // Abandoned before the last of three days, so a third of the ticket stands.
    service.abandonEvent(WORKSHOP, at(348));

    const decision = service.requestRefund({
      requestId: "req-10",
      ticketId: "t-workshop",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: CAROL,
      requestedAt: at(350),
    });

    expect(decision.proRataNumerator).toBe(1);
    expect(decision.proRataDenominator).toBe(3);

    const components = decision.breakdown?.components ?? [];
    const summed = components.reduce((total, component) => total + component.amountMinor, 0);

    expect(summed).toBe(decision.breakdown?.grossMinor);
    expect(summed).toBe(333);
  });
});

describe("RefundEntitlementService — material change windows", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
    declareHeadlineChange(service);
  });

  test("the window runs from notification, not from the decision", () => {
    // 96 hours after the change was declared, which is outside a 72-hour window
    // measured from the wrong end, and 48 hours after buyers were told.
    const decision = service.requestRefund({
      requestId: "req-11",
      ticketId: "t-ball-1",
      cause: "MATERIAL_CHANGE",
      requestedBy: ALICE,
      requestedAt: at(120),
    });

    expect(decision.outcome).toBe("REFUND_DUE");
    expect(decision.entitlement).toBe("MANDATORY");
  });

  test("a request after the notified window closes is refused", () => {
    const decision = service.requestRefund({
      requestId: "req-12",
      ticketId: "t-ball-1",
      cause: "MATERIAL_CHANGE",
      requestedBy: ALICE,
      requestedAt: at(145),
    });

    expect(decision.outcome).toBe("REFUSED_WINDOW_CLOSED");
  });

  test("a ticket sold after the announcement bought the changed event", () => {
    service.registerOrder(
      {
        orderId: "order-late",
        buyerId: ZOE,
        eventId: BALL,
        purchasedAt: at(30),
        perOrderFeeMinor: 250,
      },
      [
        {
          ticketId: "t-ball-late",
          orderId: "order-late",
          eventId: BALL,
          faceValueMinor: 2_000,
          tender: [{ kind: "CARD", amountMinor: 2_000 }],
          sessionIds: ["ball-main"],
          soldAt: at(30),
          holderId: ZOE,
          admittedAt: null,
        },
      ],
    );

    const decision = service.requestRefund({
      requestId: "req-13",
      ticketId: "t-ball-late",
      cause: "MATERIAL_CHANGE",
      requestedBy: ZOE,
      requestedAt: at(100),
    });

    expect(decision.outcome).toBe("REFUSED_SOLD_AFTER_CHANGE");
  });

  test("a support act change does not open a window", () => {
    const fresh = build();
    fresh.declareMaterialChange({
      changeId: "change-support",
      eventId: BALL,
      kind: "SUPPORT_ACT",
      description: "Support act swapped.",
      declaredAt: at(24),
      notifiedAt: at(24),
      windowHours: 72,
    });

    const decision = fresh.requestRefund({
      requestId: "req-14",
      ticketId: "t-ball-1",
      cause: "MATERIAL_CHANGE",
      requestedBy: ALICE,
      requestedAt: at(30),
    });

    expect(decision.outcome).toBe("REFUSED_CHANGE_NOT_MATERIAL");
    expect(MATERIAL_CHANGE_KINDS).not.toContain("SUPPORT_ACT");
  });

  test("no declared change at all is a different refusal from an immaterial one", () => {
    const fresh = build();
    const decision = fresh.requestRefund({
      requestId: "req-15",
      ticketId: "t-ball-1",
      cause: "MATERIAL_CHANGE",
      requestedBy: ALICE,
      requestedAt: at(30),
    });

    expect(decision.outcome).toBe("REFUSED_NO_MATERIAL_CHANGE");
  });

  test("the entitled set excludes tickets sold after the declaration and those already admitted", () => {
    service.registerOrder(
      {
        orderId: "order-late",
        buyerId: ZOE,
        eventId: BALL,
        purchasedAt: at(30),
        perOrderFeeMinor: 250,
      },
      [
        {
          ticketId: "t-ball-late",
          orderId: "order-late",
          eventId: BALL,
          faceValueMinor: 2_000,
          tender: [{ kind: "CARD", amountMinor: 2_000 }],
          sessionIds: ["ball-main"],
          soldAt: at(30),
          holderId: ZOE,
          admittedAt: null,
        },
      ],
    );
    service.admitTicket("t-ball-2", at(80));

    const entitled = service
      .ticketsEntitledUnder("change-headliner", at(100))
      .map((t) => t.ticketId);

    expect(entitled).toContain("t-ball-1");
    expect(entitled).toContain("t-ball-mixed");
    expect(entitled).not.toContain("t-ball-late");
    expect(entitled).not.toContain("t-ball-2");
  });
});

describe("RefundEntitlementService — partial performance", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
  });

  test("a full pass and a day-two ticket are owed different fractions of the same abandonment", () => {
    service.abandonEvent(CONFERENCE, at(224));

    const fullPass = service.requestRefund({
      requestId: "req-16",
      ticketId: "t-conf-full",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: CAROL,
      requestedAt: at(230),
    });
    const dayTwo = service.requestRefund({
      requestId: "req-17",
      ticketId: "t-conf-day-two",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: DAN,
      requestedAt: at(230),
    });

    expect(fullPass.proRataNumerator).toBe(1);
    expect(fullPass.proRataDenominator).toBe(2);
    expect(fullPass.breakdown?.grossMinor).toBe(4_000);

    // Day two was the whole of what this ticket bought.
    expect(dayTwo.proRataNumerator).toBe(1);
    expect(dayTwo.proRataDenominator).toBe(1);
    expect(dayTwo.breakdown?.grossMinor).toBe(5_000);
  });

  test("an event that went ahead owes nothing on a partial performance claim", () => {
    const decision = service.requestRefund({
      requestId: "req-18",
      ticketId: "t-conf-full",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: CAROL,
      requestedAt: at(240),
    });

    expect(decision.outcome).toBe("REFUSED_NOTHING_UNPERFORMED");
  });

  test("the fee stands where part of the event happened", () => {
    service.abandonEvent(CONFERENCE, at(224));

    const decision = service.requestRefund({
      requestId: "req-19",
      ticketId: "t-conf-full",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: CAROL,
      requestedAt: at(230),
    });

    expect(decision.feeRefunded).toBe(false);
  });
});

describe("RefundEntitlementService — admission, transfer and repeat requests", () => {
  let service: RefundEntitlementService;

  beforeEach(() => {
    service = build();
  });

  test("a scanned ticket cannot be refunded on a change of mind", () => {
    service.admitTicket("t-ball-1", at(240));

    const decision = service.requestRefund({
      requestId: "req-20",
      ticketId: "t-ball-1",
      cause: "CHANGE_OF_MIND",
      requestedBy: ALICE,
      requestedAt: at(241),
    });

    expect(decision.outcome).toBe("REFUSED_ADMITTED");
  });

  test("a scanned ticket can still claim for the part that did not happen", () => {
    service.admitTicket("t-conf-full", at(200));
    service.abandonEvent(CONFERENCE, at(224));

    const decision = service.requestRefund({
      requestId: "req-21",
      ticketId: "t-conf-full",
      cause: "PARTIAL_PERFORMANCE",
      requestedBy: CAROL,
      requestedAt: at(230),
    });

    expect(decision.outcome).toBe("REFUND_DUE");
    expect(decision.breakdown?.grossMinor).toBe(4_000);
  });

  test("a transferred ticket resolves against whoever holds it now", () => {
    service.cancelEvent(BALL, at(100));
    service.transferTicket("t-ball-1", ZOE);

    const byOriginalBuyer = service.requestRefund({
      requestId: "req-22",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(101),
    });
    expect(byOriginalBuyer.outcome).toBe("REFUSED_NOT_HOLDER");

    const byHolder = service.requestRefund({
      requestId: "req-23",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ZOE,
      requestedAt: at(102),
    });
    expect(byHolder.outcome).toBe("REFUND_DUE");
  });

  test("a second request against a settled ticket replays the first answer", () => {
    service.cancelEvent(BALL, at(100));

    const first = service.requestRefund({
      requestId: "req-24",
      ticketId: "t-ball-1",
      cause: "ORGANISER_CANCELLATION",
      requestedBy: ALICE,
      requestedAt: at(101),
    });

    // Same ticket, different cause, submitted by someone hoping for a better answer.
    const second = service.requestRefund({
      requestId: "req-25",
      ticketId: "t-ball-1",
      cause: "CHANGE_OF_MIND",
      requestedBy: ALICE,
      requestedAt: at(103),
    });

    expect(second.replayed).toBe(true);
    expect(second.requestId).toBe("req-25");
    expect(second.outcome).toBe(first.outcome);
    expect(second.cause).toBe(first.cause);
    expect(second.breakdown?.grossMinor).toBe(first.breakdown?.grossMinor);
  });
});

describe("RefundEntitlementService — duplicate purchases", () => {
  test("a second order for the same sessions by the same person is refundable", () => {
    const service = build();
    service.registerOrder(
      {
        orderId: "order-dup",
        buyerId: ALICE,
        eventId: BALL,
        purchasedAt: at(2),
        perOrderFeeMinor: 250,
      },
      [
        {
          ticketId: "t-ball-dup",
          orderId: "order-dup",
          eventId: BALL,
          faceValueMinor: 2_000,
          tender: [{ kind: "CARD", amountMinor: 2_000 }],
          sessionIds: ["ball-main"],
          soldAt: at(2),
          holderId: ALICE,
          admittedAt: null,
        },
      ],
    );

    const decision = service.requestRefund({
      requestId: "req-26",
      ticketId: "t-ball-dup",
      cause: "DUPLICATE_PURCHASE",
      requestedBy: ALICE,
      requestedAt: at(3),
    });

    expect(decision.outcome).toBe("REFUND_DUE");
    expect(decision.feeRefunded).toBe(true);
    expect(decision.breakdown?.grossMinor).toBe(2_250);
  });

  test("a lone ticket is not a duplicate of itself", () => {
    const service = build();

    const decision = service.requestRefund({
      requestId: "req-27",
      ticketId: "t-membership",
      cause: "DUPLICATE_PURCHASE",
      requestedBy: ERIN,
      requestedAt: at(3),
    });

    expect(decision.outcome).toBe("REFUSED_NO_DUPLICATE");
  });
});
