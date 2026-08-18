import { describe, it, expect } from "vitest";
import { calculateClubBalanceSummary } from "./clubFinances";
import {
  DEFAULT_DENOMINATIONS,
  DEFAULT_THRESHOLDS,
  countTotal,
  implausibleQuantities,
  expectedCash,
  classifyVariance,
  reconcileDrawer,
  reconcileEvent,
  validateCustodyChain,
  toFinancialTransactions,
  type Drawer,
  type DoorEntry,
  type DrawerCount,
  type CustodyTransfer,
} from "./doorCashReconciliation";

const SETTLED_AT = "2026-11-07T23:45:00.000Z";

function count(
  quantities: Record<string, number>,
  stage: DrawerCount["stage"] = "OPENING",
): DrawerCount {
  return { stage, quantities, countedBy: "u_treasurer", countedAt: SETTLED_AT };
}

function entry(overrides: Partial<DoorEntry> & { id: string }): DoorEntry {
  return {
    kind: "SALE",
    amountMinor: 1500,
    soldBy: "u_door",
    occurredAt: "2026-11-07T20:00:00.000Z",
    ...overrides,
  };
}

function drawer(overrides: Partial<Drawer> = {}): Drawer {
  return {
    drawerId: "d_1",
    eventId: "e_1",
    clubId: "c_1",
    label: "Main door",
    opening: count({ 1000: 10 }),
    closing: count({ 10000: 1, 2000: 1, 1000: 1 }, "CLOSING"),
    entries: [
      entry({ id: "s_1" }),
      entry({ id: "s_2" }),
      entry({ id: "s_3" }),
      entry({ id: "r_1", kind: "REFUND", reason: "Duplicate sale" }),
    ],
    ...overrides,
  };
}

