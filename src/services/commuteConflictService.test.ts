import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistanceKm,
  calculateDistanceMiles,
  calculateWalkingTimeMinutes,
  detectCommuteConflict,
} from "./commuteConflictService";

describe("commuteConflictService", () => {
  it("calculates haversine distance correctly", () => {
    // Approx North Campus (40.7128, -74.0060) to South Campus (40.7282, -73.9942)
    const km = calculateHaversineDistanceKm(40.7128, -74.006, 40.7282, -73.9942);
    expect(km).toBeGreaterThan(1.5);
    expect(km).toBeLessThan(2.5);

    const miles = calculateDistanceMiles(40.7128, -74.006, 40.7282, -73.9942);
    expect(miles).toBeGreaterThan(0.9);
    expect(miles).toBeLessThan(1.6);
  });

  it("calculates walking time properly", () => {
    const time = calculateWalkingTimeMinutes(2.4); // 2.4km at ~4.8km/h -> 30 mins
    expect(time).toBe(30);
  });

  it("detects impossible commute between consecutive events", () => {
    const targetEvent = {
      id: "event-2",
      title: "South Campus Robotics Workshop",
      location: "South Campus Hall",
      latitude: 40.7282,
      longitude: -73.9942,
      start_date: "2026-08-21T14:05:00Z",
      end_date: "2026-08-21T15:00:00Z",
    };

    const registeredEvents = [
      {
        id: "event-1",
        title: "North Campus AI Lecture",
        location: "North Campus Auditorium",
        latitude: 40.7128,
        longitude: -74.006,
        start_date: "2026-08-21T13:00:00Z",
        end_date: "2026-08-21T14:00:00Z", // 5 min gap, ~25 min walk
      },
    ];

    const conflict = detectCommuteConflict(targetEvent, registeredEvents);
    expect(conflict).not.toBeNull();
    expect(conflict?.temporalGapMinutes).toBe(5);
    expect(conflict?.estimatedTravelMinutes).toBeGreaterThan(5);
    expect(conflict?.warningMessage).toContain("Warning: You only have 5 minutes to travel");
  });

  it("returns null if sufficient travel time exists", () => {
    const targetEvent = {
      id: "event-2",
      title: "South Campus Robotics Workshop",
      latitude: 40.7282,
      longitude: -73.9942,
      start_date: "2026-08-21T15:00:00Z",
      end_date: "2026-08-21T16:00:00Z",
    };

    const registeredEvents = [
      {
        id: "event-1",
        title: "North Campus AI Lecture",
        latitude: 40.7128,
        longitude: -74.006,
        start_date: "2026-08-21T13:00:00Z",
        end_date: "2026-08-21T14:00:00Z", // 60 min gap, ~25 min walk -> OK
      },
    ];

    const conflict = detectCommuteConflict(targetEvent, registeredEvents);
    expect(conflict).toBeNull();
  });
});
