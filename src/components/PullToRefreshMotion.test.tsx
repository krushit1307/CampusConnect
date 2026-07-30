import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { PullToRefreshMotion } from "./PullToRefreshMotion";

/**
 * Mock framer-motion so we don't need a real animation environment in jsdom.
 * The drag handlers stay reachable via pointerdown / pointerup, and the
 * `style.y` motion value is reflected as a data-y attribute on the rendered
 * element so tests can assert on the wrapper/indicator mirror contract.
 *
 * Also: useMotionValue is mocked to return a tiny in-memory store with a
 * `set` method, so we can drive the drag-end path deterministically.
 */
type MotionValue = {
  get: () => number;
  set: (v: number) => void;
  on: (event: string, cb: (v: number) => void) => () => void;
};

const motionStores: MotionValue[] = [];

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      onDragStart,
      onDragEnd,
      style,
      "data-testid": testId,
      // Strip framer-only props so they don't leak onto the underlying DOM.
      drag: _drag,
      dragConstraints: _dragConstraints,
      dragElastic: _dragElastic,
      dragMomentum: _dragMomentum,
      animate: _animate,
      ...rest
    }: {
      children?: React.ReactNode;
      onDragStart?: () => void;
      onDragEnd?: () => void;
      style?: React.CSSProperties & { y?: MotionValue };
      "data-testid"?: string;
      [k: string]: unknown;
    }) => (
      <div
        data-testid={testId}
        data-y={style?.y && typeof style.y.get === "function" ? style.y.get() : undefined}
        style={style as React.CSSProperties}
        onPointerDown={onDragStart as unknown as React.PointerEventHandler<HTMLDivElement>}
        onPointerUp={onDragEnd as unknown as React.PointerEventHandler<HTMLDivElement>}
        {...rest}
      >
        {children}
      </div>
    ),
  },
  useMotionValue: (initial: number): MotionValue => {
    let current = initial;
    const listeners = new Set<(v: number) => void>();
    const mv: MotionValue = {
      get: () => current,
      set: (v: number) => {
        current = v;
        listeners.forEach((l) => l(current));
      },
      on: (_event, cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    };
    motionStores.push(mv);
    return mv;
  },
  useAnimationControls: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  }),
  useTransform: (mv: MotionValue) => mv,
}));

// framer-motion typing is opaque to React's JSX; alias once for the mock
// above so this file compiles without dragging in the real package.
import type React from "react";

beforeEach(() => {
  // Reset scroll position before each test so the scrollY=0 contract holds.
  Object.defineProperty(window, "scrollY", { writable: true, value: 0 });
  Object.defineProperty(document.documentElement, "scrollTop", {
    writable: true,
    value: 0,
  });
  motionStores.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PullToRefreshMotion (issue #1917)", () => {
  it("renders children content", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()}>
        <div>Feed Content</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByText("Feed Content")).toBeInTheDocument();
  });

  it("shows the 'Pull to refresh' label by default and is not busy", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByText("Pull to refresh")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "false");
  });

  it("shows the 'Refreshing…' label and busy status when isRefreshing is true", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()} isRefreshing>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("ptr-state")).toHaveAttribute("data-state", "refreshing");
  });

  it("renders the drag wrapper and the indicator containers", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByTestId("ptr-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("ptr-indicator")).toBeInTheDocument();
  });

  it("uses the supplied refreshingRestY for the indicator container height", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()} refreshingRestY={72}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    const indicator = screen.getByTestId("ptr-indicator");
    const styleAttr = indicator.getAttribute("style") ?? "";
    expect(styleAttr).toContain("height: 72px");
  });

  it("wrapper and indicator share the same y motion store at rest", () => {
    render(
      <PullToRefreshMotion onRefresh={vi.fn()}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByTestId("ptr-wrapper").getAttribute("data-y")).toBe("0");
    expect(screen.getByTestId("ptr-indicator").getAttribute("data-y")).toBe("0");
  });

  it("falls back to 'Pull to refresh' when isRefreshing flips back to false", () => {
    const { rerender } = render(
      <PullToRefreshMotion onRefresh={vi.fn()} isRefreshing>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();

    rerender(
      <PullToRefreshMotion onRefresh={vi.fn()} isRefreshing={false}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );
    expect(screen.getByText("Pull to refresh")).toBeInTheDocument();
    expect(screen.queryByTestId("ptr-state")).not.toBeInTheDocument();
  });

  it("calls onRefresh when the user releases a drag past the activation threshold", () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefreshMotion onRefresh={onRefresh} activationThreshold={100}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );

    // useMotionValue is called twice in the component: once for `y` and
    // once via useTransform (which our mock returns the same store for).
    // We grab the wrapper's store (the first one) and push it past the
    // threshold, then fire pointerup to mimic the user releasing.
    expect(motionStores.length).toBeGreaterThanOrEqual(1);
    const yStore = motionStores[0];

    const wrapper = screen.getByTestId("ptr-wrapper");
    // Wrap in act() so React state updates fired by the y.on("change")
    // listeners (pastThreshold label) settle before assertions.
    act(() => {
      fireEvent.pointerDown(wrapper);
      yStore.set(120); // past the 100px threshold
      fireEvent.pointerUp(wrapper);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onRefresh when the drag release is below the activation threshold", () => {
    const onRefresh = vi.fn();
    render(
      <PullToRefreshMotion onRefresh={onRefresh} activationThreshold={100}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );

    const yStore = motionStores[0];
    const wrapper = screen.getByTestId("ptr-wrapper");
    act(() => {
      fireEvent.pointerDown(wrapper);
      yStore.set(40); // below threshold
      fireEvent.pointerUp(wrapper);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("disables drag mid-gesture if the user is not at the top of the page", () => {
    const onRefresh = vi.fn();
    Object.defineProperty(window, "scrollY", { writable: true, value: 200 });
    render(
      <PullToRefreshMotion onRefresh={onRefresh}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );

    const yStore = motionStores[0];
    const wrapper = screen.getByTestId("ptr-wrapper");
    act(() => {
      fireEvent.pointerDown(wrapper);
      yStore.set(150);
      fireEvent.pointerUp(wrapper);
    });

    // Spec edge case: mid-scroll pulls must not trigger refresh.
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("awaits a Promise-returning onRefresh and does not throw on rejection", async () => {
    // The refresh-failure branch in the component logs to console.error; spy
    // on it so the test output stays clean while still exercising the path.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRefresh = vi.fn().mockRejectedValue(new Error("network down"));
    render(
      <PullToRefreshMotion onRefresh={onRefresh} activationThreshold={100}>
        <div>Feed</div>
      </PullToRefreshMotion>,
    );

    const yStore = motionStores[0];
    const wrapper = screen.getByTestId("ptr-wrapper");
    act(() => {
      fireEvent.pointerDown(wrapper);
      yStore.set(120);
      fireEvent.pointerUp(wrapper);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // Let the rejection settle so the .catch() branch runs cleanly.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(errSpy).toHaveBeenCalled();
  });
});
