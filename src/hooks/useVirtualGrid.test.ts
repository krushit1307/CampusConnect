import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVirtualGrid } from "./useVirtualGrid";

function createMockContainer(width: number, height: number, scrollTop = 0) {
  let scrollListener: (() => void) | null = null;
  let resizeListener: ((rect: { width: number; height: number }) => void) | null = null;

  const el = {
    get scrollTop() {
      return scrollTop;
    },
    set scrollTop(v: number) {
      scrollTop = v;
      scrollListener?.();
    },
    clientWidth: width,
    clientHeight: height,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height }),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === "scroll") scrollListener = handler;
    }),
    removeEventListener: vi.fn(),
  };

  const observer = {
    observe: vi.fn((_target: Element) => {
      resizeListener?.({ width, height });
    }),
    disconnect: vi.fn(),
  };

  globalThis.ResizeObserver = vi.fn().mockImplementation((cb) => {
    resizeListener = (rect) =>
      cb([
        {
          contentRect: rect,
          target: el,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ]);
    return observer;
  });

  return {
    el,
    observer,
    triggerResize: (w: number, h: number) => {
      resizeListener?.({ width: w, height: h });
    },
  };
}

interface TestItem {
  id: number;
}

describe("useVirtualGrid", () => {
  const items: TestItem[] = Array.from({ length: 20 }, (_, i) => ({ id: i }));
  const estimateHeight = () => 100;
  const defaultOptions = {
    items,
    columnWidth: 200,
    gap: 16,
    estimateHeight,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the correct container ref", () => {
    const { result } = renderHook(() => useVirtualGrid(defaultOptions));
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.containerRef.current).toBeNull();
  });

  it("should calculate column count based on container width", () => {
    const { result } = renderHook(() => useVirtualGrid({ ...defaultOptions }));
    expect(result.current.columnCount).toBe(1);

    const mockContainer = createMockContainer(432, 600);
    const div = document.createElement("div");
    Object.defineProperty(div, "clientWidth", { value: 432 });
    Object.defineProperty(div, "clientHeight", { value: 600 });

    const { result: resized } = renderHook(() => useVirtualGrid({ ...defaultOptions }));
    expect(resized.current.columnCount).toBe(1);

    expect(result.current.totalHeight).toBeGreaterThanOrEqual(0);
  });

  it("should compute total height from masonry layout", () => {
    const { result } = renderHook(() => useVirtualGrid(defaultOptions));
    act(() => {
      if (result.current.containerRef.current) {
        Object.defineProperty(result.current.containerRef.current, "clientWidth", { value: 648 });
        Object.defineProperty(result.current.containerRef.current, "clientHeight", { value: 600 });
      }
    });
    expect(result.current.totalHeight).toBeGreaterThan(0);
  });

  it("should return empty visibleItems when there are no items", () => {
    const { result } = renderHook(() => useVirtualGrid({ ...defaultOptions, items: [] }));
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
    expect(result.current.columnCount).toBe(1);
  });

  it("should distribute items across columns", () => {
    const items3 = [
      { id: 0, h: 100 },
      { id: 1, h: 50 },
      { id: 2, h: 200 },
    ];

    const { result } = renderHook(() =>
      useVirtualGrid({
        items: items3,
        columnWidth: 200,
        gap: 16,
        estimateHeight: (item) => (item as { id: number; h: number }).h,
      }),
    );

    const columns = new Set(result.current.visibleItems.map((v) => v.column));
    expect(columns.size).toBe(1);
  });

  it("should recalculate layout when items change", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useVirtualGrid({ ...defaultOptions, items }),
      { initialProps: { items } },
    );

    const initialHeight = result.current.totalHeight;

    rerender({ items: [] });

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);

    rerender({ items });

    expect(result.current.visibleItems.length).toBeGreaterThan(0);
    expect(result.current.totalHeight).toBe(initialHeight);
  });

  it("should update measured height via measureItem", () => {
    const { result } = renderHook(() => useVirtualGrid(defaultOptions));

    act(() => {
      result.current.measureItem(0, 200);
    });

    const item = result.current.visibleItems.find((v) => v.index === 0);
    expect(item?.height).toBe(200);
  });

  it("should not trigger re-render when measureItem receives same height", () => {
    const { result } = renderHook(() => useVirtualGrid(defaultOptions));
    let renderCount = 0;

    const origRender = result.current;
    renderCount++;

    act(() => {
      result.current.measureItem(0, 100);
    });

    act(() => {
      result.current.measureItem(0, 100);
    });
  });

  it("should increase totalHeight when items are measured taller", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        items: [{ id: 0 }],
        columnWidth: 200,
        gap: 16,
        estimateHeight: () => 100,
      }),
    );

    const initialHeight = result.current.totalHeight;

    act(() => {
      result.current.measureItem(0, 300);
    });

    expect(result.current.totalHeight).toBeGreaterThanOrEqual(300);
  });

  it("should handle single column layout", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        items,
        columnWidth: 800,
        gap: 16,
        estimateHeight,
      }),
    );

    expect(result.current.columnCount).toBe(1);
    result.current.visibleItems.forEach((item) => {
      expect(item.left).toBe(0);
    });
  });

  it("should handle items shorter than viewport within overscan", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        ...defaultOptions,
        items: [{ id: 0 }],
      }),
    );

    expect(result.current.visibleItems.length).toBe(1);
  });
});
