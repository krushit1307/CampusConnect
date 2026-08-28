import { describe, it, expect } from "vitest";
import {
  calculateGasCostSplit,
  processCarpoolGasSplit,
  formatCurrency,
  CarpoolGasSplitRequest,
} from "./carpoolGasSplitter";

describe("Carpool Gas Cost Splitter Engine Utility (#4478)", () => {
  const sampleRequest: CarpoolGasSplitRequest = {
    tripId: "trip-hackathon-1",
    driverId: "u-driver-1",
    driverName: "Alex Rivera",
    totalGasCost: 15.0,
    riders: [
      { riderId: "u-r1", fullName: "Alice Vance", handle: "alice_v" },
      { riderId: "u-r2", fullName: "Bob Chen", handle: "bob_c" },
      { riderId: "u-r3", fullName: "Elena Rostova", handle: "elena_r" },
    ],
  };

  it("calculates exact per-rider gas cost split amount", () => {
    const split = calculateGasCostSplit(15.0, 3);
    expect(split.splitAmountPerRider).toBe(5.0);
    expect(split.totalCredit).toBe(15.0);
  });

  it("processes carpool gas split and generates Stripe Connect Express transfer payload", () => {
    const result = processCarpoolGasSplit(sampleRequest);

    expect(result.status).toBe("settled");
    expect(result.totalGasCost).toBe(15.0);
    expect(result.riderCount).toBe(3);
    expect(result.splitAmountPerRider).toBe(5.0);
    expect(result.stripeTransferId).toContain("tr_express_");
    expect(result.riderCharges).toHaveLength(3);
    expect(result.riderCharges[0].amount).toBe(5.0);
  });

  it("formats currency values correctly", () => {
    expect(formatCurrency(15.0)).toBe("$15.00");
    expect(formatCurrency(5.0)).toBe("$5.00");
  });
});
