import { describe, expect, it } from "vitest";
import {
  normalizeBackgroundCheckStatus,
  requiresLeadershipBackgroundCheck,
  shouldGrantLeadershipRole,
  shouldRouteToManualReview,
} from "./clubLeadershipBackgroundCheck";

describe("club leadership background-check policy", () => {
  it("gates only the high-minors risk level", () => {
    expect(requiresLeadershipBackgroundCheck("High_Minors")).toBe(true);
    expect(requiresLeadershipBackgroundCheck("Standard")).toBe(false);
    expect(requiresLeadershipBackgroundCheck(undefined)).toBe(false);
  });

  it("grants a role only after a clear provider result", () => {
    expect(shouldGrantLeadershipRole("clear")).toBe(true);
    expect(shouldGrantLeadershipRole("consider")).toBe(false);
    expect(shouldGrantLeadershipRole("pending")).toBe(false);
  });

  it("routes consider results to manual review", () => {
    expect(shouldRouteToManualReview(normalizeBackgroundCheckStatus("consider"))).toBe(true);
    expect(shouldRouteToManualReview(normalizeBackgroundCheckStatus("clear"))).toBe(false);
    expect(normalizeBackgroundCheckStatus("pre_adverse_action")).toBe("consider");
    expect(normalizeBackgroundCheckStatus("unexpected")).toBe("failed");
  });
});
