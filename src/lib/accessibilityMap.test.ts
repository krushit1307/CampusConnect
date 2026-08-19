import { describe, expect, it } from "vitest";
import {
  createAccessibilityRouteSegments,
  getAccessibilityNodes,
  getSpatialDescription,
  type AccessibilityMapNode,
} from "./accessibilityMap";

const node = (overrides: Partial<AccessibilityMapNode>): AccessibilityMapNode => ({
  id: "elevator-1",
  entity_name: "North Elevator",
  type: "elevator",
  x_coord: 40,
  y_coord: 20,
  width: 5,
  height: 5,
  rotation: 0,
  ...overrides,
});

describe("accessibility map helpers", () => {
  it("filters infrastructure nodes while excluding sponsor and layout nodes", () => {
    const nodes = [
      node({ id: "entrance-1", entity_name: "Main Entrance", type: "entrance" }),
      node({ id: "sponsor-1", entity_name: "Sponsor", type: "sponsor" }),
      node({ id: "ramp-1", entity_name: "West Ramp", type: "ramp" }),
    ];

    expect(getAccessibilityNodes(nodes).map((item) => item.type)).toEqual(["entrance", "ramp"]);
  });

  it("creates route segments from the entrance to each accessibility node", () => {
    const nodes = [
      node({
        id: "entrance-1",
        entity_name: "Main Entrance",
        type: "entrance",
        x_coord: 0,
        y_coord: 0,
      }),
      node({
        id: "elevator-1",
        entity_name: "North Elevator",
        type: "elevator",
        x_coord: 40,
        y_coord: 20,
      }),
      node({ id: "ramp-1", entity_name: "West Ramp", type: "ramp", x_coord: 20, y_coord: 60 }),
    ];

    expect(createAccessibilityRouteSegments(nodes)).toEqual([
      { id: "entrance-1-elevator-1", x1: 2.5, y1: 2.5, x2: 42.5, y2: 22.5, targetType: "elevator" },
      { id: "entrance-1-ramp-1", x1: 2.5, y1: 2.5, x2: 22.5, y2: 62.5, targetType: "ramp" },
    ]);
  });

  it("narrates a node’s direction and approximate distance from the entrance", () => {
    const entrance = node({
      id: "entrance-1",
      entity_name: "Main Entrance",
      type: "entrance",
      x_coord: 0,
      y_coord: 0,
    });
    const elevator = node({ x_coord: 40, y_coord: 0 });

    expect(getSpatialDescription(elevator, entrance, 4)).toBe(
      "North Elevator is approximately 10 feet East of the Main Entrance.",
    );
  });
});
