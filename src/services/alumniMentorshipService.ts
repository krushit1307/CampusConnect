import { createClient } from "@/lib/supabase/client";
import type {
  AlumniMentorshipAvailability,
  MentorshipSession,
  BookMentorshipSessionResult,
} from "@/types/database";

export interface TimeSlot {
  startTimeISO: string;
  endTimeISO: string;
  displayLabel: string;
  isAvailable: boolean;
}

export interface SetAvailabilitySlot {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

/**
 * Retrieves an alumnus's weekly availability schedule.
 */
export async function getMentorAvailability(
  mentorId: string,
): Promise<AlumniMentorshipAvailability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alumni_mentorship_availability")
    .select("*")
    .eq("mentor_id", mentorId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching mentor availability:", error);
    throw error;
  }

  return (data as AlumniMentorshipAvailability[]) || [];
}

/**
 * Saves or updates an alumnus's mentorship availability slots.
 */
export async function setMentorAvailability(
  mentorId: string,
  slots: SetAvailabilitySlot[],
): Promise<AlumniMentorshipAvailability[]> {
  const supabase = createClient();

  // Deactivate existing slots
  await supabase
    .from("alumni_mentorship_availability")
    .update({ is_active: false })
    .eq("mentor_id", mentorId);

  if (slots.length === 0) return [];

  const rowsToInsert = slots.map((s) => ({
    mentor_id: mentorId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    slot_duration_minutes: 15,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("alumni_mentorship_availability")
    .insert(rowsToInsert)
    .select();

  if (error) {
    console.error("Error setting mentor availability:", error);
    throw error;
  }

  return (data as AlumniMentorshipAvailability[]) || [];
}

/**
 * Computes available 15-minute coffee chat slots for a specific mentor on a given date.
 */
export async function generateAvailableTimeSlots(
  mentorId: string,
  targetDateStr: string, // e.g. "2026-09-01"
): Promise<TimeSlot[]> {
  const supabase = createClient();

  const targetDate = new Date(targetDateStr + "T00:00:00Z");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = days[targetDate.getUTCDay()];

  // Fetch mentor's rule for this day of the week
  const { data: availabilityRules } = await supabase
    .from("alumni_mentorship_availability")
    .select("*")
    .eq("mentor_id", mentorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  if (!availabilityRules || availabilityRules.length === 0) {
    return [];
  }

  // Fetch already booked sessions for this mentor on the target date
  const startOfDay = `${targetDateStr}T00:00:00Z`;
  const endOfDay = `${targetDateStr}T23:59:59Z`;

  const { data: existingSessions } = await supabase
    .from("mentorship_sessions")
    .select("start_time, end_time")
    .eq("mentor_id", mentorId)
    .eq("status", "scheduled")
    .gte("start_time", startOfDay)
    .lte("start_time", endOfDay);

  const bookedSlots = (existingSessions || []).map((s: any) => ({
    start: new Date(s.start_time).getTime(),
    end: new Date(s.end_time).getTime(),
  }));

  const slots: TimeSlot[] = [];

  for (const rule of availabilityRules) {
    const [startH, startM] = rule.start_time.split(":").map(Number);
    const [endH, endM] = rule.end_time.split(":").map(Number);

    let current = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        startH,
        startM,
      ),
    );

    const endBoundary = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        endH,
        endM,
      ),
    );

    while (current.getTime() + 15 * 60 * 1000 <= endBoundary.getTime()) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current.getTime() + 15 * 60 * 1000);

      const isBooked = bookedSlots.some(
        (b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start,
      );

      const formatTime = (d: Date) =>
        d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "UTC",
        });

      slots.push({
        startTimeISO: slotStart.toISOString(),
        endTimeISO: slotEnd.toISOString(),
        displayLabel: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
        isAvailable: !isBooked,
      });

      current = slotEnd;
    }
  }

  return slots;
}

/**
 * Generates an iCalendar (.ics) invite string for a booked mentorship session.
 */
export function generateIcsInvite(
  session: MentorshipSession,
  mentorName: string = "Alumni Mentor",
  menteeName: string = "Student",
): string {
  const formatDateForIcs = (isoStr: string) => {
    const d = new Date(isoStr);
    return (
      d
        .toISOString()
        .replace(/-|:|\.\d+/g, "")
        .substring(0, 15) + "Z"
    );
  };

  const dtStart = formatDateForIcs(session.start_time);
  const dtEnd = formatDateForIcs(session.end_time);
  const now = formatDateForIcs(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusConnect//Alumni Mentorship Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:mentorship-${session.id}@campusconnect.edu`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:15-Min Alumni Coffee Chat with ${mentorName}`,
    `DESCRIPTION:Virtual 15-minute coffee chat between ${menteeName} and ${mentorName}.\\nJoin Video Call: ${session.meeting_link}\\nTopic: ${session.topic || "General Career Advice"}`,
    `LOCATION:${session.meeting_link}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Books a 15-minute mentorship coffee chat session:
 * 1. Checks mentee has >= 100 points balance.
 * 2. Deducts 100 points via RPC.
 * 3. Creates mentorship session record with unique video call URL.
 */
export async function bookMentorshipSession(
  mentorId: string,
  menteeId: string,
  startTimeISO: string,
  endTimeISO: string,
  topic?: string,
): Promise<BookMentorshipSessionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("book_mentorship_session_transaction", {
    p_mentor_id: mentorId,
    p_mentee_id: menteeId,
    p_start_time: startTimeISO,
    p_end_time: endTimeISO,
    p_topic: topic || "General Career Guidance",
  });

  if (error) {
    console.error("Error booking mentorship session:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return data as BookMentorshipSessionResult;
}
