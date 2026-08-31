import { describe, expect, it } from "vitest";
import {
  SENSORY_ALERT_MESSAGE,
  SENSORY_DB_THRESHOLD,
  buildQuietRoomPolyline,
  estimateZonePoint,
  isQuietSpaceNode,
  nodeCenter,
  quietRoomRoutePath,
  shouldTriggerSensoryAlert,
  updateSustainedLoudWindow,
} from "./quietRoomLocator";

describe("quiet room locator (#4729)", () => {
  it("triggers a sensory alert after 90dB is sustained for 5 minutes", () => {
    const t0 = 1_000_000;
    let windowStart = updateSustainedLoudWindow(null, 91, t0);
    windowStart = updateSustainedLoudWindow(windowStart, 95, t0 + 60_000);
    expect(shouldTriggerSensoryAlert(windowStart, t0 + 4 * 60_000)).toBe(false);
    expect(shouldTriggerSensoryAlert(windowStart, t0 + 5 * 60_000)).toBe(true);
    expect(SENSORY_DB_THRESHOLD).toBe(90);
  });

  it("resets the loud window when audio drops to 90dB or below", () => {
    const t0 = 1_000_000;
    const windowStart = updateSustainedLoudWindow(null, 94, t0);
    expect(updateSustainedLoudWindow(windowStart, 90, t0 + 60_000)).toBeNull();
  });

  it("plots a polyline from the estimated zone to the Quiet_Space node", () => {
    const quiet = {
      type: "Quiet_Space",
      entity_name: "Quiet Room",
      x_coord: 80,
      y_coord: 10,
      width: 10,
      height: 10,
    };
    expect(isQuietSpaceNode(quiet)).toBe(true);
    const from = estimateZonePoint([
      { id: "z1", name: "Main Hall", x_ft: 0, y_ft: 0, width_ft: 50, height_ft: 30 },
    ]);
    const to = nodeCenter(quiet);
    expect(buildQuietRoomPolyline(from, to)).toBe(`${from.x},${from.y} ${to.x},${to.y}`);
    expect(quietRoomRoutePath("evt-1")).toBe("/events/evt-1?quietRoute=1");
    expect(SENSORY_ALERT_MESSAGE).toMatch(/Click here for routing to the Quiet Room/);
  });
});
