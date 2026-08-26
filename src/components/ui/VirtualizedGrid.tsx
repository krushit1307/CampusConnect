import React, { useRef, useState, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, style: React.CSSProperties, index: number) => React.ReactNode;
  itemHeight?: number;
  gap?: number;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  itemHeight = 280,
  gap = 24,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Measure container dimensions via ResizeObserver for dynamic column responsiveness
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(parent);
    setWidth(parent.clientWidth);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Compute number of columns dynamically based on container width
  const columnCount = useMemo(() => {
    if (width < 640) return 1; // mobile viewport width
    if (width < 1024) return 2; // tablet viewport width
    return 3; // desktop viewport width
  }, [width]);

  // Compute individual column widths accounting for grid gaps
  const columnWidth = useMemo(() => {
    const totalGapsWidth = gap * (columnCount - 1);
    return Math.max(0, (width - totalGapsWidth) / columnCount);
  }, [width, columnCount, gap]);

  const rowCount = Math.ceil(items.length / columnCount);

  // Horizontal and vertical calculations configured via row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="w-full h-[800px] overflow-y-auto border-2 border-black bg-cream p-4 shadow-[6px_6px_0_0_#000] relative"
      style={{
        contain: "strict",
      }}
      data-testid="virtualized-grid-container"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startItemIndex = rowIndex * columnCount;

          const columnsToRender = [];
          for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            const itemIndex = startItemIndex + colIndex;
            if (itemIndex < items.length) {
              columnsToRender.push({ colIndex, itemIndex });
            }
          }

          return columnsToRender.map(({ colIndex, itemIndex }) => {
            const item = items[itemIndex];
            const posX = colIndex * (columnWidth + gap);
            const posY = virtualRow.start;

            const itemStyle: React.CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              width: `${columnWidth}px`,
              height: `${itemHeight}px`,
              transform: `translate3d(${posX}px, ${posY}px, 0)`,
            };

            return (
              <div key={itemIndex} style={itemStyle} data-testid={`virtual-grid-item-${itemIndex}`}>
                {renderItem(item, { height: "100%", width: "100%" }, itemIndex)}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
