import { describe, it, expect } from "vitest";
import {
  BRAND_NEW_ACCOUNT_DAYS,
  computeRiskScore,
  describePriceCap,
  describeViolation,
  evaluateTransfer,
  findViolations,
  hoursBetween,
  maximumPriceCents,
  type ResalePolicy,
  type SellerContext,
  type TicketContext,
  type TransferRequest,
} from "./resaleGuard";

function policy(overrides: Partial<ResalePolicy> = {}): ResalePolicy {
  return {
    eventId: "event-1",
    capMode: "face_value",
    capValue: 0,
    cooldownHours: 24,
    maxTransfersPerTicket: 2,
    maxResalesPerSeller: 2,
    reviewRiskThreshold: 50,
    finalHoursReviewWindow: 6,
    ...overrides,
  };
}

function ticket(overrides: Partial<TicketContext> = {}): TicketContext {
  return {
    ticketId: "ticket-1",
    faceValueCents: 2_000,
    transferCount: 0,
    lastTransferAt: null,
    previousHolderIds: ["seller-1"],
    ...overrides,
  };
}

function seller(overrides: Partial<SellerContext> = {}): SellerContext {
  return {
    sellerId: "seller-1",
    accountAgeDays: 400,
    priorNoShowRate: 0,
    ticketsHeldForEvent: 1,
    resalesThisEvent: 0,
    transfersLast24h: 0,
    ...overrides,
  };
}

function request(overrides: Partial<TransferRequest> = {}): TransferRequest {
  return {
    sellerId: "seller-1",
    buyerId: "buyer-1",
    askingPriceCents: 2_000,
    requestedAt: "2026-05-01T10:00:00.000Z",
    eventStartsAt: "2026-05-20T18:00:00.000Z",
    ...overrides,
  };
}

