import React, { useState, useRef, UIEvent } from "react";

interface VirtualListProps<T> {
  items: T[];
  height: number; // Viewport height in px
  itemHeight: number | ((index: number) => number); // Fixed or dynamic height handler
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Buffer nodes above and below viewport
  className?: string;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className = "",
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const getItemHeight = (index: number): number => {
    return typeof itemHeight === "function" ? itemHeight(index) : itemHeight;
  };

  const getItemOffset = (index: number): number => {
    if (typeof itemHeight === "number") {
      return index * itemHeight;
    }
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += itemHeight(i);
    }
    return offset;
  };

  const getTotalHeight = (): number => {
    if (typeof itemHeight === "number") {
      return items.length * itemHeight;
    }
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += itemHeight(i);
    }
    return total;
  };

  let startIndex = 0;
  let endIndex = 0;

  if (typeof itemHeight === "number") {
    startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    endIndex = Math.min(items.length - 1, Math.ceil((scrollTop + height) / itemHeight) + overscan);
  } else {
    let currentOffset = 0;
    let startFound = false;

    for (let i = 0; i < items.length; i++) {
      const h = getItemHeight(i);
      if (!startFound && currentOffset + h >= scrollTop) {
        startIndex = Math.max(0, i - overscan);
        startFound = true;
      }
      if (currentOffset > scrollTop + height) {
        endIndex = Math.min(items.length - 1, i + overscan);
        break;
      }
      currentOffset += h;
    }
    if (endIndex === 0) endIndex = items.length - 1;
  }

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      visibleItems.push({
        index: i,
        item: items[i],
        top: getItemOffset(i),
        height: getItemHeight(i),
      });
    }
  }

  const totalHeight = getTotalHeight();

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: `${height}px`,
        overflowY: "auto",
        position: "relative",
      }}
      className={className}
    >
      <div style={{ height: `${totalHeight}px`, width: "100%", position: "relative" }}>
        {visibleItems.map(({ index, item, top, height: rowHeight }) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: `${top}px`,
              left: 0,
              right: 0,
              height: `${rowHeight}px`,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
