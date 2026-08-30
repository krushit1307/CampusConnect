import { describe, it, expect } from "vitest";
import {
  INITIAL_AUTONOMOUS_FLEET,
  calculatePlatoonEfficiency,
  evaluateSurgePlatoonDemand,
  createAutonomousPlatoon,
  disbandPlatoon,
  type AutonomousShuttleAsset,
} from "../autonomousShuttlePlatoonService";

describe("Autonomous Shuttle Platoon Service & Convoy Optimizer", () => {
  describe("calculatePlatoonEfficiency", () => {
    it("returns 0% energy savings for single vehicle", () => {
      const eff = calculatePlatoonEfficiency(1);
      expect(eff.energySavingsPct).toBe(0);
      expect(eff.throughputMultiplier).toBe(1.0);
    });

    it("calculates aerodynamic drafting savings for multi-vehicle platoons", () => {
      const eff2 = calculatePlatoonEfficiency(2);
      expect(eff2.energySavingsPct).toBeGreaterThan(10);
      expect(eff2.throughputMultiplier).toBeGreaterThan(1.5);

      const eff4 = calculatePlatoonEfficiency(4);
      expect(eff4.energySavingsPct).toBeGreaterThan(eff2.energySavingsPct);
      expect(eff4.throughputMultiplier).toBeGreaterThan(3.0);
    });
  });

  describe("evaluateSurgePlatoonDemand", () => {
    it("evaluates passenger surge demand and selects eligible vehicles with >20% battery", () => {
      const result = evaluateSurgePlatoonDemand(38, INITIAL_AUTONOMOUS_FLEET);

      expect(result.requiredVehiclesCount).toBeGreaterThanOrEqual(2);
      expect(result.eligibleVehicles.every((v) => v.batteryPct >= 20)).toBe(true);
      expect(result.canFormPlatoon).toBe(true);
      expect(result.recommendedPlatoonSize).toBeGreaterThanOrEqual(2);
    });

    it("excludes vehicles with low battery (<20%) from platoons", () => {
      const customFleet: AutonomousShuttleAsset[] = [
        {
          id: "av-1",
          name: "AV-1",
          capacity: 14,
          batteryPct: 15, // low battery
          status: "available",
          lat: 0,
          lng: 0,
          speedMps: 10,
          isLeadEligible: true,
        },
      ];

      const result = evaluateSurgePlatoonDemand(20, customFleet);
      expect(result.eligibleVehicles.length).toBe(0);
      expect(result.canFormPlatoon).toBe(false);
    });
  });

  describe("createAutonomousPlatoon", () => {
    it("creates an autonomous platoon with lead and follower vehicles", () => {
      const platoon = createAutonomousPlatoon(
        35,
        "route-express",
        "Express Loop",
        "Station A",
        "Station B",
        INITIAL_AUTONOMOUS_FLEET
      );

      expect(platoon.id).toBeDefined();
      expect(platoon.totalVehicles).toBeGreaterThanOrEqual(2);
      expect(platoon.leadVehicle).toBeDefined();
      expect(platoon.followerVehicles.length).toBe(platoon.totalVehicles - 1);
      expect(platoon.energySavingsPct).toBeGreaterThan(0);
      expect(platoon.headwayMeters).toBe(6);
      expect(platoon.status).toBe("en_route");
    });
  });

  describe("disbandPlatoon", () => {
    it("disbands an active platoon and returns vehicles to available status", () => {
      const platoon = createAutonomousPlatoon(30, "route-1", "Loop", "A", "B", INITIAL_AUTONOMOUS_FLEET);
      const updatedFleet = disbandPlatoon(platoon, INITIAL_AUTONOMOUS_FLEET);

      const leadInFleet = updatedFleet.find((v) => v.id === platoon.leadVehicle.id);
      expect(leadInFleet?.status).toBe("available");
    });
  });
});