describe("ticket resale guard", () => {
  describe("price caps", () => {
    it("caps at face value by default", () => {
      expect(maximumPriceCents(policy(), ticket())).toBe(2_000);
    });

    it("allows an uplift under a percentage cap", () => {
      expect(maximumPriceCents(policy({ capMode: "percentage", capValue: 10 }), ticket())).toBe(
        2_200,
      );
    });

    it("uses the organiser's absolute ceiling when one is set", () => {
      expect(
        maximumPriceCents(policy({ capMode: "fixed_ceiling", capValue: 1_500 }), ticket()),
      ).toBe(1_500);
    });

    it("caps a free-only event at nothing at all", () => {
      expect(maximumPriceCents(policy({ capMode: "free_only" }), ticket())).toBe(0);
    });

    it("states the cap in a sentence the buyer can read", () => {
      expect(describePriceCap(policy(), ticket())).toContain("$20.00");
      expect(describePriceCap(policy({ capMode: "free_only" }), ticket())).toContain(
        "free of charge",
      );
    });
  });

  describe("hard rules", () => {
    it("passes a clean transfer at face value", () => {
      expect(findViolations(policy(), ticket(), seller(), request())).toEqual([]);
    });

    it("allows a transfer priced exactly at the cap", () => {
      const violations = findViolations(
        policy(),
        ticket(),
        seller(),
        request({ askingPriceCents: 2_000 }),
      );
      expect(violations).toEqual([]);
    });

    it("blocks a single cent above the cap", () => {
      const violations = findViolations(
        policy(),
        ticket(),
        seller(),
        request({ askingPriceCents: 2_001 }),
      );
      expect(violations.map((v) => v.code)).toEqual(["price_above_cap"]);
    });

    it("blocks any payment on a free-only event", () => {
      const violations = findViolations(
        policy({ capMode: "free_only" }),
        ticket(),
        seller(),
        request({ askingPriceCents: 1 }),
      );
      expect(violations.map((v) => v.code)).toEqual(["paid_transfer_not_allowed"]);
    });

    it("blocks a transfer to the account that already holds the ticket", () => {
      const violations = findViolations(
        policy(),
        ticket(),
        seller(),
        request({ buyerId: "seller-1" }),
      );
      expect(violations.map((v) => v.code)).toContain("self_transfer");
    });

    it("enforces the cooldown between consecutive transfers", () => {
      const recent = ticket({ transferCount: 1, lastTransferAt: "2026-05-01T00:00:00.000Z" });
      const violations = findViolations(policy(), recent, seller(), request());
      expect(violations.map((v) => v.code)).toContain("cooldown_active");
      expect(violations.find((v) => v.code === "cooldown_active")?.message).toContain("14 hours");
    });

    it("allows a transfer once the cooldown has elapsed exactly", () => {
      const settled = ticket({ transferCount: 1, lastTransferAt: "2026-04-30T10:00:00.000Z" });
      expect(findViolations(policy(), settled, seller(), request())).toEqual([]);
    });

    it("stops a ticket that has already changed hands too often", () => {
      const flipped = ticket({ transferCount: 2, lastTransferAt: "2026-01-01T00:00:00.000Z" });
      expect(findViolations(policy(), flipped, seller(), request()).map((v) => v.code)).toEqual([
        "ticket_transfer_limit",
      ]);
    });

    it("stops a seller who has already passed on their allowance", () => {
      const codes = findViolations(
        policy(),
        ticket(),
        seller({ resalesThisEvent: 2 }),
        request(),
      ).map((v) => v.code);
      expect(codes).toEqual(["seller_resale_limit"]);
    });

    it("detects a ticket being sent back to a previous holder", () => {
      const laundered = ticket({ previousHolderIds: ["seller-1", "buyer-1"] });
      expect(findViolations(policy(), laundered, seller(), request()).map((v) => v.code)).toEqual([
        "circular_transfer",
      ]);
    });

    it("refuses transfers after the event has started", () => {
      const codes = findViolations(
        policy(),
        ticket(),
        seller(),
        request({ requestedAt: "2026-05-20T19:00:00.000Z" }),
      ).map((v) => v.code);
      expect(codes).toContain("event_already_started");
    });

    it("gives every violation a readable label", () => {
      expect(describeViolation("price_above_cap")).toBe("Asking price above the cap");
      expect(describeViolation("circular_transfer")).toBe("Ticket returning to a previous holder");
    });
  });

  describe("risk scoring", () => {
    it("scores an established seller at zero", () => {
      const { score, factors } = computeRiskScore(policy(), ticket(), seller(), request());
      expect(score).toBe(0);
      expect(factors).toEqual([]);
    });

    it("weighs a brand new account heavily", () => {
      const { score } = computeRiskScore(
        policy(),
        ticket(),
        seller({ accountAgeDays: BRAND_NEW_ACCOUNT_DAYS - 1 }),
        request(),
      );
      expect(score).toBe(40);
    });

    it("weighs a young account less than a brand new one", () => {
      const { score } = computeRiskScore(
        policy(),
        ticket(),
        seller({ accountAgeDays: 20 }),
        request(),
      );
      expect(score).toBe(25);
    });

    it("adds points for stockpiled tickets and recent transfer velocity", () => {
      const { score, factors } = computeRiskScore(
        policy(),
        ticket(),
        seller({ ticketsHeldForEvent: 5, transfersLast24h: 2 }),
        request(),
      );
      // Stockpiling is capped at 24 points so it cannot dominate the score.
      expect(score).toBe(24 + 20);
      expect(factors[0].label).toContain("5 tickets");
    });

    it("adds points for a transfer in the last hours before doors", () => {
      const { factors } = computeRiskScore(
        policy(),
        ticket(),
        seller(),
        request({ requestedAt: "2026-05-20T14:00:00.000Z" }),
      );
      expect(factors.map((f) => f.label)).toContain("Transfer close to the event");
    });

    it("never exceeds 100", () => {
      const { score } = computeRiskScore(
        policy(),
        ticket({ transferCount: 2 }),
        seller({
          accountAgeDays: 1,
          priorNoShowRate: 1,
          ticketsHeldForEvent: 12,
          transfersLast24h: 9,
        }),
        request({ requestedAt: "2026-05-20T15:00:00.000Z" }),
      );
      expect(score).toBe(100);
    });

    it("ignores a nonsensical no-show rate rather than trusting it", () => {
      const { score } = computeRiskScore(
        policy(),
        ticket(),
        seller({ priorNoShowRate: 4 }),
        request(),
      );
      expect(score).toBe(25);
    });
  });

  describe("decisions", () => {
    it("allows an ordinary transfer well before the event", () => {
      const assessment = evaluateTransfer(policy(), ticket(), seller(), request());
      expect(assessment.decision).toBe("allow");
      expect(assessment.summary).toContain("$20.00");
    });

    it("blocks as soon as any hard rule fails, whatever the risk score", () => {
      const assessment = evaluateTransfer(
        policy(),
        ticket(),
        seller(),
        request({ askingPriceCents: 6_000 }),
      );
      expect(assessment.decision).toBe("block");
      expect(assessment.summary).toContain("cap");
    });

    it("holds a high risk transfer for review rather than refusing it", () => {
      const assessment = evaluateTransfer(
        policy(),
        ticket(),
        seller({ accountAgeDays: 2, ticketsHeldForEvent: 4 }),
        request(),
      );
      expect(assessment.riskScore).toBeGreaterThanOrEqual(50);
      expect(assessment.decision).toBe("review");
    });

    it("reviews a last minute transfer even from a trusted account", () => {
      const assessment = evaluateTransfer(
        policy(),
        ticket(),
        seller(),
        request({ requestedAt: "2026-05-20T15:00:00.000Z" }),
      );
      expect(assessment.decision).toBe("review");
    });

    it("stays on the allow side one point below the threshold", () => {
      const assessment = evaluateTransfer(
        policy({ reviewRiskThreshold: 26 }),
        ticket(),
        seller({ accountAgeDays: 20 }),
        request(),
      );
      expect(assessment.riskScore).toBe(25);
      expect(assessment.decision).toBe("allow");
    });

    it("reports every hard failure, not just the first one", () => {
      const assessment = evaluateTransfer(
        policy({ capMode: "free_only" }),
        ticket({ transferCount: 5, previousHolderIds: ["seller-1", "buyer-1"] }),
        seller({ resalesThisEvent: 9 }),
        request({ askingPriceCents: 5_000 }),
      );
      expect(assessment.violations.map((v) => v.code).sort()).toEqual([
        "circular_transfer",
        "paid_transfer_not_allowed",
        "seller_resale_limit",
        "ticket_transfer_limit",
      ]);
    });
  });

  describe("time helper", () => {
    it("measures hours between two timestamps", () => {
      expect(hoursBetween("2026-05-01T00:00:00.000Z", "2026-05-01T06:00:00.000Z")).toBe(6);
      expect(hoursBetween("2026-05-01T06:00:00.000Z", "2026-05-01T00:00:00.000Z")).toBe(-6);
    });

    it("returns null when a timestamp is missing or unreadable", () => {
      expect(hoursBetween(null, "2026-05-01T00:00:00.000Z")).toBeNull();
      expect(hoursBetween("not a date", "2026-05-01T00:00:00.000Z")).toBeNull();
    });
  });
});
