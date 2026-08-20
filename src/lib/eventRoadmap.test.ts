import { describe, expect, it } from "vitest";
import {
  findScheduleConflict,
  getRoadmapIcsContent,
  getSessionDayKey,
  getTimelinePosition,
  getTimelineWindow,
  type EventSession,
} from "./eventRoadmap";

const session = (overrides: Partial<EventSession>): EventSession => ({
  id: "session-1",
  event_id: "event-1",
  title: "Opening keynote",
  description: "Welcome to the festival.",
  track: "Main track",
  location: "Auditorium",
  starts_at: "2026-10-15T09:00:00.000Z",
  ends_at: "2026-10-15T10:00:00.000Z",
  ...overrides,
});

describe("event roadmap helpers", () => {
  it("builds a timeline window and positions sessions proportionally", () => {
    const sessions = [
      session({
        id: "one",
        starts_at: "2026-10-15T09:00:00.000Z",
        ends_at: "2026-10-15T10:00:00.000Z",
      }),
      session({
        id: "two",
        starts_at: "2026-10-15T11:00:00.000Z",
        ends_at: "2026-10-15T12:00:00.000Z",
      }),
    ];
    const window = getTimelineWindow(sessions);

    expect(window).not.toBeNull();
    expect(getTimelinePosition(sessions[1], window!)).toMatchObject({
      left: expect.closeTo(66.67, 1),
      width: expect.closeTo(33.33, 1),
    });
  });

  it("detects temporal overlap but allows back-to-back sessions", () => {
    const first = session({
      id: "first",
      starts_at: "2026-10-15T09:00:00.000Z",
      ends_at: "2026-10-15T10:00:00.000Z",
    });
    const overlapping = session({
      id: "overlap",
      title: "Workshop",
      starts_at: "2026-10-15T09:30:00.000Z",
      ends_at: "2026-10-15T10:30:00.000Z",
    });
    const adjacent = session({
      id: "adjacent",
      title: "Workshop",
      starts_at: "2026-10-15T10:00:00.000Z",
      ends_at: "2026-10-15T11:00:00.000Z",
    });

    expect(findScheduleConflict(overlapping, [first])).toContain("Opening keynote");
    expect(findScheduleConflict(adjacent, [first])).toBeNull();
  });

  it("exports each selected session as a separate RFC 5545 VEVENT", () => {
    const content = getRoadmapIcsContent("Tech Conference", [
      session({ id: "keynote", title: "Opening; keynote" }),
      session({
        id: "workshop",
        title: "Workshop, AI",
        starts_at: "2026-10-16T09:00:00.000Z",
        ends_at: "2026-10-16T10:30:00.000Z",
      }),
    ]);

    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("UID:keynote@campusconnect.app");
    expect(content).toContain("UID:workshop@campusconnect.app");
    expect(content).toContain("SUMMARY:Opening\\; keynote");
    expect(content).toContain("SUMMARY:Workshop\\, AI");
    expect(content?.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(content?.endsWith("END:VCALENDAR")).toBe(true);
  });

  it("groups sessions by their UTC calendar day", () => {
    expect(getSessionDayKey(session({ starts_at: "2026-10-17T02:00:00.000Z" }))).toBe("2026-10-17");
  });
});
