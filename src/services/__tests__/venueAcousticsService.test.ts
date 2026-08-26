import { describe, it, expect } from "vitest";
import {
  evaluateAcousticMatch,
  filterAcousticFriendlyVenues,
  VenueAcoustics,
} from "../venueAcousticsService";

describe("venueAcousticsService - Sound & Acoustic Compatibility", () => {
  const mockVenues: VenueAcoustics[] = [
    {
      id: "v1",
      name: "Student Union Atrium",
      acoustic_profile: "echo_heavy",
      ambient_db_avg: 68.5,
    },
    {
      id: "v2",
      name: "Music Recital Hall",
      acoustic_profile: "soundproof",
      ambient_db_avg: 32.0,
    },
    {
      id: "v3",
      name: "Dining Plaza Courtyard",
      acoustic_profile: "loud_ambient",
      ambient_db_avg: 76.2,
    },
    {
      id: "v4",
      name: "Auditorium 101",
      acoustic_profile: "moderate",
      ambient_db_avg: 42.0,
    },
  ];

  it("filters out echo_heavy and loud_ambient venues when selecting Acoustic Music or Spoken Word", () => {
    const filtered = filterAcousticFriendlyVenues(mockVenues, "Spoken Word");
    expect(filtered.length).toBe(2);
    expect(filtered.map((v) => v.name)).toEqual(["Music Recital Hall", "Auditorium 101"]);
  });

  it("does not filter venues for non-acoustic sensitive categories like Hackathons or Gaming", () => {
    const unfiltered = filterAcousticFriendlyVenues(mockVenues, "Hackathon");
    expect(unfiltered.length).toBe(4);
  });

  it("evaluates incompatible match with a warning for echo_heavy venues selected for poetry reading", () => {
    const result = evaluateAcousticMatch("Poetry Reading", mockVenues[0]);
    expect(result.isCompatible).toBe(false);
    expect(result.severity).toBe("incompatible");
    expect(result.warningMessage).toContain("reverberation / echo");
  });

  it("evaluates warning for loud_ambient venues selected for spoken word", () => {
    const result = evaluateAcousticMatch("Spoken Word", mockVenues[2]);
    expect(result.isCompatible).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.warningMessage).toContain("high ambient noise");
  });

  it("confirms compatibility for soundproof or moderate venues", () => {
    const result = evaluateAcousticMatch("Acoustic Music", mockVenues[1]);
    expect(result.isCompatible).toBe(true);
    expect(result.severity).toBe("none");
    expect(result.warningMessage).toBeUndefined();
  });
});
