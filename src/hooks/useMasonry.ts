import { useMemo } from "react";

export interface MasonryItem {
  id: string;
  url: string;
  width: number;
  height: number;
  caption?: string;
}

export function calculateMasonry<T extends MasonryItem>(
  items: T[],
  columnsCount: number = 3,
): T[][] {
  const columns: T[][] = Array.from({ length: columnsCount }, () => []);
  const columnHeights: number[] = Array.from({ length: columnsCount }, () => 0);

  for (const item of items) {
    // Find the currently shortest column
    let shortestColumnIndex = 0;
    let minHeight = columnHeights[0];

    for (let i = 1; i < columnsCount; i++) {
      if (columnHeights[i] < minHeight) {
        minHeight = columnHeights[i];
        shortestColumnIndex = i;
      }
    }

    // Calculate aspect ratio aspect = height / width
    const aspectRatio = item.width > 0 ? item.height / item.width : 1;

    columns[shortestColumnIndex].push(item);
    columnHeights[shortestColumnIndex] += aspectRatio;
  }

  return columns;
}

export function useMasonry<T extends MasonryItem>(items: T[], columnsCount: number = 3): T[][] {
  return useMemo(() => calculateMasonry(items, columnsCount), [items, columnsCount]);
}
