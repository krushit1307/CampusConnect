import { describe, it, expect } from "vitest";
import {
  spawnCrowdParticles,
  stepEvacuationSimulation,
  EvacuationSimulationConfig,
  ExitNode,
} from "./evacuationSimulator";

describe("Build Interactive Event Layout Evacuation Bottleneck Simulator Suite (#4815)", () => {
  const sampleExits: ExitNode[] = [
    { id: "door_main_3ft", x: 100, y: 0, widthFeet: 3, maxThroughputPerSec: 6 },
    { id: "door_side_6ft", x: 0, y: 100, widthFeet: 6, maxThroughputPerSec: 12 },
  ];

  const sampleConfig: EvacuationSimulationConfig = {
    maxCapacity: 100,
    roomBounds: { width: 200, height: 200 },
    exits: sampleExits,
  };

  it("spawns particles equal to max_capacity within room boundaries", () => {
    const particles = spawnCrowdParticles(sampleConfig);

    expect(particles.length).toBe(100);
    expect(particles.every((p) => p.position.x >= 0 && p.position.x <= 200)).toBe(true);
    expect(particles.every((p) => !p.isEvacuated)).toBe(true);
  });

  it("detects CRITICAL BOTTLENECK when exit doorway density exceeds threshold", () => {
    // 60 particles queued right next to the 3-foot doorway (Density = 60 / 3 = 20 persons/ft >= 15.0 threshold)
    const congestedParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      position: { x: 100, y: 10 },
      targetExitId: "door_main_3ft",
      speed: 1.0,
      isEvacuated: false,
    }));

    const { stepMetrics } = stepEvacuationSimulation(congestedParticles, sampleExits);

    expect(stepMetrics.criticalBottlenecks).toContain("door_main_3ft");
    expect(stepMetrics.bottleneckDensities["door_main_3ft"]).toBe(20.0);
  });

  it("evacuates particles when they reach exit node coordinates", () => {
    const nearExitParticles = [
      {
        id: 1,
        position: { x: 99, y: 1 }, // 1.4 units from exit (100, 0)
        targetExitId: "door_main_3ft",
        speed: 3.0,
        isEvacuated: false,
      },
    ];

    const { updatedParticles, stepMetrics } = stepEvacuationSimulation(
      nearExitParticles,
      sampleExits,
    );

    expect(updatedParticles[0].isEvacuated).toBe(true);
    expect(stepMetrics.evacuatedCount).toBe(1);
    expect(stepMetrics.activeParticlesCount).toBe(0);
    expect(stepMetrics.isSimulationComplete).toBe(true);
  });
});
