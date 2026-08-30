import { describe, expect, it } from "vitest";
import {
  LAYOUT_HEATMAP_DEEP_RED,
  buildCampusSecurityRestrictMessage,
  getLayoutHeatmapFill,
  isZoneAtRestrictThreshold,
  zoneCheckInAppTitle,
} from "./eventLayoutHeatmap";

describe("event layout heatmap (#4722)", () => {
  it("titles distinct bouncer apps as Zone A Check-in / Zone B Check-in", () => {
    expect(zoneCheckInAppTitle("Zone A")).toBe("Zone A Check-in");
    expect(zoneCheckInAppTitle("Zone B")).toBe("Zone B Check-in");
  });

  it("turns a zone deep red at 95% capacity", () => {
    expect(isZoneAtRestrictThreshold(94, 100)).toBe(false);
    expect(isZoneAtRestrictThreshold(95, 100)).toBe(true);
    expect(getLayoutHeatmapFill(95, 100)).toBe(LAYOUT_HEATMAP_DEEP_RED);
    expect(getLayoutHeatmapFill(10, 100)).not.toBe(LAYOUT_HEATMAP_DEEP_RED);
  });

  it("asks Campus Security to restrict the specific corridor", () => {
    expect(buildCampusSecurityRestrictMessage("Zone A", "Zone A corridor")).toBe(
      "Restrict access to the Zone A corridor. Zone A has reached 95% capacity.",
    );
  });
});
