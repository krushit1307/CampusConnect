import { describe, expect, it } from "vitest";
import {
  clampSlideIndex,
  isValidLaserPointerPayload,
  isValidSlideIndex,
  presentationChannelName,
} from "@/lib/eventPresentation";

describe("event presentation realtime protocol", () => {
  it("names channels per event", () => {
    expect(presentationChannelName("event-42")).toBe("event-presentation:event-42");
  });

  it("clamps navigation to the available slide range", () => {
    expect(clampSlideIndex(-4, 5)).toBe(0);
    expect(clampSlideIndex(2.9, 5)).toBe(2);
    expect(clampSlideIndex(99, 5)).toBe(4);
    expect(clampSlideIndex(2, 0)).toBe(0);
  });

  it("accepts only valid slide indices", () => {
    expect(isValidSlideIndex(0, 3)).toBe(true);
    expect(isValidSlideIndex(2, 3)).toBe(true);
    expect(isValidSlideIndex(3, 3)).toBe(false);
    expect(isValidSlideIndex(1.5, 3)).toBe(false);
    expect(isValidSlideIndex("1", 3)).toBe(false);
  });

  it("validates normalized laser-pointer coordinates", () => {
    expect(isValidLaserPointerPayload({ x: 0.2, y: 0.8, active: true })).toBe(true);
    expect(isValidLaserPointerPayload({ x: -0.1, y: 0.8, active: true })).toBe(false);
    expect(isValidLaserPointerPayload({ x: 0.2, y: 1.2, active: true })).toBe(false);
    expect(isValidLaserPointerPayload({ x: 0.2, y: 0.8, active: "yes" })).toBe(false);
  });
});
