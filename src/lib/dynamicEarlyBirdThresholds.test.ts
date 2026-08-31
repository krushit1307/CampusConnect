import { describe, it, expect } from "vitest";
import {
  calculateDynamicTierCapacity,
  recalculateEventTierCapacities,
  evaluateEarlyBirdThreshold,
  validateTierCapacityConfig,
  DynamicTierConfig,
} from "./dynamicEarlyBirdThresholds";

describe("Dynamic 'Early Bird' Variable Thresholds Suite (#4530)", () => {
  it("calculates absolute capacity accurately from venue capacity and percentage", () => {
    // 500 room * 20% = 100 Early Bird tickets
    expect(calculateDynamicTierCapacity(500, 20)).toBe(100);

    // 1000 room * 20% = 200 Early Bird tickets
    expect(calculateDynamicTierCapacity(1000, 20)).toBe(200);

    // 100 room * 15% = 15 tickets
    expect(calculateDynamicTierCapacity(100, 15)).toBe(15);

    // Rounding cases: 75 room * 20% = 15 tickets
    expect(calculateDynamicTierCapacity(75, 20)).toBe(15);

    // Very small capacity returns at least 1
    expect(calculateDynamicTierCapacity(10, 5)).toBe(1);
  });

  it("dynamically recalculates tiers when venue capacity changes", () => {
    const initialTiers: DynamicTierConfig[] = [
      {
        id: "tier-1",
        name: "Early Bird",
        price: 15,
        capacity_percentage: 20,
      },
      {
        id: "tier-2",
        name: "General Admission",
        price: 25,
        capacity_percentage: 60,
      },
      {
        id: "tier-3",
        name: "VIP Fixed",
        price: 50,
        capacity: 10, // Fixed capacity, no percentage
      },
    ];

    // Recalculate for 500-person venue
    const room500 = recalculateEventTierCapacities(500, initialTiers);
    expect(room500[0].capacity).toBe(100);
    expect(room500[0].is_dynamic_capacity).toBe(true);
    expect(room500[1].capacity).toBe(300);
    expect(room500[1].is_dynamic_capacity).toBe(true);
    expect(room500[2].capacity).toBe(10); // Unchanged

    // Move to 1000-person venue
    const room1000 = recalculateEventTierCapacities(1000, room500);
    expect(room1000[0].capacity).toBe(200);
    expect(room1000[1].capacity).toBe(600);
    expect(room1000[2].capacity).toBe(10);
  });

  it("evaluates Early Bird threshold and generates dynamic FOMO badge message", () => {
    const earlyBirdTier: DynamicTierConfig = {
      id: "eb-1",
      name: "Early Bird",
      price: 10,
      capacity_percentage: 20,
      sold_count: 95,
    };

    // With 500 capacity -> 100 total, 95 sold -> 5 remaining
    const status = evaluateEarlyBirdThreshold(earlyBirdTier, 500);
    expect(status.totalCapacity).toBe(100);
    expect(status.remainingTickets).toBe(5);
    expect(status.isPercentageBased).toBe(true);
    expect(status.isFomoUrgent).toBe(true);
    expect(status.fomoBadgeMessage).toBe("Only 5 Early Bird tickets left! (20% venue allocation)");

    // If venue expanded to 1000 -> 200 total, 95 sold -> 105 remaining
    const expandedStatus = evaluateEarlyBirdThreshold(earlyBirdTier, 1000);
    expect(expandedStatus.totalCapacity).toBe(200);
    expect(expandedStatus.remainingTickets).toBe(105);
    expect(expandedStatus.isFomoUrgent).toBe(false);
    expect(expandedStatus.fomoBadgeMessage).toBe(
      "Only 105 Early Bird tickets left! (20% venue allocation)",
    );
  });

  it("identifies sold out state when all dynamic tickets are sold", () => {
    const tier: DynamicTierConfig = {
      name: "Super Early Bird",
      price: 5,
      capacity_percentage: 10,
      sold_count: 50,
    };

    const status = evaluateEarlyBirdThreshold(tier, 500);
    expect(status.totalCapacity).toBe(50);
    expect(status.remainingTickets).toBe(0);
    expect(status.isSoldOut).toBe(true);
    expect(status.fomoBadgeMessage).toBe("Super Early Bird Sold Out!");
  });

  it("validates tier capacity configurations accurately", () => {
    expect(validateTierCapacityConfig({ capacity_percentage: 20 }).isValid).toBe(true);
    expect(validateTierCapacityConfig({ capacity_percentage: 100 }).isValid).toBe(true);
    expect(validateTierCapacityConfig({ capacity_percentage: 105 }).isValid).toBe(false);
    expect(validateTierCapacityConfig({ capacity_percentage: -5 }).isValid).toBe(false);

    expect(validateTierCapacityConfig({ capacity: 50 }).isValid).toBe(true);
    expect(validateTierCapacityConfig({ capacity: 0 }).isValid).toBe(false);
    expect(validateTierCapacityConfig({ capacity: -10 }).isValid).toBe(false);
  });
});
