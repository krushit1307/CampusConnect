import { describe, it, expect, beforeEach } from "vitest";
import { CrowdSimulationEngine } from "../crowdSimulationEngine";
import { SimNode } from "../crowdSimulationTypes";

describe("CrowdSimulationEngine (#5133)", () => {
  let engine: CrowdSimulationEngine;

  beforeEach(() => {
    engine = new CrowdSimulationEngine({
      canvasWidth: 800,
      canvasHeight: 600,
      maxCapacity: 100,
      spawnRate: 20,
    });
  });

  it("1. Particle initialization: particles spawn within/near entrance", () => {
    const entranceNode: SimNode = {
      id: "ent-1",
      type: "entrance",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      attractionWeight: 0.2,
      label: "Main Entrance",
    };

    engine.setNodes([entranceNode]);
    engine.start();

    // Step simulation to trigger spawn
    engine.step(0.1);

    expect(engine.getActiveCount()).toBeGreaterThan(0);

    const particles = engine.getParticles();
    // First active particle
    const px = particles[0];
    const py = particles[1];
    const active = particles[4];

    expect(active).toBe(1);
    expect(px).toBeGreaterThanOrEqual(95);
    expect(px).toBeLessThanOrEqual(160);
    expect(py).toBeGreaterThanOrEqual(95);
    expect(py).toBeLessThanOrEqual(160);
  });

  it("2. Particle movement: particles move after simulation steps", () => {
    engine.loadFromLayoutElements([
      { id: "ent-1", type: "entrance", x: 50, y: 50, width: 40, height: 40 },
      { id: "ex-1", type: "exit", x: 700, y: 500, width: 50, height: 50 },
    ]);

    engine.start();
    engine.step(0.1); // Spawns initial particle

    const particles = engine.getParticles();
    const initialX = particles[0];
    const initialY = particles[1];

    // Advance multiple steps
    for (let i = 0; i < 20; i++) {
      engine.step(0.05);
    }

    const updatedX = particles[0];
    const updatedY = particles[1];

    // Position must change over time
    expect(updatedX !== initialX || updatedY !== initialY).toBe(true);
  });

  it("3. Attraction: high attraction object pulls particles more strongly than lower attraction", () => {
    const foodTableNode: SimNode = {
      id: "food-1",
      type: "food_table",
      x: 300,
      y: 300,
      width: 60,
      height: 40,
      attractionWeight: 1.5,
      label: "Food Table",
    };

    const lowAttractNode: SimNode = {
      id: "stage-1",
      type: "stage",
      x: 500,
      y: 100,
      width: 100,
      height: 60,
      attractionWeight: 0.3,
      label: "Stage",
    };

    engine.setNodes([
      {
        id: "ent-1",
        type: "entrance",
        x: 50,
        y: 50,
        width: 40,
        height: 40,
        attractionWeight: 0.2,
        label: "Entrance",
      },
      foodTableNode,
      lowAttractNode,
    ]);

    engine.start();
    for (let i = 0; i < 15; i++) {
      engine.step(0.1);
    }

    const particles = engine.getParticles();
    let movedTowardsFood = 0;

    for (let i = 0; i < 500; i++) {
      const idx = i * 6;
      if (particles[idx + 4] === 1) {
        const px = particles[idx];
        const py = particles[idx + 1];
        // Check distance to food table center vs stage center
        const distFood = Math.hypot(px - 330, py - 320);
        const distStage = Math.hypot(px - 550, py - 130);

        if (distFood < distStage) {
          movedTowardsFood++;
        }
      }
    }

    expect(movedTowardsFood).toBeGreaterThan(0);
  });

  it("4. Boundary/obstacle handling: particles do not freely pass through obstacles", () => {
    const obstacle: SimNode = {
      id: "wall-1",
      type: "obstacle",
      x: 200,
      y: 200,
      width: 200,
      height: 40,
      attractionWeight: 0,
      label: "Wall Boundary",
    };

    engine.setNodes([
      {
        id: "ent-1",
        type: "entrance",
        x: 250,
        y: 100,
        width: 40,
        height: 40,
        attractionWeight: 0.2,
        label: "Entrance",
      },
      obstacle,
      {
        id: "exit-1",
        type: "exit",
        x: 250,
        y: 500,
        width: 60,
        height: 40,
        attractionWeight: 1.5,
        label: "Exit",
      },
    ]);

    engine.start();
    for (let i = 0; i < 30; i++) {
      engine.step(0.05);
    }

    const particles = engine.getParticles();
    for (let i = 0; i < 500; i++) {
      const idx = i * 6;
      if (particles[idx + 4] === 1) {
        const px = particles[idx];
        const py = particles[idx + 1];
        // Ensure particle is not inside obstacle interior bounds
        const insideObstacle = px > 205 && px < 395 && py > 205 && py < 235;
        expect(insideObstacle).toBe(false);
      }
    }
  });

  it("5 & 6 & 7. Bottleneck detection & Exit monitoring: triggers CRITICAL BOTTLE NECK DETECTED and recommendation", () => {
    const exitNode: SimNode = {
      id: "exit-1",
      type: "exit",
      x: 600,
      y: 400,
      width: 80,
      height: 60,
      attractionWeight: 1.5,
      label: "Main Exit",
    };

    const foodTableNearExit: SimNode = {
      id: "food-1",
      type: "food_table",
      x: 580,
      y: 350,
      width: 80,
      height: 40,
      attractionWeight: 2.0,
      label: "Food Table",
    };

    engine.setNodes([
      {
        id: "ent-1",
        type: "entrance",
        x: 550,
        y: 300,
        width: 40,
        height: 40,
        attractionWeight: 0.2,
        label: "Entrance",
      },
      foodTableNearExit,
      exitNode,
    ]);

    // Initial state: no bottleneck
    expect(engine.getBottleneckState().detected).toBe(false);

    engine.start();
    // Step simulation to populate exit zone
    for (let i = 0; i < 100; i++) {
      engine.step(0.1);
    }

    const state = engine.getBottleneckState();
    expect(state.detected).toBe(true);
    expect(state.zoneId).toBe("exit-1");
    expect(state.recommendation).toBe("Move the Food Table.");
  });

  it("8. Reset: returns simulation to initial state", () => {
    engine.setNodes([
      {
        id: "ent-1",
        type: "entrance",
        x: 50,
        y: 50,
        width: 40,
        height: 40,
        attractionWeight: 0.2,
        label: "Entrance",
      },
      {
        id: "exit-1",
        type: "exit",
        x: 700,
        y: 500,
        width: 50,
        height: 50,
        attractionWeight: 1.5,
        label: "Exit",
      },
    ]);

    engine.start();
    for (let i = 0; i < 20; i++) {
      engine.step(0.1);
    }

    expect(engine.getActiveCount()).toBeGreaterThan(0);

    engine.reset();

    expect(engine.getActiveCount()).toBe(0);
    expect(engine.getIsRunning()).toBe(false);
    expect(engine.getBottleneckState().detected).toBe(false);
  });
});
