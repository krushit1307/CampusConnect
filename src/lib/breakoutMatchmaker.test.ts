import { describe, it, expect } from "vitest";
import {
  calculateProfileSimilarity,
  matchBreakoutRooms,
  exportZoomBreakoutCsv,
  AttendeeProfile,
} from "./breakoutMatchmaker";

describe("Live Sub-Group / Breakout Room Matchmaker Utility (#3540)", () => {
  const sampleAttendees: AttendeeProfile[] = [
    {
      id: "u-1",
      name: "Alex Dev",
      email: "alex@campus.edu",
      major: "Computer Science",
      year: "Senior",
      interests: ["React", "AI", "TypeScript"],
    },
    {
      id: "u-2",
      name: "Sam Tech",
      email: "sam@campus.edu",
      major: "Computer Science",
      year: "Senior",
      interests: ["React", "Fullstack", "TypeScript"],
    },
    {
      id: "u-3",
      name: "Jordan Quant",
      email: "jordan@campus.edu",
      major: "Finance",
      year: "Junior",
      interests: ["Fintech", "Crypto", "Python"],
    },
    {
      id: "u-4",
      name: "Taylor Banker",
      email: "taylor@campus.edu",
      major: "Finance",
      year: "Junior",
      interests: ["Fintech", "Investment Banking"],
    },
    {
      id: "u-5",
      name: "Morgan AI",
      email: "morgan@campus.edu",
      major: "Computer Science",
      year: "Senior",
      interests: ["AI", "Machine Learning", "Python"],
    },
    {
      id: "u-6",
      name: "Casey Markets",
      email: "casey@campus.edu",
      major: "Finance",
      year: "Junior",
      interests: ["Crypto", "Equities"],
    },
  ];

  it("calculates profile similarity based on major, year, and interest overlap", () => {
    // Alex & Sam: same major (CS), same year (Senior), shared interests (React, TS)
    const simHigh = calculateProfileSimilarity(sampleAttendees[0], sampleAttendees[1]);
    // Alex & Jordan: different major (CS vs Finance), different year (Senior vs Junior)
    const simLow = calculateProfileSimilarity(sampleAttendees[0], sampleAttendees[2]);

    expect(simHigh).toBeGreaterThan(0.7);
    expect(simLow).toBeLessThan(0.4);
  });

  it("clusters attendees into cohesive breakout rooms based on similarity", () => {
    const rooms = matchBreakoutRooms(sampleAttendees, 3);

    expect(rooms).toHaveLength(2); // 6 attendees / 3 per room = 2 rooms
    expect(rooms[0].attendees).toHaveLength(3);
    expect(rooms[1].attendees).toHaveLength(3);

    // CS seniors should be grouped together in one room
    const csRoom = rooms.find((r) => r.attendees.some((a) => a.email === "alex@campus.edu"));
    expect(csRoom?.attendees.map((a) => a.major)).toContain("Computer Science");
  });

  it("exports standard Zoom Pre-assignment compatible CSV format", () => {
    const rooms = matchBreakoutRooms(sampleAttendees, 3);
    const csv = exportZoomBreakoutCsv(rooms);

    expect(csv).toContain("Pre-assign Room Name,Email Address");
    expect(csv).toContain('"Room 1","alex@campus.edu"');
    expect(csv).toContain('"Room 2"');
  });
});
