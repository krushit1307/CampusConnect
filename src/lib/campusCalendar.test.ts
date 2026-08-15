import { describe, expect, it } from "vitest";
import { findCampusCalendarConflicts } from "./campusCalendar";

describe("findCampusCalendarConflicts", () => {
  const events = [
    {
      id: "break",
      title: "Spring Break",
      start_date: "2026-03-16T00:00:00.000Z",
      end_date: "2026-03-20T23:59:59.999Z",
      type: "holiday" as const,
    },
    {
      id: "finals",
      title: "Final Exams",
      start_date: "2026-05-04T00:00:00.000Z",
      end_date: "2026-05-08T23:59:59.999Z",
      type: "exam_period" as const,
    },
  ];

  it("returns periods that overlap the selected range", () => {
    expect(
      findCampusCalendarConflicts(events, "2026-03-20T18:00:00.000Z", "2026-03-21T18:00:00.000Z"),
    ).toEqual([events[0]]);
  });

  it("returns no periods when dates are incomplete or invalid", () => {
    expect(findCampusCalendarConflicts(events)).toEqual([]);
    expect(findCampusCalendarConflicts(events, "not-a-date", "2026-03-21T18:00:00.000Z")).toEqual(
      [],
    );
  });
});
