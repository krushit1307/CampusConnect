/**
 * Test suite: Equipment Security Deposit Hold & Damage Settlement Ledger (#4389)
 * File: tests/services/equipmentDepositLedgerService.test.ts
 *
 * The invariant under test throughout is:
 *
 *     released + forfeited === held
 *     forfeited === min(assessed damage, held)
 *
 * with damage beyond the deposit reported as a shortfall rather than pushing
 * the release negative.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  EquipmentDepositLedgerService,
  RELEASE_WINDOW_DAYS,
  type OpenHoldRequest,
  type Deduction,
} from "../../src/services/equipmentDepositLedgerService";

const CLUB = "club-photography";
const BORROWER = "user-borrower";
const OFFICER = "user-officer";

const HELD_AT = new Date("2026-03-01T09:00:00.000Z");
const DUE_BACK_AT = new Date("2026-03-08T09:00:00.000Z");
const RETURNED_AT = new Date("2026-03-07T16:00:00.000Z");
const SETTLED_AT = new Date("2026-03-09T11:00:00.000Z");

/** A 2000.00 deposit in minor units. */
const DEPOSIT_MINOR = 200_000;

function holdRequest(overrides: Partial<OpenHoldRequest> = {}): OpenHoldRequest {
  return {
    holdId: "HOLD-0001",
    assetTag: "CAM-BODY-A1",
    clubId: CLUB,
    borrowerUserId: BORROWER,
    heldMinor: DEPOSIT_MINOR,
    currency: "INR",
    heldAt: HELD_AT,
    dueBackAt: DUE_BACK_AT,
    ...overrides,
  };
}

function deduction(overrides: Partial<Deduction> = {}): Deduction {
  return {
    reason: "Cracked lens filter",
    amountMinor: 50_000,
    assessedBy: OFFICER,
    assessedAt: SETTLED_AT,
    ...overrides,
  };
}

