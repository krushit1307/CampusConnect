import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { RippleButton } from "./RippleButton";

// Framed as a passthrough `span` so ripples render without a real animation
// environment in jsdom. Captures each `onAnimationComplete` so tests can
// simulate the animation finishing.
const mockAnimationCompletes: Array<() => void> = [];

vi.mock("framer-motion", () => ({
  motion: {
    span: ({ children, onAnimationComplete, ...props }: any) => {
      if (onAnimationComplete) {
        mockAnimationCompletes.push(onAnimationComplete);
      }
      const { initial, animate, transition, ...domProps } = props;
      return <span {...domProps}>{children}</span>;
    },
  },
}));

const RECT = {
  x: 10,
  y: 10,
  top: 10,
  left: 10,
  right: 110,
  bottom: 60,
  width: 100,
  height: 50,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  mockAnimationCompletes.length = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(RECT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RippleButton (#2395)", () => {
  it("renders children and forwards the onClick handler", () => {
    const onClick = vi.fn();
    render(<RippleButton onClick={onClick}>Save</RippleButton>);

    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("ripple-effect")).not.toBeInTheDocument();
  });

  it("spawns a ripple at the exact click point", () => {
    render(<RippleButton>Press</RippleButton>);
    const button = screen.getByRole("button", { name: "Press" });

    fireEvent.mouseDown(button, { clientX: 10, clientY: 10 });

    const ripple = screen.getByTestId("ripple-effect");
    expect(parseFloat(ripple.style.left)).toBeCloseTo(-111.8, 1);
    expect(parseFloat(ripple.style.top)).toBeCloseTo(-111.8, 1);
    expect(parseFloat(ripple.style.width)).toBeCloseTo(223.6, 1);
  });

  it("spawns three distinct overlapping ripples on rapid clicks", () => {
    render(<RippleButton>Press</RippleButton>);
    const button = screen.getByRole("button", { name: "Press" });

    fireEvent.mouseDown(button, { clientX: 10, clientY: 10 });
    fireEvent.mouseDown(button, { clientX: 60, clientY: 30 });
    fireEvent.mouseDown(button, { clientX: 110, clientY: 60 });

    expect(screen.getAllByTestId("ripple-effect")).toHaveLength(3);
  });

  it("spawns from the dead center for keyboard activation", () => {
    render(<RippleButton>Press</RippleButton>);
    const button = screen.getByRole("button", { name: "Press" });

    fireEvent.keyDown(button, { key: "Enter" });

    const ripple = screen.getByTestId("ripple-effect");
    // Button center is (50, 25); half-diagonal ripple is 55.9px.
    expect(parseFloat(ripple.style.left)).toBeCloseTo(-5.9, 1);
    expect(parseFloat(ripple.style.top)).toBeCloseTo(-30.9, 1);
  });

  it("does not spawn a ripple for non-activation keys", () => {
    render(<RippleButton>Press</RippleButton>);
    const button = screen.getByRole("button", { name: "Press" });

    fireEvent.keyDown(button, { key: "Tab" });

    expect(screen.queryByTestId("ripple-effect")).not.toBeInTheDocument();
  });

  it("removes the ripple from the DOM once the animation completes", () => {
    render(<RippleButton>Press</RippleButton>);
    const button = screen.getByRole("button", { name: "Press" });

    fireEvent.mouseDown(button, { clientX: 60, clientY: 30 });
    expect(screen.getAllByTestId("ripple-effect")).toHaveLength(1);

    act(() => {
      mockAnimationCompletes.forEach((complete) => complete());
    });

    expect(screen.queryByTestId("ripple-effect")).not.toBeInTheDocument();
  });
});
