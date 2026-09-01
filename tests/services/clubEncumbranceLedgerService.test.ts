/**
 * Test suite: Club Purchase Order Encumbrance Ledger (#4553)
 * File: tests/services/clubEncumbranceLedgerService.test.ts
 *
 * Every balance in the service is folded from the append-only log, so the
 * assertions below check the fold rather than any stored total, and every
 * as-of question pins its instant explicitly.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  ClubEncumbranceLedgerService,
  type BudgetLineInput,
  type PurchaseOrderInput,
} from "../../src/services/clubEncumbranceLedgerService";

const LINE = "line-catering-fy26";
const CLUB = "club-robotics";

const YEAR_OPEN = new Date("2026-08-01T00:00:00.000Z");
const YEAR_CLOSE = new Date("2027-05-31T00:00:00.000Z");
const DAY = 86_400_000;

/** 5,000.00 in cents. Every figure in this suite is integer cents. */
const ALLOCATION = 500_000;

function day(offset: number): Date {
  return new Date(YEAR_OPEN.getTime() + offset * DAY);
}

function line(overrides: Partial<BudgetLineInput> = {}): BudgetLineInput {
  return {
    lineId: LINE,
    clubId: CLUB,
    fiscalYear: "FY26",
    category: "Catering",
    allocatedCents: ALLOCATION,
    openedAt: YEAR_OPEN,
    closesAt: YEAR_CLOSE,
    ...overrides,
  };
}

function po(overrides: Partial<PurchaseOrderInput> = {}): PurchaseOrderInput {
  return {
    purchaseOrderId: "PO-1001",
    lineId: LINE,
    vendorName: "Northgate Catering",
    estimatedCents: 120_000,
    raisedByUserId: "user-treasurer",
    approvedByUserId: "user-advisor",
    approvedAt: day(10),
    ...overrides,
  };
}

