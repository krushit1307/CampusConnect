import { describe, it, expect } from "vitest";
import {
  calculateDriverReputation,
  evaluateDriverBlockingStatus,
  formatDriverRatingBadge,
  validateDriverRatingSubmission,
  MIN_TRIPS_FOR_BLOCK,
  BLOCKING_RATING_THRESHOLD,
} from "./carpoolDriverRating";

describe("Dynamic 'Carpool' Driver Rating System Suite (#4536)", () => {
  it("calculates average driver rating correctly for positive rides", () => {
    const ratings = [{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 5 }];
    const rep = calculateDriverReputation("driver-1", ratings);

    expect(rep.totalRatings).toBe(4);
    expect(rep.averageRating).toBe(4.75);
    expect(rep.isBlocked).toBe(false);
  });

  it("does not block driver if ratings fall below 3.0 before reaching minimum 3 trips", () => {
    // 2 trips with 1 star = avg 1.0, but only 2 trips (< 3 minimum)
    const earlyRatings = [{ rating: 1 }, { rating: 1 }];
    const rep = calculateDriverReputation("driver-2", earlyRatings);

    expect(rep.totalRatings).toBe(2);
    expect(rep.averageRating).toBe(1.0);
    expect(rep.isBlocked).toBe(false); // Grace period: not blocked yet (< 3 trips)
  });

  it("automatically triggers automated safety block when avg rating < 3.0 with >= 3 trips", () => {
    // 3 trips with ratings [1, 2, 2] -> avg 1.67
    const badRatings = [{ rating: 1 }, { rating: 2 }, { rating: 2 }];
    const rep = calculateDriverReputation("driver-reckless", badRatings);

    expect(rep.totalRatings).toBe(3);
    expect(rep.averageRating).toBe(1.67);
    expect(rep.isBlocked).toBe(true);
    expect(rep.blockedReason).toContain("Automated safety block");
  });

  it("does not block driver if avg rating is exactly 3.0 or above with >= 3 trips", () => {
    const borderlineRatings = [{ rating: 3 }, { rating: 3 }, { rating: 3 }];
    const rep = calculateDriverReputation("driver-borderline", borderlineRatings);

    expect(rep.totalRatings).toBe(3);
    expect(rep.averageRating).toBe(3.0);
    expect(rep.isBlocked).toBe(false);
  });

  it("evaluates driver blocking status helper directly", () => {
    expect(evaluateDriverBlockingStatus({ averageRating: 2.8, totalRatings: 4 }).isBlocked).toBe(
      true,
    );

    expect(evaluateDriverBlockingStatus({ averageRating: 2.8, totalRatings: 2 }).isBlocked).toBe(
      false,
    );

    expect(evaluateDriverBlockingStatus({ averageRating: 4.8, totalRatings: 10 }).isBlocked).toBe(
      false,
    );

    expect(evaluateDriverBlockingStatus({ averageRating: null, totalRatings: 0 }).isBlocked).toBe(
      false,
    );
  });

  it("formats driver rating badges for different tiers and states", () => {
    // New driver
    const newBadge = formatDriverRatingBadge(null, 0);
    expect(newBadge.displayText).toBe("⭐ New Driver");
    expect(newBadge.badgeVariant).toBe("neutral");

    // Top rated driver
    const topBadge = formatDriverRatingBadge(4.9, 15);
    expect(topBadge.displayText).toBe("⭐ 4.9 (15)");
    expect(topBadge.badgeVariant).toBe("success");

    // Blocked driver
    const blockedBadge = formatDriverRatingBadge(2.2, 5, true);
    expect(blockedBadge.displayText).toBe("🚫 Blocked Driver");
    expect(blockedBadge.badgeVariant).toBe("danger");
  });

  it("validates rating submissions properly", () => {
    const valid = validateDriverRatingSubmission({
      vehicleId: "veh-1",
      driverUserId: "drv-1",
      riderUserId: "rdr-1",
      rating: 5,
    });
    expect(valid.isValid).toBe(true);

    // Self rating forbidden
    const selfRate = validateDriverRatingSubmission({
      vehicleId: "veh-1",
      driverUserId: "user-1",
      riderUserId: "user-1",
      rating: 5,
    });
    expect(selfRate.isValid).toBe(false);
    expect(selfRate.error).toContain("cannot rate themselves");

    // Out of bounds rating
    const invalidRating = validateDriverRatingSubmission({
      vehicleId: "veh-1",
      driverUserId: "drv-1",
      riderUserId: "rdr-1",
      rating: 6,
    });
    expect(invalidRating.isValid).toBe(false);
    expect(invalidRating.error).toContain("between 1 and 5");
  });
});
