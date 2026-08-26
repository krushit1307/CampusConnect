import { describe, it, expect } from "vitest";
import {
  doBookingsOverlapWithBuffer,
  validateBookingRequest,
  getOverdueBookings,
  ResourceBookingRecord,
  MANDATORY_BUFFER_MINUTES,
} from "./resourceBooking";

describe("Centralized Resource Booking System Suite (#2795)", () => {
  const baseTime = new Date("2026-09-01T10:00:00Z").getTime();
  const formatIso = (ms: number) => new Date(ms).toISOString();

  const existingApprovedBooking: ResourceBookingRecord = {
    id: "b1",
    resourceId: "pa_system_01",
    clubId: "club_music",
    startTime: formatIso(baseTime), // 10:00 AM
    endTime: formatIso(baseTime + 2 * 60 * 60 * 1000), // 12:00 PM
    status: "APPROVED",
  };

  it("enforces a mandatory 30-minute transit buffer time between adjacent bookings", () => {
    // Attempting to book at exactly 12:00 PM (immediately after 12:00 PM finish)
    const immediateOverlap = doBookingsOverlapWithBuffer(
      existingApprovedBooking.startTime,
      existingApprovedBooking.endTime,
      formatIso(baseTime + 2 * 60 * 60 * 1000), // 12:00 PM
      formatIso(baseTime + 4 * 60 * 60 * 1000), // 2:00 PM
    );
    expect(immediateOverlap).toBe(true); // Should overlap due to +30m buffer

    // Booking at 12:35 PM (after 30m buffer) -> Allowed
    const safeOverlap = doBookingsOverlapWithBuffer(
      existingApprovedBooking.startTime,
      existingApprovedBooking.endTime,
      formatIso(baseTime + 2.6 * 60 * 60 * 1000), // 12:36 PM
      formatIso(baseTime + 4 * 60 * 60 * 1000),
    );
    expect(safeOverlap).toBe(false);
  });

  it("validates booking requests and blocks conflicting interval submissions", () => {
    const invalidRequest = validateBookingRequest(
      {
        resourceId: "pa_system_01",
        clubId: "club_dance",
        startTime: formatIso(baseTime + 1 * 60 * 60 * 1000), // 11:00 AM
        endTime: formatIso(baseTime + 3 * 60 * 60 * 1000), // 1:00 PM
      },
      [existingApprovedBooking],
    );

    expect(invalidRequest.isValid).toBe(false);
    expect(invalidRequest.conflictReason).toContain(
      `${MANDATORY_BUFFER_MINUTES}-minute transit buffer`,
    );
  });

  it("flags overdue bookings when end time has passed without being marked RETURNED", () => {
    const pastEndTime = baseTime + 5 * 60 * 60 * 1000; // 3:00 PM
    const overdueList = getOverdueBookings([existingApprovedBooking], pastEndTime);

    expect(overdueList.length).toBe(1);
    expect(overdueList[0].id).toBe("b1");
  });
});
