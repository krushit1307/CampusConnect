import { describe, it, expect } from "vitest";
import {
  vecAdd,
  vecSub,
  vecScale,
  vecDot,
  vecCross,
  vecLength,
  vecNormalize,
  vecDist,
  vecReflect,
  vecRotate,
  alignConeRay,
  getSpeedOfSound,
  intersectRoom,
  AcousticRayTracer,
} from "./acousticRayTracer";
import { AcousticWallConfig, AcousticSpeakerConfig, Vector3D } from "../types/acoustic";

describe("Acoustic Ray Tracer - Vector Mathematics", () => {
  it("performs basic 3D vector arithmetic correctly", () => {
    const v1 = { x: 1, y: 2, z: 3 };
    const v2 = { x: 4, y: 5, z: 6 };

    expect(vecAdd(v1, v2)).toEqual({ x: 5, y: 7, z: 9 });
    expect(vecSub(v2, v1)).toEqual({ x: 3, y: 3, z: 3 });
    expect(vecScale(v1, 3)).toEqual({ x: 3, y: 6, z: 9 });
  });

  it("calculates dot and cross products accurately", () => {
    const v1 = { x: 1, y: 0, z: 0 };
    const v2 = { x: 0, y: 1, z: 0 };

    expect(vecDot(v1, v2)).toBe(0);
    expect(vecDot(v1, v1)).toBe(1);

    expect(vecCross(v1, v2)).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("computes vector lengths and normals correctly", () => {
    const v = { x: 3, y: 4, z: 0 };
    expect(vecLength(v)).toBe(5);
    const normalized = vecNormalize(v);
    expect(normalized.x).toBeCloseTo(0.6);
    expect(normalized.y).toBeCloseTo(0.8);
    expect(normalized.z).toBeCloseTo(0);

    const zero = { x: 0, y: 0, z: 0 };
    expect(vecNormalize(zero)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("measures Euclidean distance between 3D points", () => {
    const p1 = { x: 0, y: 0, z: 0 };
    const p2 = { x: 1, y: 2, z: 2 };
    expect(vecDist(p1, p2)).toBe(3);
  });

  it("calculates specular reflection vectors correctly", () => {
    const incident = { x: 1, y: -1, z: 0 };
    const normal = { x: 0, y: 1, z: 0 }; // floor normal
    expect(vecReflect(incident, normal)).toEqual({ x: 1, y: 1, z: 0 });
  });

  it("rotates vector around axis correctly", () => {
    const v = { x: 1, y: 0, z: 0 };
    const axis = { x: 0, y: 0, z: 1 };
    const angle = Math.PI / 2; // 90 degrees
    const rotated = vecRotate(v, axis, angle);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
    expect(rotated.z).toBeCloseTo(0);
  });

  it("aligns cone rays correctly to target direction", () => {
    const ray = { x: 0.1, y: 0.2, z: 0.9 };
    const dir = { x: 0, y: 1, z: 0 };
    const aligned = alignConeRay(ray, dir);
    expect(vecDot(aligned, dir)).toBeGreaterThan(0.8);
  });
});

describe("Acoustic Ray Tracer - Physics & Geometry", () => {
  it("calculates speed of sound depending on temperature", () => {
    expect(getSpeedOfSound(20)).toBeCloseTo(343.42);
    expect(getSpeedOfSound(0)).toBeCloseTo(331.3);
    expect(getSpeedOfSound(30)).toBe(349.48);
  });

  it("detects intersections and normals on all 6 walls of a room", () => {
    const w = 10;
    const d = 10;
    const h = 5;
    const center = { x: 0, y: 2.5, z: 0 };

    // 1. Ray heading Left (towards X = -5)
    const rayLeft = intersectRoom(center, { x: -1, y: 0, z: 0 }, w, d, h);
    expect(rayLeft).not.toBeNull();
    expect(rayLeft?.wallType).toBe("left");
    expect(rayLeft?.point.x).toBe(-5);
    expect(rayLeft?.normal).toEqual({ x: 1, y: 0, z: 0 });

    // 2. Ray heading Right (towards X = 5)
    const rayRight = intersectRoom(center, { x: 1, y: 0, z: 0 }, w, d, h);
    expect(rayRight).not.toBeNull();
    expect(rayRight?.wallType).toBe("right");
    expect(rayRight?.point.x).toBe(5);
    expect(rayRight?.normal).toEqual({ x: -1, y: 0, z: 0 });

    // 3. Ray heading Down (towards Y = 0)
    const rayFloor = intersectRoom(center, { x: 0, y: -1, z: 0 }, w, d, h);
    expect(rayFloor).not.toBeNull();
    expect(rayFloor?.wallType).toBe("floor");
    expect(rayFloor?.point.y).toBe(0);
    expect(rayFloor?.normal).toEqual({ x: 0, y: 1, z: 0 });

    // 4. Ray heading Up (towards Y = 5)
    const rayCeiling = intersectRoom(center, { x: 0, y: 1, z: 0 }, w, d, h);
    expect(rayCeiling).not.toBeNull();
    expect(rayCeiling?.wallType).toBe("ceiling");
    expect(rayCeiling?.point.y).toBe(5);
    expect(rayCeiling?.normal).toEqual({ x: 0, y: -1, z: 0 });

    // 5. Ray heading Back (towards Z = -5)
    const rayBack = intersectRoom(center, { x: 0, y: 0, z: -1 }, w, d, h);
    expect(rayBack).not.toBeNull();
    expect(rayBack?.wallType).toBe("back");
    expect(rayBack?.point.z).toBe(-5);
    expect(rayBack?.normal).toEqual({ x: 0, y: 0, z: 1 });

    // 6. Ray heading Front (towards Z = 5)
    const rayFront = intersectRoom(center, { x: 0, y: 0, z: 1 }, w, d, h);
    expect(rayFront).not.toBeNull();
    expect(rayFront?.wallType).toBe("front");
    expect(rayFront?.point.z).toBe(5);
    expect(rayFront?.normal).toEqual({ x: 0, y: 0, z: -1 });
  });
});

describe("Acoustic Ray Tracer - Simulation Engine", () => {
  const wallConfigs: AcousticWallConfig[] = [
    { type: "left", name: "Wall L", absorptionCoefficient: 0.1, materialPreset: "glass" },
    { type: "right", name: "Wall R", absorptionCoefficient: 0.1, materialPreset: "glass" },
    { type: "floor", name: "Floor", absorptionCoefficient: 0.15, materialPreset: "wood_panel" },
    { type: "ceiling", name: "Ceiling", absorptionCoefficient: 0.05, materialPreset: "concrete" },
    { type: "front", name: "Wall F", absorptionCoefficient: 0.08, materialPreset: "plaster" },
    { type: "back", name: "Wall B", absorptionCoefficient: 0.08, materialPreset: "plaster" },
  ];

  const speaker: AcousticSpeakerConfig = {
    id: "spk-1",
    label: "Main Speaker Left",
    x: 0,
    y: 2,
    z: -8,
    yaw: 0, // facing +Z (front wall)
    pitch: -10, // slightly down
    coneAngle: 90,
    dbOutput: 100,
  };

  it("generates the specified count of speaker rays within the cone angle limit", () => {
    const tracer = new AcousticRayTracer(30, 20, 6, wallConfigs);
    const rays = tracer.generateSpeakerRays(speaker, 150);

    expect(rays.length).toBe(150);
    expect(rays[0].points.length).toBe(1); // just origin
    expect(rays[0].origin).toEqual({ x: 0, y: 2, z: -8 });

    // verify cone alignment limit
    const radLimit = (90 * Math.PI) / 360; // 45 degrees
    const speakerDir = {
      x: 0,
      y: Math.sin((-10 * Math.PI) / 180),
      z: Math.cos((-10 * Math.PI) / 180),
    };
    rays.forEach((ray) => {
      const angle = Math.acos(vecDot(ray.direction, vecNormalize(speakerDir)));
      expect(angle).toBeLessThanOrEqual(radLimit + 1e-4);
    });
  });

  it("runs the full ray-tracing model and returns correct RT60 and power metrics", () => {
    const tracer = new AcousticRayTracer(30, 20, 6, wallConfigs);
    const results = tracer.runSimulation([speaker], 100, 3, 20, 50);

    expect(results.rt60SabineSeconds).toBeGreaterThan(0);
    expect(results.rt60RayTracedSeconds).toBeGreaterThan(0);
    expect(results.directEnergy).toBeGreaterThan(0);
    expect(results.reflectedEnergy).toBeGreaterThan(0);
    expect(results.directToReverberantRatioDb).not.toBeNaN();
    expect(results.rays.length).toBe(100);
  });

  it("detects flutter echoes if opposite walls are highly reflective", () => {
    const reflectiveWalls = wallConfigs.map((w) =>
      w.type === "left" || w.type === "right"
        ? { ...w, absorptionCoefficient: 0.02 } // highly reflective concrete
        : w,
    );

    const tracer = new AcousticRayTracer(30, 20, 6, reflectiveWalls);
    const results = tracer.runSimulation([speaker], 50, 2, 20, 50);

    expect(results.flutterEchoDetected).toBe(true);
    expect(results.actionableGuidance).toContain(
      "Prevent Flutter Echoes: Parallel reflective walls detected. Rotate the speaker array or place diffusion panels along side surfaces to scatter sound waves.",
    );
  });

  it("triggers severe warning when RT60 decay time is high", () => {
    const deadRoomWalls = wallConfigs.map((w) => ({
      ...w,
      absorptionCoefficient: 0.02, // glass/concrete echo chamber
    }));

    const tracer = new AcousticRayTracer(30, 20, 6, deadRoomWalls);
    const results = tracer.runSimulation([speaker], 100, 4, 20, 30);

    expect(results.warningSeverity).toBe("severe");
    expect(results.warningMessage).toContain("Severe Reverb Risk");
    expect(results.actionableGuidance.some((g) => g.includes("Apply Wall Damping"))).toBe(true);
  });
});
