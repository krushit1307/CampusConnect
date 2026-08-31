// =============================================================================
// Unit Tests: Hardware Self-Insurance Micro-Premiums
// Issue: #5289 - Dynamic "Hardware Resource" Drone Liability Insurance Micro-Premiums
// Description: Asserts risk-tier pricing (including the $15 drone case from the
// issue), duration surcharges, premium floors and ceilings, pool balance derivation
// from the ledger, and destruction settlements against an under-funded pool.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  BASE_RATE_PER_DOLLAR,
  MAX_PREMIUM_USD,
  MIN_PREMIUM_USD,
  RISK_PROFILES,
  UNTIERED_PROFILE,
  bookingsToFundReplacement,
  buildPayoutEntry,
  buildPremiumEntry,
  computeDurationFactor,
  computePoolState,
  listRiskProfiles,
  quotePremium,
  resolveRiskProfile,
  settleDestruction,
} from "../hardwareInsurancePremium";
import { InsurableAsset, PoolLedgerEntry } from "../../types/hardwareInsurance";

const DRONE: InsurableAsset = {
  id: "asset-dji-mavic",
  name: "DJI Mavic 3 Enterprise",
  category: "drone",
  valuationUsd: 2000,
};

const PROJECTOR: InsurableAsset = {
  id: "asset-epson-projector",
  name: "Epson PowerLite Projector",
  category: "projector",
  valuationUsd: 600,
};

const premiumEntry = (id: string, amountUsd: number): PoolLedgerEntry => ({
  id,
  type: "PREMIUM",
  amountUsd,
  assetId: DRONE.id,
  counterparty: "club-robotics",
  bookingId: `booking-${id}`,
  occurredAt: "2026-09-01T10:00:00Z",
});

