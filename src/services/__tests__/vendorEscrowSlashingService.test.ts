import { describe, it, expect, beforeEach } from "vitest";
import { VendorEscrowSlashingService } from "../vendorEscrowSlashingService";

describe("VendorEscrowSlashingService", () => {
  let service: VendorEscrowSlashingService;

  beforeEach(() => {
    service = new VendorEscrowSlashingService();
    service.clear();
  });

  describe("calculateDelaySlashing", () => {
    it("should return 0% slash for grace period (<= 15 minutes)", () => {
      const calc = service.calculateDelaySlashing(1000, 10, "LATE_ARRIVAL");
      expect(calc.slashPercentage).toBe(0);
      expect(calc.slashAmount).toBe(0);
      expect(calc.netVendorPayout).toBe(1000);
      expect(calc.isGracePeriod).toBe(true);
    });

    it("should slash 10% for minor delay (15-30 minutes)", () => {
      const calc = service.calculateDelaySlashing(1000, 20, "LATE_ARRIVAL");
      expect(calc.slashPercentage).toBe(10);
      expect(calc.slashAmount).toBe(100);
      expect(calc.netVendorPayout).toBe(900);
      expect(calc.severity).toBe("MINOR");
    });

    it("should slash 25% for moderate delay (30-60 minutes)", () => {
      const calc = service.calculateDelaySlashing(2000, 45, "DELAYED_SETUP");
      expect(calc.slashPercentage).toBe(25);
      expect(calc.slashAmount).toBe(500);
      expect(calc.netVendorPayout).toBe(1500);
      expect(calc.severity).toBe("MODERATE");
    });

    it("should slash 50% for severe delay (60-120 minutes)", () => {
      const calc = service.calculateDelaySlashing(2000, 90, "LATE_ARRIVAL");
      expect(calc.slashPercentage).toBe(50);
      expect(calc.slashAmount).toBe(1000);
      expect(calc.netVendorPayout).toBe(1000);
      expect(calc.severity).toBe("SEVERE");
    });

    it("should slash 100% for critical breach (> 120 minutes)", () => {
      const calc = service.calculateDelaySlashing(2000, 150, "LATE_ARRIVAL");
      expect(calc.slashPercentage).toBe(100);
      expect(calc.slashAmount).toBe(2000);
      expect(calc.netVendorPayout).toBe(0);
      expect(calc.severity).toBe("CRITICAL");
    });

    it("should add +10% penalty for MISSING_EQUIPMENT breach type", () => {
      const calc = service.calculateDelaySlashing(1000, 20, "MISSING_EQUIPMENT");
      expect(calc.slashPercentage).toBe(20); // 10% base + 10% equipment
      expect(calc.slashAmount).toBe(200);
    });
  });

  describe("executeEscrowSlashing", () => {
    it("should execute slashing transaction and update contract state", async () => {
      const contract = service.getOrCreateContract("c-101", {
        totalEscrowAmount: 1500,
        vendorName: "Pro Sound Co",
      });

      const res = await service.executeEscrowSlashing(
        "c-101",
        40,
        "DELAYED_SETUP",
        "Setup delayed by 40 minutes",
      );

      expect(res.success).toBe(true);
      expect(res.contract.status).toBe("PARTIALLY_SLASHED");
      expect(res.contract.slashedAmount).toBe(375); // 25% of 1500
      expect(res.contract.netVendorPayout).toBe(1125);
      expect(res.breachRecord.delayMinutes).toBe(40);
    });

    it("should throw error if escrow has already been released", async () => {
      const contract = service.getOrCreateContract("c-102");
      contract.status = "RELEASED_TO_VENDOR";

      await expect(
        service.executeEscrowSlashing("c-102", 30, "LATE_ARRIVAL", "Late arrival"),
      ).rejects.toThrow("Cannot slash contract: Escrow funds have already been released to vendor.");
    });
  });

  describe("getBreachHistory", () => {
    it("should track and retrieve breach audit logs", async () => {
      service.getOrCreateContract("c-103");
      await service.executeEscrowSlashing("c-103", 25, "LATE_ARRIVAL", "Initial delay");

      const history = service.getBreachHistory("c-103");
      expect(history.length).toBe(1);
      expect(history[0].delayMinutes).toBe(25);
    });
  });
});
