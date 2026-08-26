import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getRippleGeometry, useRipple } from "./useRipple";

const RECT = { left: 10, top: 10, width: 100, height: 50 };

function makeTarget(rect = RECT): HTMLElement {
  return { getBoundingClientRect: () => rect } as unknown as HTMLElement;
}

describe("getRippleGeometry (#2395)", () => {
  it("spawns the ripple at the exact click point inside the button", () => {
    // Click at the button's top-left corner -> relative (0, 0).
    const { left, top, size } = getRippleGeometry(10, 10, RECT);
    expect(left).toBeCloseTo(-111.8, 1);
    expect(top).toBeCloseTo(-111.8, 1);
    expect(size).toBeCloseTo(223.6, 1);
  });

  it("spawns from the center when coordinates are missing (keyboard)", () => {
    // Keyboard activation reports clientX/clientY as 0.
    const { left, top, size } = getRippleGeometry(0, 0, RECT);
    expect(left).toBeCloseTo(-5.9, 1);
    expect(top).toBeCloseTo(-30.9, 1);
    expect(size).toBeCloseTo(111.8, 1);
  });

  it("sizes the ripple so it covers the whole button from a corner click", () => {
    const { left, top, size } = getRippleGeometry(10, 10, RECT);
    expect(left).toBeLessThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(0);
    expect(left + size).toBeGreaterThanOrEqual(RECT.width);
    expect(top + size).toBeGreaterThanOrEqual(RECT.height);
  });
});

describe("useRipple", () => {
  it("adds a ripple from a pointer event", () => {
    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.addRipple({ clientX: 10, clientY: 10, currentTarget: makeTarget() });
    });
    expect(result.current.ripples).toHaveLength(1);
    expect(result.current.ripples[0].size).toBeCloseTo(223.6, 1);
  });

  it("supports rapid multi-clicks as distinct ripples", () => {
    const { result } = renderHook(() => useRipple());
    const target = makeTarget();
    act(() => {
      result.current.addRipple({ clientX: 10, clientY: 10, currentTarget: target });
      result.current.addRipple({ clientX: 60, clientY: 30, currentTarget: target });
      result.current.addRipple({ clientX: 110, clientY: 60, currentTarget: target });
    });
    expect(result.current.ripples).toHaveLength(3);
    const ids = result.current.ripples.map((ripple) => ripple.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("removes a ripple by id", () => {
    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.addRipple({ clientX: 10, clientY: 10, currentTarget: makeTarget() });
    });
    const id = result.current.ripples[0].id;
    act(() => {
      result.current.removeRipple(id);
    });
    expect(result.current.ripples).toHaveLength(0);
  });
});
