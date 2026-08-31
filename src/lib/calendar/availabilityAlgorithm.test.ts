import { describe, it, expect } from "vitest";
import {
  findMutualAvailability,
  type CalendarEvent,
  type AvailabilityConfig,
} from "./availabilityAlgorithm";
import addDays from "date-fns/addDays";
import setHours from "date-fns/setHours";
import startOfDay from "date-fns/startOfDay";

describe("Availability Algorithm", () => {
  const baseDate = startOfDay(new Date("2026-10-15T00:00:00"));

  const createISO = (hours: number, minutes: number = 0) => {
    const d = new Date(baseDate);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const createNextDayISO = (hours: number, minutes: number = 0) => {
    const d = addDays(baseDate, 1);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const config: AvailabilityConfig = {
    startDate: createISO(9, 0), // 9 AM
    endDate: createISO(17, 0), // 5 PM
    slotDurationMinutes: 30,
    workingHoursStart: 9,
    workingHoursEnd: 17,
  };

  it("should return all slots when there are no events", () => {
    const mentorEvents: CalendarEvent[] = [];
    const menteeEvents: CalendarEvent[] = [];

    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    // 9 AM to 5 PM is 8 hours = 16 slots of 30 minutes
    expect(result.length).toBe(16);
    expect(result[0].start).toBe(createISO(9, 0));
    expect(result[0].end).toBe(createISO(9, 30));
    expect(result[15].start).toBe(createISO(16, 30));
    expect(result[15].end).toBe(createISO(17, 0));
  });

  it("should exclude slots overlapping with mentor events", () => {
    const mentorEvents: CalendarEvent[] = [
      { start: createISO(10, 0), end: createISO(11, 0) }, // 2 slots busy
    ];
    const menteeEvents: CalendarEvent[] = [];

    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    expect(result.length).toBe(14); // 16 - 2 = 14

    // Check that 10:00 and 10:30 slots are missing
    const has10 = result.some((r) => r.start === createISO(10, 0));
    const has1030 = result.some((r) => r.start === createISO(10, 30));
    expect(has10).toBe(false);
    expect(has1030).toBe(false);
  });

  it("should exclude slots overlapping with mentee events", () => {
    const mentorEvents: CalendarEvent[] = [];
    const menteeEvents: CalendarEvent[] = [
      { start: createISO(14, 0), end: createISO(15, 30) }, // 3 slots busy
    ];

    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    expect(result.length).toBe(13); // 16 - 3 = 13
  });

  it("should handle overlapping mentor and mentee events", () => {
    const mentorEvents: CalendarEvent[] = [
      { start: createISO(10, 0), end: createISO(12, 0) }, // 4 slots busy
    ];
    const menteeEvents: CalendarEvent[] = [
      { start: createISO(11, 0), end: createISO(13, 0) }, // 4 slots busy, 2 overlapping with mentor
    ];

    // Total busy time: 10:00 to 13:00 (6 slots)
    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    expect(result.length).toBe(10); // 16 - 6 = 10
  });

  it("should jump to the next day's working hours if current day ends", () => {
    const multiDayConfig: AvailabilityConfig = {
      startDate: createISO(16, 0),
      endDate: createNextDayISO(11, 0),
      slotDurationMinutes: 60,
      workingHoursStart: 9,
      workingHoursEnd: 17,
    };

    const mentorEvents: CalendarEvent[] = [];
    const menteeEvents: CalendarEvent[] = [];

    const result = findMutualAvailability(mentorEvents, menteeEvents, multiDayConfig);
    // Day 1: 16:00 to 17:00 -> 1 slot
    // Day 2: 09:00 to 11:00 -> 2 slots
    // Total 3 slots
    expect(result.length).toBe(3);
    expect(result[0].start).toBe(createISO(16, 0));
    expect(result[1].start).toBe(createNextDayISO(9, 0));
    expect(result[2].start).toBe(createNextDayISO(10, 0));
  });

  it("should handle events that partially overlap slots", () => {
    const mentorEvents: CalendarEvent[] = [{ start: createISO(10, 15), end: createISO(10, 45) }];
    const menteeEvents: CalendarEvent[] = [];

    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    // Overlaps with 10:00-10:30 and 10:30-11:00
    // So 2 slots are excluded
    expect(result.length).toBe(14);
    const has10 = result.some((r) => r.start === createISO(10, 0));
    const has1030 = result.some((r) => r.start === createISO(10, 30));
    expect(has10).toBe(false);
    expect(has1030).toBe(false);
  });

  it("adjacent slots and events do not overlap", () => {
    const mentorEvents: CalendarEvent[] = [{ start: createISO(10, 0), end: createISO(10, 30) }];
    const menteeEvents: CalendarEvent[] = [];

    const result = findMutualAvailability(mentorEvents, menteeEvents, config);
    // Only 10:00 to 10:30 is busy
    expect(result.length).toBe(15);

    // 9:30 should end at 10:00 and NOT overlap
    const has930 = result.some((r) => r.start === createISO(9, 30));
    // 10:30 should start at 10:30 and NOT overlap
    const has1030 = result.some((r) => r.start === createISO(10, 30));

    expect(has930).toBe(true);
    expect(has1030).toBe(true);
  });
});