describe("EquipmentDepositLedgerService (#4389)", () => {
  let service: EquipmentDepositLedgerService;

  beforeEach(() => {
    service = new EquipmentDepositLedgerService();
  });

  describe("opening a hold", () => {
    test("records the held balance", () => {
      const hold = service.openHold(holdRequest());

      expect(hold.status).toBe("HELD");
      expect(hold.heldMinor).toBe(DEPOSIT_MINOR);
      expect(hold.returnedAt).toBeNull();
    });

    test("rejects a duplicate hold id", () => {
      service.openHold(holdRequest());
      expect(() => service.openHold(holdRequest())).toThrow(/already exists/i);
    });

    test("rejects a fractional deposit", () => {
      expect(() => service.openHold(holdRequest({ heldMinor: 1999.5 }))).toThrow(
        /integer number of minor units/i,
      );
    });

    test("rejects a negative deposit", () => {
      expect(() => service.openHold(holdRequest({ heldMinor: -1 }))).toThrow(/cannot be negative/i);
    });

    test("rejects a zero deposit outright rather than tracking a no-op", () => {
      expect(() => service.openHold(holdRequest({ heldMinor: 0 }))).toThrow(/is not a hold/i);
    });

    test("rejects a malformed currency", () => {
      expect(() => service.openHold(holdRequest({ currency: "rupees" }))).toThrow(
        /three-letter ISO code/i,
      );
    });

    test("rejects a return date at or before check-out", () => {
      expect(() => service.openHold(holdRequest({ dueBackAt: HELD_AT }))).toThrow(
        /must fall after the check-out date/i,
      );
    });

    test("rejects a hold with no borrower", () => {
      expect(() => service.openHold(holdRequest({ borrowerUserId: "" }))).toThrow(
        /requires a borrower/i,
      );
    });

    test("rejects a blank hold id", () => {
      expect(() => service.openHold(holdRequest({ holdId: "  " }))).toThrow(/requires an id/i);
    });
  });

  describe("returns", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
    });

    test("a clean return stays HELD, pending release", () => {
      const hold = service.recordReturn("HOLD-0001", RETURNED_AT, true);

      expect(hold.status).toBe("HELD");
      expect(hold.returnedUndamaged).toBe(true);
      expect(hold.returnedAt).toEqual(RETURNED_AT);
    });

    test("a queried return moves to UNDER_ASSESSMENT", () => {
      const hold = service.recordReturn("HOLD-0001", RETURNED_AT, false);

      expect(hold.status).toBe("UNDER_ASSESSMENT");
      expect(hold.returnedUndamaged).toBe(false);
    });

    test("rejects a return on an unknown hold", () => {
      expect(() => service.recordReturn("HOLD-NOPE", RETURNED_AT, true)).toThrow(
        /unknown deposit hold/i,
      );
    });
  });

  describe("deductions", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
    });

    test("accumulates itemised damage", () => {
      service.addDeduction("HOLD-0001", deduction({ amountMinor: 50_000 }));
      service.addDeduction(
        "HOLD-0001",
        deduction({ reason: "Missing lens cap", amountMinor: 5_000 }),
      );

      expect(service.getDeductions("HOLD-0001")).toHaveLength(2);
      expect(service.assessedDamageMinor("HOLD-0001")).toBe(55_000);
    });

    test("requires a stated reason", () => {
      expect(() => service.addDeduction("HOLD-0001", deduction({ reason: "x" }))).toThrow(
        /stated reason/i,
      );
    });

    test("requires an assessor", () => {
      expect(() => service.addDeduction("HOLD-0001", deduction({ assessedBy: "" }))).toThrow(
        /assessor's identity/i,
      );
    });

    test("rejects a fractional amount", () => {
      expect(() => service.addDeduction("HOLD-0001", deduction({ amountMinor: 12.5 }))).toThrow(
        /integer number of minor units/i,
      );
    });

    test("rejects a zero deduction", () => {
      expect(() => service.addDeduction("HOLD-0001", deduction({ amountMinor: 0 }))).toThrow(
        /is not a deduction/i,
      );
    });

    test("damage on a hold marked clean moves it into assessment", () => {
      service.openHold(holdRequest({ holdId: "HOLD-CLEAN" }));
      service.recordReturn("HOLD-CLEAN", RETURNED_AT, true);
      service.addDeduction("HOLD-CLEAN", deduction());

      const hold = service.getHold("HOLD-CLEAN");
      expect(hold?.status).toBe("UNDER_ASSESSMENT");
      // The two facts must not sit in the ledger contradicting each other.
      expect(hold?.returnedUndamaged).toBe(false);
    });

    test("returns copies, so a caller cannot rewrite an assessment", () => {
      service.addDeduction("HOLD-0001", deduction());
      const [item] = service.getDeductions("HOLD-0001");
      item.amountMinor = 1;

      expect(service.assessedDamageMinor("HOLD-0001")).toBe(50_000);
    });
  });

  describe("settlement arithmetic", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
    });

    test("a clean return releases the whole deposit", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(settlement.releasedMinor).toBe(DEPOSIT_MINOR);
      expect(settlement.forfeitedMinor).toBe(0);
      expect(settlement.unrecoveredShortfallMinor).toBe(0);
    });

    test("partial damage releases the remainder", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction({ amountMinor: 60_000 }));

      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(settlement.forfeitedMinor).toBe(60_000);
      expect(settlement.releasedMinor).toBe(140_000);
      expect(settlement.unrecoveredShortfallMinor).toBe(0);
    });

    test("released plus forfeited always equals held", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction({ amountMinor: 33_333 }));
      service.addDeduction("HOLD-0001", deduction({ reason: "Body scuffing", amountMinor: 7_777 }));

      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(settlement.releasedMinor + settlement.forfeitedMinor).toBe(settlement.heldMinor);
    });

    test("damage beyond the deposit caps the forfeit and reports a shortfall", () => {
      // A 3000.00 repair against a 2000.00 deposit.
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction(
        "HOLD-0001",
        deduction({ reason: "Sensor replacement", amountMinor: 300_000 }),
      );

      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(settlement.assessedDamageMinor).toBe(300_000);
      expect(settlement.forfeitedMinor).toBe(DEPOSIT_MINOR);
      expect(settlement.releasedMinor).toBe(0);
      expect(settlement.unrecoveredShortfallMinor).toBe(100_000);
      // The point of the cap: the release never goes negative.
      expect(settlement.releasedMinor).toBeGreaterThanOrEqual(0);
    });

    test("damage exactly equal to the deposit leaves no shortfall", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction({ amountMinor: DEPOSIT_MINOR }));

      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(settlement.forfeitedMinor).toBe(DEPOSIT_MINOR);
      expect(settlement.releasedMinor).toBe(0);
      expect(settlement.unrecoveredShortfallMinor).toBe(0);
    });

    test("every settled amount is a whole minor unit", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction({ amountMinor: 66_667 }));

      const settlement = service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(Number.isInteger(settlement.releasedMinor)).toBe(true);
      expect(Number.isInteger(settlement.forfeitedMinor)).toBe(true);
      expect(Number.isInteger(settlement.unrecoveredShortfallMinor)).toBe(true);
    });

    test("carries the deductions onto the statement record", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction());

      expect(service.settle("HOLD-0001", OFFICER, SETTLED_AT).deductions).toHaveLength(1);
    });

    test("requires a settling officer", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      expect(() => service.settle("HOLD-0001", "", SETTLED_AT)).toThrow(/officer's identity/i);
    });

    test("refuses to settle kit that never came back", () => {
      expect(() => service.settle("HOLD-0001", OFFICER, SETTLED_AT)).toThrow(
        /has not been returned/i,
      );
    });
  });

  describe("lifecycle transitions", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
    });

    test("a settled hold cannot be settled again", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(() => service.settle("HOLD-0001", OFFICER, SETTLED_AT)).toThrow(
        /cannot move from SETTLED to SETTLED|closed deposit stays closed/i,
      );
    });

    test("a settled hold cannot be forfeited", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(() => service.forfeit("HOLD-0001", "Never returned", OFFICER, SETTLED_AT)).toThrow(
        /closed deposit stays closed/i,
      );
    });

    test("a settled hold accepts no further deductions", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(() => service.addDeduction("HOLD-0001", deduction())).toThrow(
        /can no longer be assessed/i,
      );
    });

    test("a forfeited hold cannot then be settled", () => {
      service.forfeit("HOLD-0001", "Camera never returned", OFFICER, SETTLED_AT);

      expect(() => service.settle("HOLD-0001", OFFICER, SETTLED_AT)).toThrow(
        /closed deposit stays closed/i,
      );
    });
  });

  describe("forfeiture", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
    });

    test("forfeits the whole deposit and balances", () => {
      const settlement = service.forfeit(
        "HOLD-0001",
        "Camera body never returned after two reminders",
        OFFICER,
        SETTLED_AT,
      );

      expect(settlement.forfeitedMinor).toBe(DEPOSIT_MINOR);
      expect(settlement.releasedMinor).toBe(0);
      expect(settlement.releasedMinor + settlement.forfeitedMinor).toBe(DEPOSIT_MINOR);
      expect(service.getHold("HOLD-0001")?.status).toBe("FORFEITED");
    });

    test("records the stated reason as the deduction", () => {
      const settlement = service.forfeit("HOLD-0001", "Never returned", OFFICER, SETTLED_AT);
      expect(settlement.deductions[0].reason).toBe("Never returned");
    });

    test("requires a reason", () => {
      expect(() => service.forfeit("HOLD-0001", "no", OFFICER, SETTLED_AT)).toThrow(
        /stated reason/i,
      );
    });

    test("refuses to forfeit kit that was returned", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);

      expect(() => service.forfeit("HOLD-0001", "Never returned", OFFICER, SETTLED_AT)).toThrow(
        /Settle it instead of forfeiting it/i,
      );
    });

    test("stays distinct from a settlement that releases zero", () => {
      service.openHold(holdRequest({ holdId: "HOLD-WRECKED" }));
      service.recordReturn("HOLD-WRECKED", RETURNED_AT, false);
      service.addDeduction("HOLD-WRECKED", deduction({ amountMinor: DEPOSIT_MINOR }));
      service.settle("HOLD-WRECKED", OFFICER, SETTLED_AT);

      service.forfeit("HOLD-0001", "Never returned", OFFICER, SETTLED_AT);

      // Both release zero, but only one says the asset is still missing.
      expect(service.getHold("HOLD-WRECKED")?.status).toBe("SETTLED");
      expect(service.getHold("HOLD-0001")?.status).toBe("FORFEITED");
    });
  });

  describe("release obligation", () => {
    const returnedAt = new Date("2026-03-07T10:00:00.000Z");

    function evaluateAfterDays(days: number): Date {
      return new Date(returnedAt.getTime() + days * 86_400_000);
    }

    beforeEach(() => {
      service.openHold(holdRequest());
      service.recordReturn("HOLD-0001", returnedAt, true);
    });

    test("stays quiet inside the release window", () => {
      expect(
        service.findOverdueReleases(CLUB, evaluateAfterDays(RELEASE_WINDOW_DAYS - 1)),
      ).toHaveLength(0);
    });

    test("surfaces a forgotten deposit past the window", () => {
      const overdue = service.findOverdueReleases(
        CLUB,
        evaluateAfterDays(RELEASE_WINDOW_DAYS + 10),
      );

      expect(overdue).toHaveLength(1);
      expect(overdue[0].holdId).toBe("HOLD-0001");
      expect(overdue[0].daysOverdue).toBe(10);
      expect(overdue[0].heldMinor).toBe(DEPOSIT_MINOR);
    });

    test("does not chase a deposit that is genuinely under assessment", () => {
      service.openHold(holdRequest({ holdId: "HOLD-DAMAGED" }));
      service.recordReturn("HOLD-DAMAGED", returnedAt, false);

      const overdue = service.findOverdueReleases(CLUB, evaluateAfterDays(RELEASE_WINDOW_DAYS + 5));
      expect(overdue.map((entry) => entry.holdId)).not.toContain("HOLD-DAMAGED");
    });

    test("does not chase a deposit already settled", () => {
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      expect(
        service.findOverdueReleases(CLUB, evaluateAfterDays(RELEASE_WINDOW_DAYS + 30)),
      ).toHaveLength(0);
    });

    test("does not chase kit still out on loan", () => {
      service.openHold(holdRequest({ holdId: "HOLD-OUT" }));

      const overdue = service.findOverdueReleases(CLUB, evaluateAfterDays(RELEASE_WINDOW_DAYS + 5));
      expect(overdue.map((entry) => entry.holdId)).not.toContain("HOLD-OUT");
    });

    test("orders the longest-forgotten first", () => {
      service.openHold(holdRequest({ holdId: "HOLD-RECENT" }));
      service.recordReturn("HOLD-RECENT", new Date(returnedAt.getTime() + 5 * 86_400_000), true);

      const overdue = service.findOverdueReleases(
        CLUB,
        evaluateAfterDays(RELEASE_WINDOW_DAYS + 20),
      );
      expect(overdue[0].holdId).toBe("HOLD-0001");
    });

    test("does not reach across clubs", () => {
      service.openHold(holdRequest({ holdId: "HOLD-OTHER", clubId: "club-drama" }));
      service.recordReturn("HOLD-OTHER", returnedAt, true);

      const overdue = service.findOverdueReleases(CLUB, evaluateAfterDays(RELEASE_WINDOW_DAYS + 5));
      expect(overdue.map((entry) => entry.holdId)).not.toContain("HOLD-OTHER");
    });
  });

  describe("outstanding balance", () => {
    test("sums open and under-assessment holds only", () => {
      service.openHold(holdRequest({ holdId: "HOLD-A", heldMinor: 100_000 }));
      service.openHold(holdRequest({ holdId: "HOLD-B", heldMinor: 50_000 }));
      service.recordReturn("HOLD-B", RETURNED_AT, false);

      service.openHold(holdRequest({ holdId: "HOLD-C", heldMinor: 70_000 }));
      service.recordReturn("HOLD-C", RETURNED_AT, true);
      service.settle("HOLD-C", OFFICER, SETTLED_AT);

      expect(service.outstandingHeldMinor(CLUB)).toBe(150_000);
    });

    test("is zero for a club with nothing out", () => {
      expect(service.outstandingHeldMinor("club-nothing")).toBe(0);
    });
  });

  describe("the borrower's statement", () => {
    beforeEach(() => {
      service.openHold(holdRequest());
    });

    test("shows a clean return plainly", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, true);
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      const statement = service.buildStatement("HOLD-0001").join("\n");

      expect(statement).toContain("Deposit held: INR 2000.00");
      expect(statement).toContain("No damage was assessed.");
      expect(statement).toContain("Returned to you: INR 2000.00");
    });

    test("itemises every deduction with its reason", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction(
        "HOLD-0001",
        deduction({ reason: "Cracked filter", amountMinor: 50_000 }),
      );
      service.addDeduction("HOLD-0001", deduction({ reason: "Missing cap", amountMinor: 5_000 }));
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      const statement = service.buildStatement("HOLD-0001").join("\n");

      expect(statement).toContain("- Cracked filter: INR 500.00");
      expect(statement).toContain("- Missing cap: INR 50.00");
      expect(statement).toContain("Total assessed damage: INR 550.00");
      expect(statement).toContain("Returned to you: INR 1450.00");
    });

    test("spells out a shortfall rather than hiding it", () => {
      service.recordReturn("HOLD-0001", RETURNED_AT, false);
      service.addDeduction("HOLD-0001", deduction({ reason: "Sensor", amountMinor: 300_000 }));
      service.settle("HOLD-0001", OFFICER, SETTLED_AT);

      const statement = service.buildStatement("HOLD-0001").join("\n");

      expect(statement).toContain("Assessed damage exceeded the deposit");
      expect(statement).toContain("INR 1000.00 remains unrecovered");
      expect(statement).toContain("Returned to you: INR 0.00");
    });

    test("refuses to produce a statement for an unsettled hold", () => {
      expect(() => service.buildStatement("HOLD-0001")).toThrow(/has not been settled/i);
    });
  });
});
