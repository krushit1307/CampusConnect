import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { parseAcademicCalendarIcs } from "./academicCalendar.ts";

Deno.test("parses folded ICS events and inclusive all-day ranges", () => {
  const events = parseAcademicCalendarIcs(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:break-2026@example.edu",
      "SUMMARY:Spring Break",
      "DTSTART;VALUE=DATE:20260316",
      "DTEND;VALUE=DATE:20260321",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:finals-2026@example.edu",
      "SUMMARY:Final Exam Period with a folded ",
      " line",
      "DTSTART:20260504T090000Z",
      "DTEND:20260508T170000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
  );

  assertEquals(events.length, 2);
  assertEquals(events[0].type, "holiday");
  assertEquals(events[0].startDate, "2026-03-16T00:00:00.000Z");
  assertEquals(events[0].endDate, "2026-03-20T23:59:59.999Z");
  assertEquals(events[1].type, "exam_period");
  assertEquals(events[1].title, "Final Exam Period with a folded line");
});
