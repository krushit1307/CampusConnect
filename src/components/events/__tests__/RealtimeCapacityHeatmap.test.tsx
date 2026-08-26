// src/components/events/__tests__/RealtimeCapacityHeatmap.test.tsx
import { describe, it, expect, vi } from "vitest";
import { getHeatmapColor } from "../../../services/roomCapacityService";

vi.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  }),
}));

describe("RealtimeCapacityHeatmap & getHeatmapColor", () => {
  it("calculates light blue for empty room (<25%)", () => {
    expect(getHeatmapColor(10, 100)).toBe("#e0f2fe");
  });

  it("calculates blue for low density room (25%-50%)", () => {
    expect(getHeatmapColor(35, 100)).toBe("#3b82f6");
  });

  it("calculates amber for moderate density room (50%-75%)", () => {
    expect(getHeatmapColor(60, 100)).toBe("#f59e0b");
  });

  it("calculates orange for dense room (75%-94%)", () => {
    expect(getHeatmapColor(85, 100)).toBe("#f97316");
  });

  it("calculates red for bottleneck over-capacity room (>=95%)", () => {
    expect(getHeatmapColor(96, 100)).toBe("#ef4444");
  });
});