describe("Door Cash Reconciliation (#3400)", () => {
  describe("denomination counting", () => {
    it("sums a breakdown rather than trusting a typed total", () => {
      expect(countTotal(count({ 2000: 3, 500: 4, 100: 7 }))).toBe(8700);
    });

    it("counts an empty drawer as zero", () => {
      expect(countTotal(count({}))).toBe(0);
    });

    it("ignores a negative quantity instead of subtracting it", () => {
      expect(countTotal(count({ 1000: 5, 500: -3 }))).toBe(5000);
    });

    it("ignores a fractional quantity rather than producing fractional cash", () => {
      expect(countTotal(count({ 1000: 2.7 }))).toBe(2000);
    });

    it("stays exact on a total that would drift in floating point", () => {
      // 3 x $0.10 + 3 x $0.20 is exactly 90 cents, which 0.1 + 0.2 is not.
      expect(countTotal(count({ 10: 3, 20: 3 }))).toBe(90);
    });
  });

  describe("miscount detection", () => {
    it("flags an unrecognised denomination", () => {
      expect(implausibleQuantities(count({ 99: 3 })).join(" ")).toContain(
        "Unrecognised denomination",
      );
    });

    it("flags an implausible quantity of one denomination", () => {
      expect(implausibleQuantities(count({ 1: 400 })).join(" ")).toContain("looks like a miscount");
    });

    it("flags a negative quantity", () => {
      expect(implausibleQuantities(count({ 100: -2 })).join(" ")).toContain("Negative quantity");
    });

    it("says nothing about an ordinary drawer", () => {
      expect(implausibleQuantities(count({ 2000: 5, 500: 10, 100: 20 }))).toEqual([]);
    });

    it("recognises every default denomination", () => {
      const quantities = Object.fromEntries(DEFAULT_DENOMINATIONS.map((d) => [String(d), 1]));
      expect(implausibleQuantities(count(quantities))).toEqual([]);
    });
  });

  describe("expected cash", () => {
    it("derives the expected total from the entries", () => {
      // $100 float + 3 x $15 sales - one $15 refund.
      const result = expectedCash(drawer());

      expect(result.grossSalesMinor).toBe(4500);
      expect(result.refundsMinor).toBe(1500);
      expect(result.expectedMinor).toBe(13_000);
    });

    it("subtracts a mid-shift payout to the safe", () => {
      const result = expectedCash(
        drawer({
          entries: [entry({ id: "s_1" }), entry({ id: "p_1", kind: "PAYOUT", amountMinor: 1000 })],
        }),
      );

      expect(result.payoutsMinor).toBe(1000);
      expect(result.expectedMinor).toBe(10_000 + 1500 - 1000);
    });

    it("nets a voided sale to nothing without deleting either row", () => {
      const withVoid = drawer({
        entries: [
          entry({ id: "s_1" }),
          entry({ id: "s_2" }),
          entry({
            id: "v_1",
            kind: "VOID",
            amountMinor: 1500,
            voidsEntryId: "s_2",
            reason: "Wrong tier",
          }),
        ],
      });

      expect(expectedCash(withVoid).grossSalesMinor).toBe(1500);
      // Both rows survive; a void that leaves no trace is indistinguishable
      // from theft, which is exactly why they stay.
      expect(withVoid.entries).toHaveLength(3);
    });

    it("counts a comp towards attendance and not towards cash", () => {
      const withComp = drawer({
        entries: [entry({ id: "s_1" }), entry({ id: "c_1", kind: "COMP", amountMinor: 0 })],
      });

      const result = reconcileDrawer(withComp);
      expect(result.grossSalesMinor).toBe(1500);
      expect(result.compCount).toBe(1);
      expect(result.admittedCount).toBe(2);
    });

    it("does not admit a voided sale", () => {
      const result = reconcileDrawer(
        drawer({
          entries: [
            entry({ id: "s_1" }),
            entry({
              id: "v_1",
              kind: "VOID",
              amountMinor: 1500,
              voidsEntryId: "s_1",
              reason: "Cancelled",
            }),
          ],
        }),
      );

      expect(result.admittedCount).toBe(0);
    });

    it("honours the price each ticket was actually charged at", () => {
      const tiered = drawer({
        entries: [
          entry({ id: "s_1", amountMinor: 2000, ticketTier: "general" }),
          entry({ id: "s_2", amountMinor: 1000, ticketTier: "student" }),
          entry({ id: "s_3", amountMinor: 500, ticketTier: "member-discount" }),
        ],
      });

      expect(expectedCash(tiered).grossSalesMinor).toBe(3500);
    });
  });

  describe("variance bands", () => {
    it("reports an exact match as balanced", () => {
      expect(classifyVariance(0, 100_000)).toBe("BALANCED");
    });

    it("absorbs counting noise below the absolute floor", () => {
      expect(classifyVariance(-150, 100_000)).toBe("WITHIN_TOLERANCE");
    });

    it("still tolerates a small proportion above the floor", () => {
      expect(classifyVariance(-500, 100_000)).toBe("WITHIN_TOLERANCE");
    });

    it("escalates by proportion on a large night", () => {
      expect(classifyVariance(-1500, 100_000)).toBe("INVESTIGATE");
      expect(classifyVariance(-6000, 100_000)).toBe("ESCALATE");
    });

    it("escalates on the absolute floor however large the takings", () => {
      // A flat percentage alone would hide $100 inside a very large night.
      expect(classifyVariance(-20_000, 10_000_000)).toBe("ESCALATE");
    });

    it("grades an overage exactly as it grades a shortage", () => {
      // Money the ledger does not know about usually means an unrecorded sale,
      // which is the same failure seen from the other side.
      expect(classifyVariance(1500, 100_000)).toBe("INVESTIGATE");
      expect(classifyVariance(-1500, 100_000)).toBe("INVESTIGATE");
    });

    it("escalates any cash in a drawer that took nothing", () => {
      expect(classifyVariance(500, 0)).toBe("ESCALATE");
    });

    it("respects a campus's own thresholds", () => {
      const strict = { ...DEFAULT_THRESHOLDS, investigateFraction: 0.001 };

      expect(classifyVariance(-500, 100_000)).toBe("WITHIN_TOLERANCE");
      expect(classifyVariance(-500, 100_000, strict)).toBe("INVESTIGATE");
    });
  });

  describe("drawer reconciliation", () => {
    it("balances a drawer that counted down correctly", () => {
      const result = reconcileDrawer(drawer());

      expect(result.expectedMinor).toBe(13_000);
      expect(result.countedMinor).toBe(13_000);
      expect(result.varianceMinor).toBe(0);
      expect(result.balanced).toBe(true);
      expect(result.band).toBe("BALANCED");
    });

    it("reports the shortfall when the count comes up short", () => {
      const result = reconcileDrawer(
        drawer({ closing: count({ 10000: 1, 2000: 1, 500: 1 }, "CLOSING") }),
      );

      expect(result.varianceMinor).toBe(-500);
    });

    it("treats an uncounted drawer as unresolved rather than balanced", () => {
      const result = reconcileDrawer(drawer({ closing: null }));

      expect(result.balanced).toBe(false);
      expect(result.band).toBe("ESCALATE");
      expect(result.anomalies.join(" ")).toContain("not been counted down");
    });

    it("flags a void with no reason recorded", () => {
      const result = reconcileDrawer(
        drawer({
          entries: [
            entry({ id: "s_1" }),
            entry({ id: "v_1", kind: "VOID", amountMinor: 1500, voidsEntryId: "s_1" }),
          ],
        }),
      );

      expect(result.anomalies.join(" ")).toContain("no reason recorded");
    });

    it("flags a void pointing at a sale that is not in this drawer", () => {
      const result = reconcileDrawer(
        drawer({
          entries: [
            entry({ id: "s_1" }),
            entry({
              id: "v_1",
              kind: "VOID",
              amountMinor: 1500,
              voidsEntryId: "s_elsewhere",
              reason: "x",
            }),
          ],
        }),
      );

      expect(result.anomalies.join(" ")).toContain("which is not in this drawer");
    });

    it("flags a comp carrying money", () => {
      const result = reconcileDrawer(
        drawer({ entries: [entry({ id: "c_1", kind: "COMP", amountMinor: 500 })] }),
      );

      expect(result.anomalies.join(" ")).toContain("non-zero amount");
    });

    it("does not count the float as takings", () => {
      const result = reconcileDrawer(drawer());
      expect(result.grossSalesMinor).toBe(4500);
      expect(result.openingFloatMinor).toBe(10_000);
    });

    it("orders anomalies deterministically", () => {
      const messy = drawer({ opening: count({ 99: 1, 1: 500 }) });
      expect(reconcileDrawer(messy).anomalies).toEqual(
        [...reconcileDrawer(messy).anomalies].sort(),
      );
    });
  });

  describe("multiple drawers", () => {
    const doors: Drawer[] = [
      drawer({ drawerId: "d_2", label: "North door" }),
      drawer({ drawerId: "d_1", label: "Main door" }),
      drawer({
        drawerId: "d_3",
        label: "South door",
        closing: count({ 10000: 1 }, "CLOSING"),
      }),
    ];

    it("reconciles each door independently rather than merging the counts", () => {
      // The whole value: two doors balance, so the search is confined to one.
      const result = reconcileEvent(doors);

      expect(result.drawers).toHaveLength(3);
      expect(result.offending.map((d) => d.label)).toEqual(["South door"]);
    });

    it("rolls the drawers up into an event total", () => {
      const result = reconcileEvent(doors);

      expect(result.totalExpectedMinor).toBe(39_000);
      expect(result.totalCountedMinor).toBe(36_000);
      expect(result.totalVarianceMinor).toBe(-3000);
    });

    it("orders drawers deterministically by label", () => {
      expect(reconcileEvent(doors).drawers.map((d) => d.label)).toEqual([
        "Main door",
        "North door",
        "South door",
      ]);
    });

    it("totals attendance across every door", () => {
      expect(reconcileEvent(doors).totalAdmitted).toBe(9);
    });

    it("handles an event with no cash doors at all", () => {
      const empty = reconcileEvent([]);
      expect(empty.totalVarianceMinor).toBe(0);
      expect(empty.band).toBe("BALANCED");
    });
  });

  describe("chain of custody", () => {
    function transfer(overrides: Partial<CustodyTransfer> & { id: string }): CustodyTransfer {
      return {
        fromUserId: "u_door",
        toUserId: "u_treasurer",
        amountMinor: 13_000,
        occurredAt: "2026-11-07T23:00:00.000Z",
        ...overrides,
      };
    }

    it("accepts an unbroken chain", () => {
      const result = validateCustodyChain(
        [
          transfer({ id: "t_1", fromUserId: "u_door", toUserId: "u_lead" }),
          transfer({
            id: "t_2",
            fromUserId: "u_lead",
            toUserId: "u_treasurer",
            occurredAt: "2026-11-07T23:30:00.000Z",
          }),
        ],
        13_000,
      );

      expect(result.faults).toEqual([]);
      expect(result.finalHolder).toBe("u_treasurer");
    });

    it("names the segment where the amount changed", () => {
      // The point of the chain: not "we are short somewhere", but which
      // handover the money changed across.
      const result = validateCustodyChain(
        [
          transfer({ id: "t_1", fromUserId: "u_door", toUserId: "u_lead" }),
          transfer({
            id: "t_2",
            fromUserId: "u_lead",
            toUserId: "u_treasurer",
            amountMinor: 11_200,
            occurredAt: "2026-11-07T23:30:00.000Z",
          }),
        ],
        13_000,
      );

      const fault = result.faults.find((f) => f.kind === "AMOUNT_CHANGED");
      expect(fault?.transferId).toBe("t_2");
      expect(fault?.fromUserId).toBe("u_lead");
      expect(fault?.deltaMinor).toBe(-1800);
    });

    it("detects a handover from somebody who was not holding the money", () => {
      const result = validateCustodyChain(
        [
          transfer({ id: "t_1", fromUserId: "u_door", toUserId: "u_lead" }),
          transfer({
            id: "t_2",
            fromUserId: "u_stranger",
            toUserId: "u_treasurer",
            occurredAt: "2026-11-07T23:30:00.000Z",
          }),
        ],
        13_000,
      );

      expect(result.faults.some((f) => f.kind === "BROKEN_CHAIN")).toBe(true);
    });

    it("detects a handover to the person already holding it", () => {
      const result = validateCustodyChain(
        [transfer({ id: "t_1", fromUserId: "u_lead", toUserId: "u_lead" })],
        13_000,
      );

      expect(result.faults.some((f) => f.kind === "OUT_OF_ORDER")).toBe(true);
    });

    it("catches a discrepancy on the very first handover", () => {
      const result = validateCustodyChain([transfer({ id: "t_1", amountMinor: 12_000 })], 13_000);

      expect(result.faults[0].kind).toBe("AMOUNT_CHANGED");
      expect(result.faults[0].deltaMinor).toBe(-1000);
    });

    it("orders by time rather than by the order it was handed the list", () => {
      const result = validateCustodyChain(
        [
          transfer({
            id: "t_2",
            fromUserId: "u_lead",
            toUserId: "u_treasurer",
            occurredAt: "2026-11-07T23:30:00.000Z",
          }),
          transfer({ id: "t_1", fromUserId: "u_door", toUserId: "u_lead" }),
        ],
        13_000,
      );

      expect(result.faults).toEqual([]);
    });

    it("reports money still sitting with the door volunteer", () => {
      const result = validateCustodyChain([], 13_000);

      expect(result.finalHolder).toBeNull();
      expect(result.finalAmountMinor).toBe(13_000);
    });
  });

  describe("settlement into the club ledger", () => {
    const context = { clubId: "c_1", eventId: "e_1", settledAt: SETTLED_AT };

    it("emits takings and refunds as separate ledger lines", () => {
      const transactions = toFinancialTransactions(reconcileDrawer(drawer()), context);

      expect(transactions.find((t) => t.category === "Door Sales (Cash)")?.amount).toBe(45);
      expect(transactions.find((t) => t.category === "Door Refunds (Cash)")?.amount).toBe(-15);
    });

    it("does not post the float as income", () => {
      // The float was the club's money before the doors opened; counting it as
      // takings would inflate every event by the size of its own change box.
      const transactions = toFinancialTransactions(reconcileDrawer(drawer()), context);

      expect(transactions.some((t) => t.amount === 100)).toBe(false);
    });

    it("posts a shortage as its own line rather than netting it off the takings", () => {
      const short = reconcileDrawer(
        drawer({ closing: count({ 10000: 1, 2000: 1, 500: 1 }, "CLOSING") }),
      );
      const transactions = toFinancialTransactions(short, context);

      expect(transactions.find((t) => t.category === "Door Sales (Cash)")?.amount).toBe(45);
      expect(transactions.find((t) => t.category === "Cash Shortage")?.amount).toBe(-5);
    });

    it("posts an overage as income under its own category", () => {
      const over = reconcileDrawer(
        drawer({ closing: count({ 10000: 1, 2000: 1, 1000: 1, 500: 1 }, "CLOSING") }),
      );
      const transactions = toFinancialTransactions(over, context);

      expect(transactions.find((t) => t.category === "Cash Overage")?.amount).toBe(5);
    });

    it("emits no variance line for a balanced drawer", () => {
      const transactions = toFinancialTransactions(reconcileDrawer(drawer()), context);
      expect(transactions.some((t) => t.category.startsWith("Cash "))).toBe(false);
    });

    it("feeds the existing balance summary without adaptation", () => {
      const transactions = toFinancialTransactions(reconcileDrawer(drawer()), context);
      const summary = calculateClubBalanceSummary(transactions, "c_1");

      expect(summary.totalIncome).toBe(45);
      expect(summary.totalExpense).toBe(15);
      expect(summary.netBalance).toBe(30);
    });

    it("converts to major units only at the ledger boundary", () => {
      const odd = reconcileDrawer(
        drawer({
          entries: [entry({ id: "s_1", amountMinor: 1234 })],
          closing: count({ 10000: 1, 1000: 1, 200: 1, 25: 1, 5: 1, 1: 4 }, "CLOSING"),
        }),
      );

      expect(odd.grossSalesMinor).toBe(1234);
      expect(toFinancialTransactions(odd, context)[0].amount).toBe(12.34);
    });
  });
});