describe("ClubEncumbranceLedgerService (#4553)", () => {
  let ledger: ClubEncumbranceLedgerService;

  beforeEach(() => {
    ledger = new ClubEncumbranceLedgerService();
    ledger.openLine(line());
  });

  describe("opening a line", () => {
    test("the opening allocation is the whole available balance", () => {
      const balance = ledger.balanceOf(LINE);
      expect(balance.allocatedCents).toBe(ALLOCATION);
      expect(balance.encumberedCents).toBe(0);
      expect(balance.liquidatedCents).toBe(0);
      expect(balance.availableCents).toBe(ALLOCATION);
    });

    test("rejects a duplicate line", () => {
      expect(() => ledger.openLine(line())).toThrow(/already exists/i);
    });

    test("rejects a fractional allocation", () => {
      expect(() => ledger.openLine(line({ lineId: "line-b", allocatedCents: 100.5 }))).toThrow(
        /integer number of cents/i,
      );
    });

    test("rejects a negative allocation", () => {
      expect(() => ledger.openLine(line({ lineId: "line-b", allocatedCents: -1 }))).toThrow(
        /cannot be negative/i,
      );
    });

    test("rejects a line that closes before it opens", () => {
      expect(() => ledger.openLine(line({ lineId: "line-b", closesAt: YEAR_OPEN }))).toThrow(
        /must close after it opens/i,
      );
    });

    test("a zero allocation is legal and leaves nothing available", () => {
      ledger.openLine(line({ lineId: "line-zero", allocatedCents: 0 }));
      expect(ledger.balanceOf("line-zero").availableCents).toBe(0);
    });

    test("a mid-year top-up raises available without rewriting the opening figure", () => {
      ledger.increaseAllocation(LINE, 50_000, day(40), "Dean's discretionary top-up");
      const balance = ledger.balanceOf(LINE);
      expect(balance.allocatedCents).toBe(ALLOCATION + 50_000);
      expect(balance.availableCents).toBe(ALLOCATION + 50_000);
      expect(ledger.balanceAsOf(LINE, day(39)).allocatedCents).toBe(ALLOCATION);
    });

    test("rejects a non-positive top-up", () => {
      expect(() => ledger.increaseAllocation(LINE, 0, day(40), "nothing")).toThrow(/positive/i);
    });

    test("rejects a top-up against an unknown line", () => {
      expect(() => ledger.increaseAllocation("nope", 100, day(40), "x")).toThrow(/Unknown budget/i);
    });
  });

  describe("approval commits immediately", () => {
    test("an approved order reduces available before any invoice exists", () => {
      const result = ledger.approvePurchaseOrder(po());
      expect(result.outcome).toBe("APPROVED");
      expect(result.approved).toBe(true);

      const balance = ledger.balanceOf(LINE);
      expect(balance.encumberedCents).toBe(120_000);
      expect(balance.liquidatedCents).toBe(0);
      expect(balance.availableCents).toBe(ALLOCATION - 120_000);
      expect(result.availableAfterCents).toBe(balance.availableCents);
    });

    test("the second of two same-day approvals against one line is refused", () => {
      // The failure the whole feature exists to prevent: without encumbrance
      // both of these read 500,000 available and both pass.
      const first = ledger.approvePurchaseOrder(po({ estimatedCents: 300_000 }));
      const second = ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1002", estimatedCents: 300_000 }),
      );

      expect(first.approved).toBe(true);
      expect(second.approved).toBe(false);
      expect(second.outcome).toBe("INSUFFICIENT_AVAILABLE");
      expect(second.shortfallCents).toBe(100_000);
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(300_000);
    });

    test("an order for exactly the available balance is approved", () => {
      const result = ledger.approvePurchaseOrder(po({ estimatedCents: ALLOCATION }));
      expect(result.approved).toBe(true);
      expect(ledger.balanceOf(LINE).availableCents).toBe(0);
    });

    test("an order one cent over available is refused", () => {
      const result = ledger.approvePurchaseOrder(po({ estimatedCents: ALLOCATION + 1 }));
      expect(result.outcome).toBe("INSUFFICIENT_AVAILABLE");
      expect(result.shortfallCents).toBe(1);
    });

    test("a refusal leaves the line untouched", () => {
      ledger.approvePurchaseOrder(po({ estimatedCents: ALLOCATION + 1 }));
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION);
      expect(ledger.eventsFor(LINE)).toHaveLength(1);
    });

    test("an unknown line is refused rather than throwing", () => {
      const result = ledger.approvePurchaseOrder(po({ lineId: "line-missing" }));
      expect(result.outcome).toBe("LINE_NOT_FOUND");
      expect(result.approved).toBe(false);
    });

    test("the same purchase order cannot be approved twice", () => {
      ledger.approvePurchaseOrder(po());
      const again = ledger.approvePurchaseOrder(po());
      expect(again.outcome).toBe("DUPLICATE_PURCHASE_ORDER");
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(120_000);
    });

    test("an approval dated on or after the close is refused", () => {
      const result = ledger.approvePurchaseOrder(po({ approvedAt: YEAR_CLOSE }));
      expect(result.outcome).toBe("LINE_CLOSED");
    });

    test("an approval after the line was swept is refused", () => {
      ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);
      const result = ledger.approvePurchaseOrder(po({ approvedAt: day(11) }));
      expect(result.outcome).toBe("LINE_CLOSED");
    });

    test("rejects a non-positive commitment", () => {
      expect(() => ledger.approvePurchaseOrder(po({ estimatedCents: 0 }))).toThrow(/positive/i);
    });

    test("rejects a fractional commitment", () => {
      expect(() => ledger.approvePurchaseOrder(po({ estimatedCents: 1.5 }))).toThrow(/integer/i);
    });

    test("commitments on one line do not touch another", () => {
      ledger.openLine(line({ lineId: "line-travel", category: "Travel" }));
      ledger.approvePurchaseOrder(po({ estimatedCents: 400_000 }));
      expect(ledger.balanceOf("line-travel").availableCents).toBe(ALLOCATION);
    });

    test("committedTo lists the live commitments on a line", () => {
      ledger.approvePurchaseOrder(po());
      ledger.approvePurchaseOrder(po({ purchaseOrderId: "PO-1002", estimatedCents: 20_000 }));
      const live = ledger.committedTo(LINE);
      expect(live.map((entry) => entry.purchaseOrderId)).toEqual(["PO-1001", "PO-1002"]);
      expect(live.every((entry) => entry.status === "OPEN")).toBe(true);
    });
  });

  describe("liquidation matching the estimate", () => {
    test("an invoice equal to the estimate settles the order exactly", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: true,
      });

      expect(result.outcome).toBe("LIQUIDATED_IN_FULL");
      expect(result.releasedCents).toBe(0);

      const balance = ledger.balanceOf(LINE);
      expect(balance.encumberedCents).toBe(0);
      expect(balance.liquidatedCents).toBe(120_000);
      expect(balance.availableCents).toBe(ALLOCATION - 120_000);
    });

    test("a settled order is no longer a live commitment", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: true,
      });
      expect(ledger.committedTo(LINE)).toHaveLength(0);
      expect(ledger.encumbranceFor("PO-1001")?.status).toBe("LIQUIDATED");
    });
  });

  describe("liquidation under the estimate", () => {
    test("a final invoice under the estimate returns the difference to the line", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 95_000,
        occurredAt: day(30),
        final: true,
      });

      expect(result.outcome).toBe("LIQUIDATED_WITH_UNDERRUN_RELEASED");
      expect(result.releasedCents).toBe(25_000);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION - 95_000);
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(0);
    });

    test("a non-final invoice under the estimate holds the rest committed", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-DEPOSIT",
        invoicedCents: 40_000,
        occurredAt: day(20),
        final: false,
      });

      expect(result.outcome).toBe("PARTIALLY_LIQUIDATED");
      // The deposit is spent; the balance of the order is still committed and
      // must not become spendable just because the first invoice was small.
      const balance = ledger.balanceOf(LINE);
      expect(balance.liquidatedCents).toBe(40_000);
      expect(balance.encumberedCents).toBe(80_000);
      expect(balance.availableCents).toBe(ALLOCATION - 120_000);
    });

    test("a deposit then a balance invoice settles the order across two calls", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-DEPOSIT",
        invoicedCents: 40_000,
        occurredAt: day(20),
        final: false,
      });
      const second = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-BALANCE",
        invoicedCents: 70_000,
        occurredAt: day(31),
        final: true,
      });

      expect(second.outcome).toBe("LIQUIDATED_WITH_UNDERRUN_RELEASED");
      expect(second.releasedCents).toBe(10_000);
      const balance = ledger.balanceOf(LINE);
      expect(balance.liquidatedCents).toBe(110_000);
      expect(balance.encumberedCents).toBe(0);
      expect(balance.availableCents).toBe(ALLOCATION - 110_000);
    });

    test("a non-final invoice that happens to consume the estimate still settles", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: false,
      });
      expect(result.outcome).toBe("LIQUIDATED_IN_FULL");
      expect(ledger.encumbranceFor("PO-1001")?.status).toBe("LIQUIDATED");
    });
  });

  describe("liquidation over the estimate", () => {
    test("an overage that fits in the line is allowed and draws it down", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 140_000,
        occurredAt: day(30),
        final: true,
      });

      expect(result.outcome).toBe("LIQUIDATED_IN_FULL");
      expect(result.overageCents).toBe(20_000);
      const balance = ledger.balanceOf(LINE);
      expect(balance.liquidatedCents).toBe(140_000);
      expect(balance.encumberedCents).toBe(0);
      expect(balance.availableCents).toBe(ALLOCATION - 140_000);
    });

    test("an overage larger than the line's remaining available is refused", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po({ estimatedCents: 100_000 }));
      // Commit the rest of the line elsewhere so only 100,000 is left free.
      ledger.approvePurchaseOrder(po({ purchaseOrderId: "PO-1002", estimatedCents: 300_000 }));

      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 250_000,
        occurredAt: day(30),
        final: true,
      });

      expect(result.outcome).toBe("REFUSED_OVERAGE_EXCEEDS_AVAILABLE");
      expect(result.overageCents).toBe(150_000);
      expect(result.liquidatedCents).toBe(0);
    });

    test("a refused overage writes nothing to the log", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po({ estimatedCents: 100_000 }));
      ledger.approvePurchaseOrder(po({ purchaseOrderId: "PO-1002", estimatedCents: 400_000 }));
      const before = ledger.eventsFor(LINE).length;

      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 250_000,
        occurredAt: day(30),
        final: true,
      });

      expect(ledger.eventsFor(LINE)).toHaveLength(before);
      expect(ledger.encumbranceFor("PO-1001")?.status).toBe("OPEN");
    });

    test("an overage of exactly the remaining available is allowed", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po({ estimatedCents: 100_000 }));
      ledger.approvePurchaseOrder(po({ purchaseOrderId: "PO-1002", estimatedCents: 300_000 }));

      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 200_000,
        occurredAt: day(30),
        final: true,
      });

      expect(result.outcome).toBe("LIQUIDATED_IN_FULL");
      expect(ledger.balanceOf(LINE).availableCents).toBe(0);
    });

    test("an overage on a partially liquidated order is measured against what is left", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-DEPOSIT",
        invoicedCents: 100_000,
        occurredAt: day(20),
        final: false,
      });
      const second = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-BALANCE",
        invoicedCents: 45_000,
        occurredAt: day(31),
        final: true,
      });

      // 20,000 of commitment was left, so only 25,000 is genuinely new spend.
      expect(second.overageCents).toBe(25_000);
      expect(ledger.balanceOf(LINE).liquidatedCents).toBe(145_000);
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(0);
    });
  });

  describe("liquidation guards", () => {
    test("an unknown encumbrance is refused rather than throwing", () => {
      const result = ledger.liquidate({
        encumbranceId: "ENC-999999",
        invoiceId: "INV-1",
        invoicedCents: 1_000,
        occurredAt: day(30),
        final: true,
      });
      expect(result.outcome).toBe("REFUSED_UNKNOWN_ENCUMBRANCE");
      expect(result.status).toBeNull();
    });

    test("a settled order cannot be liquidated again", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: true,
      });
      const again = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-2",
        invoicedCents: 5_000,
        occurredAt: day(31),
        final: true,
      });
      expect(again.outcome).toBe("REFUSED_NOT_LIQUIDATABLE");
      expect(ledger.balanceOf(LINE).liquidatedCents).toBe(120_000);
    });

    test("a cancelled order cannot be liquidated", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.cancelPurchaseOrder(encumbranceId!, day(25), "Vendor withdrew");
      const result = ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 1_000,
        occurredAt: day(30),
        final: true,
      });
      expect(result.outcome).toBe("REFUSED_NOT_LIQUIDATABLE");
      expect(result.status).toBe("CANCELLED");
    });

    test("rejects a non-positive invoice", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      expect(() =>
        ledger.liquidate({
          encumbranceId: encumbranceId!,
          invoiceId: "INV-1",
          invoicedCents: 0,
          occurredAt: day(30),
          final: true,
        }),
      ).toThrow(/positive/i);
    });
  });

  describe("cancellation", () => {
    test("cancelling an untouched order returns the whole commitment", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.cancelPurchaseOrder(encumbranceId!, day(25), "Event cancelled");

      expect(result.outcome).toBe("CANCELLED");
      expect(result.releasedCents).toBe(120_000);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION);
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(0);
    });

    test("cancelling a partly invoiced order returns only what is left", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-DEPOSIT",
        invoicedCents: 40_000,
        occurredAt: day(20),
        final: false,
      });
      const result = ledger.cancelPurchaseOrder(encumbranceId!, day(25), "Event cancelled");

      expect(result.releasedCents).toBe(80_000);
      // The deposit stays spent. Cancelling an order does not un-pay it.
      expect(ledger.balanceOf(LINE).liquidatedCents).toBe(40_000);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION - 40_000);
    });

    test("cancelling a settled order is refused rather than releasing twice", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: true,
      });
      const result = ledger.cancelPurchaseOrder(encumbranceId!, day(31), "too late");

      expect(result.outcome).toBe("REFUSED_ALREADY_SETTLED");
      expect(result.releasedCents).toBe(0);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION - 120_000);
    });

    test("cancelling twice releases once", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.cancelPurchaseOrder(encumbranceId!, day(25), "Event cancelled");
      const again = ledger.cancelPurchaseOrder(encumbranceId!, day(26), "again");

      expect(again.outcome).toBe("REFUSED_ALREADY_SETTLED");
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION);
    });

    test("cancelling an unknown order is refused rather than throwing", () => {
      const result = ledger.cancelPurchaseOrder("ENC-999999", day(25), "x");
      expect(result.outcome).toBe("REFUSED_UNKNOWN_ENCUMBRANCE");
    });

    test("cancelling frees the money for a later order", () => {
      const first = ledger.approvePurchaseOrder(po({ estimatedCents: 450_000 }));
      const blocked = ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1002", estimatedCents: 100_000 }),
      );
      expect(blocked.outcome).toBe("INSUFFICIENT_AVAILABLE");

      ledger.cancelPurchaseOrder(first.encumbranceId!, day(15), "Vendor withdrew");
      const retried = ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1003", estimatedCents: 100_000, approvedAt: day(16) }),
      );
      expect(retried.approved).toBe(true);
    });
  });

  describe("the fiscal year close sweep", () => {
    test("an unliquidated order is expired and its commitment returned", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      const result = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(result.expiredEncumbranceIds).toEqual([encumbranceId]);
      expect(result.releasedCents).toBe(120_000);
      expect(ledger.balanceOf(LINE).encumberedCents).toBe(0);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION);
    });

    test("a partly invoiced order is swept for its remainder only", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-DEPOSIT",
        invoicedCents: 40_000,
        occurredAt: day(20),
        final: false,
      });
      const result = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(result.releasedCents).toBe(80_000);
      expect(ledger.balanceOf(LINE).liquidatedCents).toBe(40_000);
    });

    test("a settled order is left alone by the sweep", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 120_000,
        occurredAt: day(30),
        final: true,
      });
      const result = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(result.expiredEncumbranceIds).toHaveLength(0);
      expect(result.releasedCents).toBe(0);
      expect(ledger.encumbranceFor("PO-1001")?.status).toBe("LIQUIDATED");
    });

    test("a second sweep releases nothing", () => {
      ledger.approvePurchaseOrder(po());
      const first = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);
      const eventsAfterFirst = ledger.eventsFor(LINE).length;
      const second = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(first.releasedCents).toBe(120_000);
      expect(second.releasedCents).toBe(0);
      expect(second.expiredEncumbranceIds).toHaveLength(0);
      expect(ledger.eventsFor(LINE)).toHaveLength(eventsAfterFirst);
      expect(ledger.balanceOf(LINE).availableCents).toBe(ALLOCATION);
    });

    test("the sweep expires every live order on the line", () => {
      ledger.approvePurchaseOrder(po({ estimatedCents: 100_000 }));
      ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1002", estimatedCents: 60_000, approvedAt: day(12) }),
      );
      const result = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(result.expiredEncumbranceIds).toHaveLength(2);
      expect(result.releasedCents).toBe(160_000);
    });

    test("sweeping before the close date is refused", () => {
      expect(() => ledger.sweepFiscalYearClose(LINE, day(100))).toThrow(/before its close date/i);
    });

    test("sweeping an unknown line throws", () => {
      expect(() => ledger.sweepFiscalYearClose("line-missing", YEAR_CLOSE)).toThrow(/Unknown/i);
    });

    test("the sweep does not reach into another line", () => {
      ledger.openLine(line({ lineId: "line-travel", category: "Travel" }));
      ledger.approvePurchaseOrder(po({ lineId: "line-travel", estimatedCents: 70_000 }));
      const result = ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      expect(result.expiredEncumbranceIds).toHaveLength(0);
      expect(ledger.balanceOf("line-travel").encumberedCents).toBe(70_000);
    });
  });

  describe("reconstruction from the log", () => {
    test("a balance as of a past instant ignores everything after it", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 95_000,
        occurredAt: day(30),
        final: true,
      });

      const midOrder = ledger.balanceAsOf(LINE, day(20));
      expect(midOrder.encumberedCents).toBe(120_000);
      expect(midOrder.liquidatedCents).toBe(0);
      expect(midOrder.availableCents).toBe(ALLOCATION - 120_000);
    });

    test("a balance as of before the line opened is empty", () => {
      ledger.approvePurchaseOrder(po());
      const balance = ledger.balanceAsOf(LINE, day(-1));
      expect(balance.allocatedCents).toBe(0);
      expect(balance.availableCents).toBe(0);
    });

    test("the as-of balance on the instant of an event includes it", () => {
      ledger.approvePurchaseOrder(po());
      expect(ledger.balanceAsOf(LINE, day(10)).encumberedCents).toBe(120_000);
    });

    test("the current balance equals the as-of balance at the last event", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 95_000,
        occurredAt: day(30),
        final: true,
      });
      expect(ledger.balanceAsOf(LINE, day(30))).toEqual(ledger.balanceOf(LINE));
    });

    test("every release is tagged with why it happened", () => {
      const cancelled = ledger.approvePurchaseOrder(po({ estimatedCents: 50_000 }));
      const underspent = ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1002", estimatedCents: 50_000, approvedAt: day(11) }),
      );
      ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1003", estimatedCents: 50_000, approvedAt: day(12) }),
      );

      ledger.cancelPurchaseOrder(cancelled.encumbranceId!, day(15), "Vendor withdrew");
      ledger.liquidate({
        encumbranceId: underspent.encumbranceId!,
        invoiceId: "INV-2",
        invoicedCents: 30_000,
        occurredAt: day(20),
        final: true,
      });
      ledger.sweepFiscalYearClose(LINE, YEAR_CLOSE);

      const reasons = ledger
        .eventsFor(LINE)
        .filter((event) => event.reason !== null)
        .map((event) => event.reason);

      expect(reasons).toEqual(["CANCELLATION", "LIQUIDATION_UNDERRUN", "FISCAL_YEAR_CLOSE"]);
    });

    test("the log is append-only and strictly sequenced", () => {
      const { encumbranceId } = ledger.approvePurchaseOrder(po());
      ledger.liquidate({
        encumbranceId: encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 95_000,
        occurredAt: day(30),
        final: true,
      });

      const sequences = ledger.eventsFor(LINE).map((event) => event.sequence);
      expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
      expect(new Set(sequences).size).toBe(sequences.length);
    });

    test("a full year of activity leaves available consistent with the buckets", () => {
      const first = ledger.approvePurchaseOrder(po({ estimatedCents: 150_000 }));
      const second = ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1002", estimatedCents: 90_000, approvedAt: day(40) }),
      );
      ledger.approvePurchaseOrder(
        po({ purchaseOrderId: "PO-1003", estimatedCents: 60_000, approvedAt: day(70) }),
      );

      ledger.liquidate({
        encumbranceId: first.encumbranceId!,
        invoiceId: "INV-1",
        invoicedCents: 148_500,
        occurredAt: day(55),
        final: true,
      });
      ledger.cancelPurchaseOrder(second.encumbranceId!, day(60), "Trip cancelled");

      const balance = ledger.balanceOf(LINE);
      expect(balance.liquidatedCents).toBe(148_500);
      expect(balance.encumberedCents).toBe(60_000);
      expect(balance.availableCents).toBe(
        balance.allocatedCents - balance.liquidatedCents - balance.encumberedCents,
      );
      expect(balance.availableCents).toBe(291_500);
    });
  });
});
