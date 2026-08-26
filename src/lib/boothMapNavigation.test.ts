import { describe, it, expect } from "vitest";
import {
  searchBoothsInMap,
  getHighlightedBoothNode,
  toggleBoothBusyStatus,
  BoothNode,
  STATUS_COLOR_MAP,
} from "./boothMapNavigation";

describe("Interactive Club Recruitment Booth Map Suite (#3669)", () => {
  const sampleBooths: BoothNode[] = [
    {
      id: "b_101",
      eventId: "fair_2026",
      clubId: "club_robotics",
      clubName: "Robotics Club",
      clubCategory: "Technology",
      boothLabel: "Table 101",
      posX: 25.5,
      posY: 40.0,
      status: "AVAILABLE",
    },
    {
      id: "b_102",
      eventId: "fair_2026",
      clubId: "club_chess",
      clubName: "Chess Society",
      clubCategory: "Gaming",
      boothLabel: "Table 102",
      posX: 30.0,
      posY: 40.0,
      status: "BUSY",
    },
  ];

  it("filters booth map nodes accurately based on search queries", () => {
    const roboticsSearch = searchBoothsInMap(sampleBooths, "Robotics");
    expect(roboticsSearch.length).toBe(1);
    expect(roboticsSearch[0].clubId).toBe("club_robotics");

    const categorySearch = searchBoothsInMap(sampleBooths, "Gaming");
    expect(categorySearch.length).toBe(1);
    expect(categorySearch[0].clubId).toBe("club_chess");
  });

  it("extracts highlighted coordinates and status color for selected club booth", () => {
    const highlight = getHighlightedBoothNode(sampleBooths, "club_robotics");

    expect(highlight).not.toBeNull();
    expect(highlight?.booth.posX).toBe(25.5);
    expect(highlight?.booth.posY).toBe(40.0);
    expect(highlight?.isPulsingHighlight).toBe(true);
    expect(highlight?.statusColor).toBe(STATUS_COLOR_MAP.AVAILABLE);
  });

  it("toggles booth busy status and updates indicator color to red", () => {
    const updated = toggleBoothBusyStatus(sampleBooths[0], "BUSY");
    expect(updated.status).toBe("BUSY");

    const highlight = getHighlightedBoothNode([updated], "club_robotics");
    expect(highlight?.statusColor).toBe(STATUS_COLOR_MAP.BUSY); // Red (#ef4444)
  });
});
