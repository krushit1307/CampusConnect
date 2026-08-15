import { describe, it, expect } from "vitest";
import {
  preserveTimeAndMutateDate,
  calculateRescheduledTimestamps,
  formatTimeRange,
} from "./eventRescheduleUtils";

describe("Event Reschedule Utilities & Timezone Drift Safety (#2326)", () => {
  it("should mutate Year/Month/Day to match target date while strictly preserving original Hours/Minutes/Seconds", () => {
    // Original Event: Wednesday Aug 13, 2026 at 14:30:45 (2:30:45 PM)
    const originalDate = new Date(2026, 7, 13, 14, 30, 45, 123);

    // Drag target cell: Saturday Aug 16, 2026
    const targetDate = new Date(2026, 7, 16, 0, 0, 0, 0);

    const rescheduledDate = preserveTimeAndMutateDate(originalDate, targetDate);

    // Verify Date (Year/Month/Day) mutated correctly to Saturday Aug 16
    expect(rescheduledDate.getFullYear()).toBe(2026);
    expect(rescheduledDate.getMonth()).toBe(7); // August (0-indexed)
    expect(rescheduledDate.getDate()).toBe(16);

    // CRITICAL: Verify Hours, Minutes, Seconds, and Milliseconds stay EXACTLY identical
    expect(rescheduledDate.getHours()).toBe(14);
    expect(rescheduledDate.getMinutes()).toBe(30);
    expect(rescheduledDate.getSeconds()).toBe(45);
    expect(rescheduledDate.getMilliseconds()).toBe(123);
  });

  it("should preserve original event duration when calculating new start/end timestamps", () => {
    // 2-hour event: 10:00 AM to 12:00 PM
    const origStart = new Date(2026, 7, 10, 10, 0, 0);
    const origEnd = new Date(2026, 7, 10, 12, 0, 0);

    // Dragged to Aug 20
    const targetDropDate = new Date(2026, 7, 20, 0, 0, 0);

    const result = calculateRescheduledTimestamps(origStart, origEnd, targetDropDate);

    expect(result.newStart.getDate()).toBe(20);
    expect(result.newStart.getHours()).toBe(10);

    expect(result.newEnd.getDate()).toBe(20);
    expect(result.newEnd.getHours()).toBe(12);

    // 2 hours in ms = 7,200,000 ms
    const durationMs = result.newEnd.getTime() - result.newStart.getTime();
    expect(durationMs).toBe(7200000);
  });

  it("should format time ranges cleanly for tooltips and modal cards", () => {
    const start = new Date(2026, 7, 15, 9, 30);
    const end = new Date(2026, 7, 15, 11, 0);

    const formatted = formatTimeRange(start, end);
    expect(formatted).toContain("9:30 AM");
    expect(formatted).toContain("11:00 AM");
  });
});
