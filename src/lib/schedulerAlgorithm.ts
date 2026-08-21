import { UserAvailability } from "@/services/availabilityService";

export interface TimeSlot {
  day_of_week: number;
  slot_index: number;
}

export interface MeetingSuggestion {
  day_of_week: number;
  start_slot_index: number;
  end_slot_index: number; // The slot index where the meeting ends (exclusive)
  available_users: number;
  total_users: number;
  availability_percentage: number;
}

/**
 * Finds the best meeting times.
 * @param availabilityData The array of user availability data fetched from the DB.
 * @param allUserIds The complete list of user IDs in the selected group.
 * @param durationSlots The duration of the meeting in 30-minute slots.
 * @param limit The number of suggestions to return.
 */
export function findBestMeetingTimes(
  availabilityData: UserAvailability[],
  allUserIds: string[],
  durationSlots: number,
  limit: number = 3,
): MeetingSuggestion[] {
  const totalUsers = allUserIds.length;
  if (totalUsers === 0 || durationSlots <= 0) return [];

  // Map to easily check if a user is explicitly unavailable for a given day and slot
  // Default is assumed available (since they haven't marked themselves busy)
  // or we can count how many are explicitly unavailable.
  // user_availability table has is_available boolean.
  const unavailableMap = new Map<string, Set<string>>();

  for (const record of availabilityData) {
    if (!record.is_available) {
      const key = `${record.day_of_week}-${record.slot_index}`;
      if (!unavailableMap.has(key)) {
        unavailableMap.set(key, new Set());
      }
      unavailableMap.get(key)!.add(record.user_id);
    }
  }

  const suggestions: MeetingSuggestion[] = [];

  // 7 days, 28 slots per day (8:00 AM to 10:00 PM, 30 min each = 14 hours * 2 = 28)
  for (let day = 0; day < 7; day++) {
    for (let startSlot = 0; startSlot <= 28 - durationSlots; startSlot++) {
      // For a given startSlot, we need to check if durationSlots contiguous blocks are available
      const unavailableUsersForWindow = new Set<string>();

      for (let offset = 0; offset < durationSlots; offset++) {
        const currentSlot = startSlot + offset;
        const key = `${day}-${currentSlot}`;
        const usersBusyHere = unavailableMap.get(key);
        if (usersBusyHere) {
          usersBusyHere.forEach((userId) => {
            // Only consider users in the allUserIds list
            if (allUserIds.includes(userId)) {
              unavailableUsersForWindow.add(userId);
            }
          });
        }
      }

      const availableCount = totalUsers - unavailableUsersForWindow.size;
      const percentage = (availableCount / totalUsers) * 100;

      suggestions.push({
        day_of_week: day,
        start_slot_index: startSlot,
        end_slot_index: startSlot + durationSlots,
        available_users: availableCount,
        total_users: totalUsers,
        availability_percentage: percentage,
      });
    }
  }

  // Sort the suggestions
  // 1. Highest availability percentage
  // 2. Earliest day/time as a tie-breaker (or could be reasonable hours)
  suggestions.sort((a, b) => {
    if (b.availability_percentage !== a.availability_percentage) {
      return b.availability_percentage - a.availability_percentage;
    }
    // Tie breaker: just prefer earlier in the week, earlier in the day
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_slot_index - b.start_slot_index;
  });

  // Since contiguous slots with same availability can overlap, we should filter out heavily overlapping ones
  // or just return the absolute best ones. We'll filter overlapping suggestions so the top 3 are distinct times.
  const distinctSuggestions: MeetingSuggestion[] = [];

  for (const current of suggestions) {
    if (distinctSuggestions.length >= limit) break;

    // Check if `current` overlaps significantly with any already selected suggestion
    const isOverlapping = distinctSuggestions.some((selected) => {
      if (selected.day_of_week !== current.day_of_week) return false;
      // Overlap condition: start of one is before end of another, and vice versa
      return (
        current.start_slot_index < selected.end_slot_index &&
        current.end_slot_index > selected.start_slot_index
      );
    });

    if (!isOverlapping) {
      distinctSuggestions.push(current);
    }
  }

  return distinctSuggestions;
}
