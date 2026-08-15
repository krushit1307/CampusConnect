import { describe, it, expect } from "vitest";
import {
  calculateRollingPenaltyPoints,
  isClubSuspensionThresholdReached,
  formatInfractionSeverityLabel,
  CLUB_SUSPENSION_POINT_THRESHOLD,
  type ClubInfraction,
} from "./clubPenaltySystem";

describe("Club Strike/Penalty System Tracker (#3017)", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  describe("Rolling 365-Day Penalty Point Calculation", () => {
    it("sums active penalty points created within 365 days", () => {
      const infractions: ClubInfraction[] = [
        {
          id: "inf_1",
          club_id: "club_1",
          severity: "moderate",
          description: "Noise complaint level 2",
          points_penalized: 4,
          status: "active",
          created_at: "2026-06-01T12:00:00Z", // ~74 days old -> active
        },
        {
          id: "inf_2",
          club_id: "club_1",
          severity: "minor",
          description: "Trash left in room",
          points_penalized: 2,
          status: "active",
          created_at: "2026-01-15T12:00:00Z", // ~211 days old -> active
        },
      ];

      const points = calculateRollingPenaltyPoints(infractions, now);
      expect(points).toBe(6);
    });

    it("ignores infractions older than 365 days (rolling window expiration)", () => {
      const infractions: ClubInfraction[] = [
        {
          id: "inf_1",
          club_id: "club_1",
          severity: "critical",
          description: "Property damage",
          points_penalized: 10,
          status: "active",
          created_at: "2025-08-01T12:00:00Z", // > 365 days old -> expired!
        },
        {
          id: "inf_2",
          club_id: "club_1",
          severity: "minor",
          description: "Late checkout",
          points_penalized: 3,
          status: "active",
          created_at: "2026-07-01T12:00:00Z", // Active
        },
      ];

      const points = calculateRollingPenaltyPoints(infractions, now);
      expect(points).toBe(3);
    });

    it("ignores appealed and revoked infractions", () => {
      const infractions: ClubInfraction[] = [
        {
          id: "inf_1",
          club_id: "club_1",
          severity: "severe",
          description: "Unapproved alcohol",
          points_penalized: 5,
          status: "appealed", // Appealed -> does not count toward active total
          created_at: "2026-08-01T12:00:00Z",
        },
        {
          id: "inf_2",
          club_id: "club_1",
          severity: "minor",
          description: "Poster violation",
          points_penalized: 2,
          status: "revoked", // Revoked -> does not count
          created_at: "2026-08-01T12:00:00Z",
        },
      ];

      const points = calculateRollingPenaltyPoints(infractions, now);
      expect(points).toBe(0);
    });
  });

  describe("Automatic Suspension Threshold Evaluation", () => {
    it("triggers suspension when rolling penalty points reach or exceed 10", () => {
      expect(isClubSuspensionThresholdReached(10)).toBe(true);
      expect(isClubSuspensionThresholdReached(14)).toBe(true);
    });

    it("does not trigger suspension for points under 10", () => {
      expect(isClubSuspensionThresholdReached(9)).toBe(false);
      expect(isClubSuspensionThresholdReached(0)).toBe(false);
    });

    it("enforces 10-point suspension threshold constant", () => {
      expect(CLUB_SUSPENSION_POINT_THRESHOLD).toBe(10);
    });
  });

  describe("Severity Badge Formatting", () => {
    it("formats severity labels and color styling", () => {
      const critical = formatInfractionSeverityLabel("critical");
      expect(critical.label).toBe("Critical Severity");
      expect(critical.colorClass).toContain("red");

      const minor = formatInfractionSeverityLabel("minor");
      expect(minor.label).toBe("Minor Infraction");
      expect(minor.colorClass).toContain("blue");
    });
  });
});
