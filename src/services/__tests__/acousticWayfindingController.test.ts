import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AcousticWayfindingController } from "../acousticWayfindingController";
import { LiDARSensorAdapter } from "@/lib/accessibility/lidarSensorAdapter";
import { LiDARObstacleDetector } from "../lidarObstacleDetector";

describe("AcousticWayfindingController", () => {
  let controller: AcousticWayfindingController;
  let adapter: LiDARSensorAdapter;
  let detector: LiDARObstacleDetector;

  beforeEach(() => {
    adapter = new LiDARSensorAdapter();
    detector = new LiDARObstacleDetector({
      immediateHazardDistanceMeters: 1.5,
      warningDistanceMeters: 3.0,
      minClusterPoints: 2,
    });

    controller = new AcousticWayfindingController(adapter, detector, {
      speechEnabled: false, // Disable actual speech synthesis in automated test environment
      hapticsEnabled: false,
      voiceCooldownMs: 100,
    });
  });

  afterEach(() => {
    controller.stopNavigation();
    vi.restoreAllMocks();
  });

  it("starts in idle unnavigating state", () => {
    const state = controller.getState();
    expect(state.isNavigating).toBe(false);
    expect(state.isLidarActive).toBe(false);
    expect(state.safetyOverrideActive).toBe(false);
    expect(state.activeObstacle).toBeNull();
  });

  it("activates LiDAR streaming when navigation starts", async () => {
    const started = await controller.startNavigation(
      "venue_main_hall",
      "Grand Main Auditorium",
      "Seat B-12",
    );

    expect(started).toBe(true);
    const state = controller.getState();
    expect(state.isNavigating).toBe(true);
    expect(state.isLidarActive).toBe(true);
    expect(state.currentVenueName).toBe("Grand Main Auditorium");
    expect(state.targetDestination).toBe("Seat B-12");
  });

  it("triggers safety override when immediate obstacle is injected", async () => {
    await controller.startNavigation("venue_1", "Audit Hall", "Stage Left");

    // Inject simulated obstacle at 1.0 meter (immediate hazard)
    controller.injectSimulatedObstacle(1.0, 0.4); // 0.4 right => recommend left

    // Wait for frame cycle to process
    await new Promise((r) => setTimeout(r, 200));

    const state = controller.getState();
    expect(state.activeObstacle).not.toBeNull();
    expect(state.hazardSeverity).toBe("immediate_hazard");
    expect(state.safetyOverrideActive).toBe(true);
    expect(state.activeObstacle?.recommendedDirection).toBe("left");
  });

  it("clears safety override when obstacle is removed", async () => {
    await controller.startNavigation("venue_1", "Audit Hall", "Stage Left");

    controller.injectSimulatedObstacle(1.0, 0.0);
    await new Promise((r) => setTimeout(r, 200));
    expect(controller.getState().safetyOverrideActive).toBe(true);

    // Clear obstacle
    controller.injectSimulatedObstacle(null);
    await new Promise((r) => setTimeout(r, 200));

    const state = controller.getState();
    expect(state.safetyOverrideActive).toBe(false);
    expect(state.activeObstacle).toBeNull();
    expect(state.hazardSeverity).toBe("none");
  });

  it("stops scanning and resets state cleanly on stopNavigation", async () => {
    await controller.startNavigation("venue_1", "Hall A", "Booth 5");
    controller.stopNavigation();

    const state = controller.getState();
    expect(state.isNavigating).toBe(false);
    expect(state.isLidarActive).toBe(false);
    expect(state.safetyOverrideActive).toBe(false);
    expect(state.activeObstacle).toBeNull();
  });
});
