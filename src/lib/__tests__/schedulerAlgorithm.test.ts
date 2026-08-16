import { describe, it, expect } from "vitest";
import { findBestMeetingTimes } from "../schedulerAlgorithm";
import { UserAvailability } from "@/services/availabilityService";

describe("schedulerAlgorithm", () => {
  const users = ["u1", "u2", "u3"];

  it("should suggest earliest times when everyone is available", () => {
    // Empty availability data means everyone is available (default true)
    const suggestions = findBestMeetingTimes([], users, 2, 3);

    expect(suggestions).toHaveLength(3);

    // The top suggestions should be early Monday morning
    expect(suggestions[0]).toEqual({
      day_of_week: 0,
      start_slot_index: 0,
      end_slot_index: 2,
      available_users: 3,
      total_users: 3,
      availability_percentage: 100,
    });
  });

  it("should ignore overlapping suggestions to provide distinct times", () => {
    const suggestions = findBestMeetingTimes([], users, 2, 3);
    // Since start_slot=0 and end_slot=2, the next non-overlapping should be start_slot=2
    expect(suggestions[1].start_slot_index).toBe(2);
    expect(suggestions[2].start_slot_index).toBe(4);
  });

  it("should suggest times avoiding busy users", () => {
    // User 1 is busy Monday 8:00am - 9:00am (slots 0, 1)
    const data: UserAvailability[] = [
      { user_id: "u1", day_of_week: 0, slot_index: 0, is_available: false },
      { user_id: "u1", day_of_week: 0, slot_index: 1, is_available: false },
    ];

    const suggestions = findBestMeetingTimes(data, users, 2, 3);

    // First suggestion with 100% availability should be Monday 9:00am (slot 2)
    expect(suggestions[0].start_slot_index).toBe(2);
    expect(suggestions[0].availability_percentage).toBe(100);

    // If we only look at slot 0, it should have 66.6% availability
    const allSlots = findBestMeetingTimes(data, users, 2, 100);
    const slot0 = allSlots.find((s) => s.day_of_week === 0 && s.start_slot_index === 0);
    expect(slot0?.available_users).toBe(2);
  });

  it("should filter properly when nobody is completely free", () => {
    // Everyone is busy at slot 0
    const data: UserAvailability[] = [
      { user_id: "u1", day_of_week: 0, slot_index: 0, is_available: false },
      { user_id: "u2", day_of_week: 0, slot_index: 0, is_available: false },
      { user_id: "u3", day_of_week: 0, slot_index: 0, is_available: false },
      // But u1 is free at slot 1, others busy
      { user_id: "u2", day_of_week: 0, slot_index: 1, is_available: false },
      { user_id: "u3", day_of_week: 0, slot_index: 1, is_available: false },
    ];

    const allSlots = findBestMeetingTimes(data, users, 2, 100);

    // Slot 0 has 0% availability
    const slot0 = allSlots.find((s) => s.day_of_week === 0 && s.start_slot_index === 0);
    expect(slot0?.available_users).toBe(0);

    // But it will still suggest the best times (other times are 100% free)
    const suggestions = findBestMeetingTimes(data, users, 2, 3);
    expect(suggestions[0].availability_percentage).toBe(100);
    // Since slot 0 is completely busy, slot 1 has u1 free, slot 2 is fully free.
    // So the best duration=2 slot will start at slot 2.
    expect(suggestions[0].start_slot_index).toBe(2);
  });
});
