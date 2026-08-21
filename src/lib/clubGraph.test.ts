import { describe, it, expect } from "vitest";
import {
  buildClubGraphData,
  detectsCircularDependency,
  getConnectedNeighborIds,
  RawClubRecord,
} from "./clubGraph";

describe("Interactive Club Affiliation Graph Suite (#2736)", () => {
  const sampleClubs: RawClubRecord[] = [
    { id: "union", name: "Student Union", category: "Governance", parentClubId: null },
    { id: "eng_soc", name: "Engineering Society", category: "Academic", parentClubId: "union" },
    {
      id: "swe_club",
      name: "Software Engineering Club",
      category: "Academic",
      parentClubId: "eng_soc",
    },
    { id: "soccer", name: "Soccer Club", category: "Sports", parentClubId: "union" },
  ];

  it("transforms raw club records into graph nodes and links with color coding", () => {
    const graphData = buildClubGraphData(sampleClubs);

    expect(graphData.nodes.length).toBe(4);
    expect(graphData.links.length).toBe(3);

    // Color code check
    const engNode = graphData.nodes.find((n) => n.id === "eng_soc");
    expect(engNode?.color).toBe("#3b82f6"); // Blue for Academic

    // Link connection check
    expect(graphData.links).toContainEqual({ source: "eng_soc", target: "swe_club" });
  });

  it("detects circular dependency loops when establishing parent relationships", () => {
    // Attempting to set Student Union's parent as Software Engineering Club (creates cycle: Union -> Eng -> SWE -> Union)
    const isCycle = detectsCircularDependency(sampleClubs, "union", "swe_club");
    expect(isCycle).toBe(true);

    // Valid non-circular parent change
    const isValid = detectsCircularDependency(sampleClubs, "soccer", "eng_soc");
    expect(isValid).toBe(false);
  });

  it("retrieves direct parents and children for node highlighting", () => {
    const graphData = buildClubGraphData(sampleClubs);
    const neighbors = getConnectedNeighborIds(graphData.links, "eng_soc");

    expect(neighbors.parents).toEqual(["union"]);
    expect(neighbors.children).toEqual(["swe_club"]);
  });
});