describe("hardwareInsurancePremium (#5289)", () => {
  describe("risk tiers", () => {
    it("prices drones as the highest-risk category in the library", () => {
      const multipliers = listRiskProfiles().map((profile) => profile.riskMultiplier);

      expect(listRiskProfiles()[0].category).toBe("drone");
      expect(RISK_PROFILES.drone.tier).toBe("HIGH");
      expect(multipliers).toEqual([...multipliers].sort((a, b) => b - a));
    });

    it("prices projectors below drones", () => {
      expect(RISK_PROFILES.projector.riskMultiplier).toBeLessThan(
        RISK_PROFILES.drone.riskMultiplier,
      );
      expect(RISK_PROFILES.projector.tier).toBe("LOW");
    });

    it("falls back to the moderate default for an untiered category", () => {
      expect(resolveRiskProfile("submarine")).toBe(UNTIERED_PROFILE);
      expect(UNTIERED_PROFILE.riskMultiplier).toBeGreaterThan(
        RISK_PROFILES.microcontroller.riskMultiplier,
      );
    });
  });

  describe("premium pricing", () => {
    it("charges $15 for a $2,000 drone booked for a day (the case in #5289)", () => {
      const quote = quotePremium(DRONE, 24);

      expect(quote.premiumUsd).toBe(15);
      expect(quote.clamped).toBe(false);
      expect(quote.refundable).toBe(false);
      expect(quote.tier).toBe("HIGH");
    });

    it("derives the price from valuation, multiplier and base rate", () => {
      const quote = quotePremium(DRONE, 24);

      expect(quote.rawPremiumUsd).toBeCloseTo(
        DRONE.valuationUsd * BASE_RATE_PER_DOLLAR * RISK_PROFILES.drone.riskMultiplier,
        2,
      );
    });

    it("charges a projector far less than a drone for the same booking", () => {
      expect(quotePremium(PROJECTOR, 24).premiumUsd).toBeLessThan(
        quotePremium(DRONE, 24).premiumUsd,
      );
    });

    it("never charges below the floor, even for a cheap asset", () => {
      const quote = quotePremium(
        { id: "a-1", name: "Arduino Uno", category: "microcontroller", valuationUsd: 25 },
        24,
      );

      expect(quote.premiumUsd).toBe(MIN_PREMIUM_USD);
      expect(quote.clamped).toBe(true);
    });

    it("caps the premium so it stays a micro-payment on very high value assets", () => {
      const quote = quotePremium(
        { id: "a-2", name: "Survey LiDAR Drone", category: "drone", valuationUsd: 40000 },
        24,
      );

      expect(quote.premiumUsd).toBe(MAX_PREMIUM_USD);
      expect(quote.clamped).toBe(true);
    });

    it("explains the price in terms the club can check", () => {
      expect(quotePremium(DRONE, 24).explanation).toContain("non-refundable");
      expect(quotePremium(DRONE, 24).explanation).toContain("×3");
    });
  });

  describe("duration surcharge", () => {
    it("treats anything up to a day as a single-day booking", () => {
      expect(computeDurationFactor(1)).toBe(1);
      expect(computeDurationFactor(24)).toBe(1);
      expect(computeDurationFactor(0)).toBe(1);
    });

    it("adds a quarter of the day rate per extra day", () => {
      expect(computeDurationFactor(48)).toBe(1.25);
      expect(computeDurationFactor(72)).toBe(1.5);
    });

    it("caps the surcharge so a long loan cannot become a deposit", () => {
      expect(computeDurationFactor(24 * 30)).toBe(2);
      expect(quotePremium(DRONE, 24 * 30).premiumUsd).toBe(30);
    });
  });

  describe("pool ledger", () => {
    it("derives the balance from premiums and payouts rather than a stored total", () => {
      const state = computePoolState([
        premiumEntry("e1", 15),
        premiumEntry("e2", 15),
        premiumEntry("e3", 0.75),
      ]);

      expect(state.balanceUsd).toBe(30.75);
      expect(state.premiumsCollectedUsd).toBe(30.75);
      expect(state.premiumCount).toBe(3);
      expect(state.payoutCount).toBe(0);
    });

    it("subtracts payouts and counts subsidies as inflows", () => {
      const state = computePoolState([
        premiumEntry("e1", 15),
        {
          id: "e2",
          type: "SUBSIDY",
          amountUsd: 5000,
          assetId: DRONE.id,
          counterparty: "university-risk-office",
          occurredAt: "2026-09-02T10:00:00Z",
        },
        {
          id: "e3",
          type: "REPLACEMENT_PAYOUT",
          amountUsd: -2000,
          assetId: DRONE.id,
          counterparty: "purchasing",
          claimId: "claim-1",
          occurredAt: "2026-09-03T10:00:00Z",
        },
      ]);

      expect(state.balanceUsd).toBe(3015);
      expect(state.payoutsIssuedUsd).toBe(2000);
      expect(state.subsidiesReceivedUsd).toBe(5000);
      expect(state.payoutCount).toBe(1);
    });

    it("treats an empty ledger as an empty pool", () => {
      expect(computePoolState([]).balanceUsd).toBe(0);
    });

    it("records a premium against the club and booking that generated it", () => {
      const entry = buildPremiumEntry({
        id: "ledger-1",
        quote: quotePremium(DRONE, 24),
        clubId: "club-robotics",
        bookingId: "booking-88",
        stripeTransferId: "tr_test_123",
        occurredAt: "2026-09-01T10:00:00Z",
      });

      expect(entry).toMatchObject({
        type: "PREMIUM",
        amountUsd: 15,
        counterparty: "club-robotics",
        bookingId: "booking-88",
        stripeTransferId: "tr_test_123",
      });
    });

    it("stores a payout as a negative movement so the balance is a plain sum", () => {
      const ledger = Array.from({ length: 200 }, (_, index) => premiumEntry(`e${index}`, 15));
      const settlement = settleDestruction({
        asset: DRONE,
        ledger,
        payeeDepartment: "purchasing",
      });

      const entry = buildPayoutEntry({
        id: "ledger-payout-1",
        settlement,
        claimId: "claim-1",
        occurredAt: "2026-09-03T10:00:00Z",
      });

      expect(entry.amountUsd).toBe(-2000);
      expect(computePoolState([...ledger, entry]).balanceUsd).toBe(1000);
    });
  });

  describe("destruction settlement", () => {
    const fundedLedger = Array.from({ length: 200 }, (_, index) => premiumEntry(`e${index}`, 15));

    it("routes the full replacement cost when the pool covers it", () => {
      const settlement = settleDestruction({
        asset: DRONE,
        ledger: fundedLedger,
        payeeDepartment: "purchasing",
      });

      expect(settlement.decision).toBe("FULLY_FUNDED");
      expect(settlement.payoutUsd).toBe(2000);
      expect(settlement.shortfallUsd).toBe(0);
      expect(settlement.poolBalanceBeforeUsd).toBe(3000);
      expect(settlement.poolBalanceAfterUsd).toBe(1000);
      expect(settlement.reason).toContain("routed to purchasing");
    });

    it("pays what the pool holds and reports the shortfall instead of overdrawing", () => {
      const settlement = settleDestruction({
        asset: DRONE,
        ledger: [premiumEntry("e1", 15), premiumEntry("e2", 15)],
        payeeDepartment: "purchasing",
      });

      expect(settlement.decision).toBe("PARTIALLY_FUNDED");
      expect(settlement.payoutUsd).toBe(30);
      expect(settlement.shortfallUsd).toBe(1970);
      expect(settlement.poolBalanceAfterUsd).toBe(0);
      expect(settlement.reason).toContain("another budget");
    });

    it("declines when the pool is empty", () => {
      const settlement = settleDestruction({
        asset: DRONE,
        ledger: [],
        payeeDepartment: "purchasing",
      });

      expect(settlement.decision).toBe("DECLINED_INSOLVENT");
      expect(settlement.payoutUsd).toBe(0);
      expect(settlement.shortfallUsd).toBe(2000);
    });

    it("honours a claim below full replacement cost", () => {
      const settlement = settleDestruction({
        asset: DRONE,
        ledger: fundedLedger,
        payeeDepartment: "purchasing",
        claimedUsd: 450,
      });

      expect(settlement.decision).toBe("FULLY_FUNDED");
      expect(settlement.payoutUsd).toBe(450);
      expect(settlement.poolBalanceAfterUsd).toBe(2550);
    });

    it("cannot be pushed negative by a claim on an already drained pool", () => {
      const drained = [
        premiumEntry("e1", 15),
        {
          id: "e2",
          type: "REPLACEMENT_PAYOUT" as const,
          amountUsd: -15,
          assetId: DRONE.id,
          counterparty: "purchasing",
          occurredAt: "2026-09-02T10:00:00Z",
        },
      ];

      const settlement = settleDestruction({
        asset: DRONE,
        ledger: drained,
        payeeDepartment: "purchasing",
      });

      expect(settlement.payoutUsd).toBe(0);
      expect(settlement.poolBalanceAfterUsd).toBe(0);
    });
  });

  describe("pool solvency arithmetic", () => {
    it("reports how many bookings fund one replacement", () => {
      expect(bookingsToFundReplacement(DRONE)).toBe(134);
      expect(bookingsToFundReplacement(PROJECTOR)).toBe(600);
    });
  });
});
