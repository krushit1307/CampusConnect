import { useState, useRef, useMemo, useEffect, useCallback } from "react";

export interface VirtualGridItem<T> {
  item: T;
  index: number;
  top: number;
  left: number;
  width: number;
  height: number;
  column: number;
}

export interface UseVirtualGridOptions<T> {
  items: T[];
  columnWidth: number;
  gap: number;
  overscan?: number;
  estimateHeight: (item: T, index: number) => number;
}

export interface UseVirtualGridResult<T> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  visibleItems: VirtualGridItem<T>[];
  totalHeight: number;
  columnCount: number;
  gap: number;
  measureItem: (index: number, height: number) => void;
}

export function useVirtualGrid<T>({
  items,
  columnWidth,
  gap,
  overscan = 3,
  estimateHeight,
}: UseVirtualGridOptions<T>): UseVirtualGridResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(600);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [measuredHeights, setMeasuredHeights] = useState<Record<number, number>>({});

  const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (columnWidth + gap)));

  const effectiveHeight = useCallback(
    (item: T, index: number): number => {
      return measuredHeights[index] ?? estimateHeight(item, index);
    },
    [measuredHeights, estimateHeight],
  );

  const layout = useMemo(() => {
    const columnHeights = new Array(columnCount).fill(0);
    return items.map((item, index) => {
      const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const top = columnHeights[shortestColumn];
      const height = effectiveHeight(item, index);
      columnHeights[shortestColumn] = top + height + gap;
      return {
        item,
        index,
        top,
        left: shortestColumn * (columnWidth + gap),
        width: columnWidth,
        height,
        column: shortestColumn,
      };
    });
  }, [items, columnCount, columnWidth, gap, effectiveHeight]);

  const totalHeight = layout.length ? Math.max(0, ...layout.map((l) => l.top + l.height)) : 0;

  const visibleItems = useMemo(() => {
    const buffer = overscan * (columnWidth + gap);
    const from = Math.max(0, scrollTop - buffer);
    const to = scrollTop + viewportHeight + buffer;
    return layout.filter((item) => item.top + item.height >= from && item.top <= to);
  }, [layout, scrollTop, viewportHeight, overscan, columnWidth, gap]);

  const measureItem = useCallback((index: number, height: number) => {
    setMeasuredHeights((prev) => {
      if (prev[index] === height) return prev;
      return { ...prev, [index]: height };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setViewportHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);
    el.addEventListener("scroll", handleScroll, { passive: true });

    setScrollTop(el.scrollTop);
    setContainerWidth(el.clientWidth);
    setViewportHeight(el.clientHeight);

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return {
    containerRef,
    visibleItems,
    totalHeight,
    columnCount,
    gap,
    measureItem,
  };
}
