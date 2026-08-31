import addMinutes from "date-fns/addMinutes";
import isBefore from "date-fns/isBefore";
import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
import isSameDay from "date-fns/isSameDay";
import setHours from "date-fns/setHours";
import setMinutes from "date-fns/setMinutes";
import setSeconds from "date-fns/setSeconds";
import setMilliseconds from "date-fns/setMilliseconds";
import areIntervalsOverlapping from "date-fns/areIntervalsOverlapping";

export interface CalendarEvent {
  start: string; // ISO string
  end: string; // ISO string
}

export interface TimeSlot {
  start: string; // ISO string
  end: string; // ISO string
}

export interface AvailabilityConfig {
  startDate: string; // ISO string
  endDate: string; // ISO string
  slotDurationMinutes: number;
  workingHoursStart?: number; // e.g., 9 for 9:00 AM
  workingHoursEnd?: number; // e.g., 17 for 5:00 PM
}

/**
 * Finds mutual availability between two sets of calendar events.
 *
 * @param mentorEvents List of mentor's calendar events
 * @param menteeEvents List of mentee's calendar events
 * @param config Configuration for availability search
 * @returns List of available time slots
 */
export function findMutualAvailability(
  mentorEvents: CalendarEvent[],
  menteeEvents: CalendarEvent[],
  config: AvailabilityConfig,
): TimeSlot[] {
  const {
    startDate: startDateStr,
    endDate: endDateStr,
    slotDurationMinutes,
    workingHoursStart = 9,
    workingHoursEnd = 17,
  } = config;

  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  const allEvents = [...mentorEvents, ...menteeEvents].map((evt) => ({
    start: parseISO(evt.start),
    end: parseISO(evt.end),
  }));

  const availableSlots: TimeSlot[] = [];
  let currentSlotStart = new Date(start);

  while (isBefore(currentSlotStart, end)) {
    const currentSlotEnd = addMinutes(currentSlotStart, slotDurationMinutes);

    // If the slot ends after the overall end date, stop
    if (isAfter(currentSlotEnd, end)) {
      break;
    }

    // Check if slot is within working hours
    const dayStart = setMilliseconds(
      setSeconds(setMinutes(setHours(currentSlotStart, workingHoursStart), 0), 0),
      0,
    );
    const dayEnd = setMilliseconds(
      setSeconds(setMinutes(setHours(currentSlotStart, workingHoursEnd), 0), 0),
      0,
    );

    const isWithinWorkingHours =
      (isAfter(currentSlotStart, dayStart) || currentSlotStart.getTime() === dayStart.getTime()) &&
      (isBefore(currentSlotEnd, dayEnd) || currentSlotEnd.getTime() === dayEnd.getTime()) &&
      isSameDay(currentSlotStart, currentSlotEnd); // Ensure slot doesn't span multiple days improperly

    if (!isWithinWorkingHours) {
      // Move to the next day's working hours if we've passed today's or we're before today's
      if (isAfter(currentSlotStart, dayEnd) || currentSlotStart.getTime() === dayEnd.getTime()) {
        const nextDay = addMinutes(currentSlotStart, 24 * 60);
        currentSlotStart = setMilliseconds(
          setSeconds(setMinutes(setHours(nextDay, workingHoursStart), 0), 0),
          0,
        );
      } else {
        // Move by 30 mins (or slot duration) until we hit working hours,
        // or just jump straight to dayStart
        if (isBefore(currentSlotStart, dayStart)) {
          currentSlotStart = new Date(dayStart);
        } else {
          currentSlotStart = addMinutes(currentSlotStart, slotDurationMinutes);
        }
      }
      continue;
    }

    // Check for overlap with any existing events
    const hasOverlap = allEvents.some((evt) =>
      areIntervalsOverlapping(
        { start: currentSlotStart, end: currentSlotEnd },
        { start: evt.start, end: evt.end },
      ),
    );

    if (!hasOverlap) {
      availableSlots.push({
        start: currentSlotStart.toISOString(),
        end: currentSlotEnd.toISOString(),
      });
    }

    currentSlotStart = currentSlotEnd;
  }

  return availableSlots;
}
