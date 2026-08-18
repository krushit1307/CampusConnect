import { describe, it, expect } from "vitest";
import {
  isValid3DModelUrl,
  detectModelFormat,
  calculateTableCapacityFit,
  generateTableGridPrimitives,
} from "./venue3DViewer";

describe("Venue 3D Model Viewer Utility (#3447)", () => {
  it("validates standard 3D web model URLs (.gltf, .glb, .obj)", () => {
    expect(isValid3DModelUrl("https://cdn.campus.edu/models/ballroom.gltf")).toBe(true);
    expect(isValid3DModelUrl("https://cdn.campus.edu/models/hall.glb")).toBe(true);
    expect(isValid3DModelUrl("https://cdn.campus.edu/models/stage.obj")).toBe(true);
    expect(isValid3DModelUrl("https://cdn.campus.edu/images/floorplan.png")).toBe(false);
    expect(isValid3DModelUrl(null)).toBe(false);
  });

  it("detects 3D model formats correctly from extension", () => {
    expect(detectModelFormat("model.glb")).toBe("glb");
    expect(detectModelFormat("model.obj")).toBe("obj");
    expect(detectModelFormat("model.gltf")).toBe("gltf");
    expect(detectModelFormat(null)).toBe("primitive");
  });

  it("calculates ballroom circular table capacity fit", () => {
    // 30m x 20m ballroom with 1.8m tables + 1.2m aisles (3m spacing)
    const fit = calculateTableCapacityFit(30, 20, 1.8, 1.2);

    expect(fit.columns).toBe(10);
    expect(fit.rows).toBe(6);
    expect(fit.maxTables).toBe(60); // 10 x 6 = 60 tables
    expect(fit.maxGuests).toBe(480); // 60 x 8 guests
  });

  it("generates grid of 3D table primitives for spatial layout testing", () => {
    const tables = generateTableGridPrimitives(12, 30, 20);

    expect(tables).toHaveLength(12);
    expect(tables[0].label).toBe("Table #1");
    expect(tables[0].type).toBe("round_table");
  });
});
