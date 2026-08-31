import { describe, it, expect } from "vitest";
import {
  calculateOverbookingCapacity,
  evaluateNoShowStandbyPromotion,
} from "./resourceOverbookingMargin";

describe("Resource Constraint Overbooking Margin Algorithm Utility (#4984)", () => {
  it("calculates overbooking capacity limit based on historical no-show rates", () => {
    const yieldConfig = calculateOverbookingCapacity(10, 15.0);
    expect(yieldConfig.maxAllowedBookings).toBe(11);
    expect(yieldConfig.overbookingMarginPercent).toBe(110);
  });

  it("keeps primary reservation active when RFID scan occurs within 15 minutes", () => {
    const result = evaluateNoShowStandbyPromotion(
      "queue-101",
      "Robotics Club",
      "AI Society",
      true, // Scanned RFID
      5 // 5 mins elapsed
    );

    expect(result.noShowConfirmed).toBe(false);
    expect(result.promotedToActive).toBe(false);
  });

  it("cancels primary reservation and promotes standby club when 15-minute window is missed", () => {
    const result = evaluateNoShowStandbyPromotion(
      "queue-101",
      "Robotics Club",
      "AI Society",
      false, // No RFID scan
      15 // 15 mins elapsed
    );

    expect(result.noShowConfirmed).toBe(true);
    expect(result.promotedToActive).toBe(true);
    expect(result.notificationMessage).toContain("The 4K Projector is yours! Robotics Club missed their 15-minute pickup window.");
  });
});
