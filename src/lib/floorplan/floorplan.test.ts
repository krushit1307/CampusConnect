import { describe, it, expect } from "vitest";
import { makeAsset, makePoi, DEFAULT_VENUE, ASSET_DEFAULTS, POI_DEFAULTS } from "./types";
import { findCollisions } from "./collision";
import {
  toWireJson,
  toFloorplanState,
  parseFloorplanState,
  parseAccessibilityPois,
  describeLocation,
  describeAssignment,
} from "./serialize";

describe("floorplan types", () => {
  it("creates assets with defaults from the palette", () => {
    const asset = makeAsset("round_table", 10, 12, 0);
    expect(asset.kind).toBe("round_table");
    expect(asset.width).toBe(ASSET_DEFAULTS.round_table.width);
    expect(asset.label).toContain("Round Table");
    expect(asset.assignment).toBeNull();
  });

  it("exposes an exit kind for mapping egress points", () => {
    expect(ASSET_DEFAULTS.exit).toBeDefined();
    const exit = makeAsset("exit", 0, 0, 1);
    expect(exit.kind).toBe("exit");
  });
});

describe("floorplan collision detection", () => {
  it("flags assets blocking a fire-exit clearance pathway", () => {
    const venue = DEFAULT_VENUE; // exits at top(20ft) and bottom(80ft), 6ft clearance
    const blocker = { ...makeAsset("rect_table", 18, 1, 2), id: "blocker" };
    const safe = { ...makeAsset("stage", 30, 30, 3), id: "safe" };
    const collisions = findCollisions([blocker, safe], venue);
    expect(collisions.has("blocker")).toBe(true);
    expect(collisions.has("safe")).toBe(false);
  });
});

describe("floorplan serialization (#4145 JSON contract)", () => {
  it("serializes each asset as x, y, width, height, type, assignment", () => {
    const asset = {
      ...makeAsset("rect_table", 4.567, 6.789, 4),
      assignment: { sponsorId: "42", companyName: "TacoCorp" },
    };
    const wire = toWireJson(asset);
    expect(Object.keys(wire).sort()).toEqual(
      ["assignment", "height", "id", "label", "type", "width", "x", "y"].sort(),
    );
    expect(wire.type).toBe("rect_table");
    expect(wire.x).toBeCloseTo(4.57);
    expect(wire.assignment).toEqual({ sponsorId: "42", companyName: "TacoCorp" });
  });

  it("round-trips through the persisted document", () => {
    const asset = makeAsset("stage", 8, 2, 5);
    const state = toFloorplanState([asset], DEFAULT_VENUE);
    const parsed = parseFloorplanState(JSON.parse(JSON.stringify(state)));
    expect(parsed.venue).toEqual(DEFAULT_VENUE);
    expect(parsed.assets[0].kind).toBe("stage");
    expect(parsed.assets[0].assignment).toBeNull();
  });

  it("never throws on corrupt or missing saved data", () => {
    expect(() => parseFloorplanState(null)).not.toThrow();
    expect(() => parseFloorplanState("garbage")).not.toThrow();
    expect(parseFloorplanState(undefined).assets).toEqual([]);
  });
});

describe("accessibility POIs (#4420 venue JSON)", () => {
  it("creates POIs with display defaults per kind", () => {
    const ramp = makePoi("ramp", 20, 2, 0);
    expect(ramp.id).toMatch(/^poi_/);
    expect(ramp.label).toBe(POI_DEFAULTS.ramp.label);
    expect(POI_DEFAULTS.stairs.accessible).toBe(false);
    expect(POI_DEFAULTS.ramp.color).toBe("#2563eb"); // bright blue highlight
  });

  it("round-trips accessibility_pois through the persisted document", () => {
    const poi = makePoi("elevator", 4, 30, 1);
    const venue = { ...DEFAULT_VENUE, accessibility_pois: [poi] };
    const state = toFloorplanState([makeAsset("stage", 8, 2, 5)], venue);
    const parsed = parseFloorplanState(JSON.parse(JSON.stringify(state)));
    expect(parsed.venue.accessibility_pois).toEqual([poi]);
  });

  it("drops malformed POI entries instead of throwing", () => {
    const pois = parseAccessibilityPois([
      { id: "ok", kind: "ramp", label: "Ramp", x_ft: 3, y_ft: 4 },
      { kind: "jetpack", label: "Nope", x_ft: 0, y_ft: 0 },
      "junk",
      null,
      { id: "no-coords", kind: "stairs" },
    ]);
    expect(pois).toHaveLength(2);
    expect(pois[0].kind).toBe("ramp");
    expect(pois[1].kind).toBe("stairs");
    expect(pois[1].x_ft).toBe(0); // defaulted, not NaN
  });

  it("defaults old documents to an empty POI list", () => {
    const legacy = parseFloorplanState({
      assets: [],
      venue: { width_ft: 50, height_ft: 40, fire_exits: [] },
    });
    expect(legacy.venue.accessibility_pois).toEqual([]);
  });
});

describe("attendee location descriptions", () => {
  it("names the quadrant of an asset", () => {
    // Top-left area of a 100x60 venue -> northwest
    expect(describeLocation({ x: 2, y: 2, width: 6, height: 3 }, DEFAULT_VENUE)).toBe(
      "Northwest corner",
    );
    // Bottom-right -> southeast
    expect(describeLocation({ x: 90, y: 52, width: 6, height: 3 }, DEFAULT_VENUE)).toBe(
      "Southeast corner",
    );
    // Dead center -> central
    expect(describeLocation({ x: 47, y: 28, width: 6, height: 4 }, DEFAULT_VENUE)).toBe(
      "Central area",
    );
  });

  it("builds the attendee sentence with the sponsor name", () => {
    const assigned = {
      ...makeAsset("rect_table", 2, 2, 11),
      label: "Table 12",
      assignment: { sponsorId: "42", companyName: "TacoCorp" },
    };
    expect(describeAssignment(assigned, DEFAULT_VENUE)).toBe(
      "TacoCorp is at Table 12 in the Northwest corner.",
    );
  });

  it("falls back to the table label when unassigned", () => {
    const plain = { ...makeAsset("rect_table", 47, 28, 12), label: "Rect Table 13" };
    expect(describeAssignment(plain, DEFAULT_VENUE)).toBe("Rect Table 13 is in the Central area.");
  });
});
