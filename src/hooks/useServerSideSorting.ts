// =============================================================================
// Hook: useServerSideSorting
// Issue: #2453 - High-performance SortableTable with multi-column sorting
// Description: Manages the TanStack sorting state and triggers backend API
// fetches when the sorting changes. Includes debouncing to prevent spamming
// the database with ORDER BY queries on rapid clicks.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { SortingState } from "@tanstack/react-table";

interface UseServerSideSortingOptions {
  /**
   * The function to call when sorting changes.
   * Should trigger your API fetch with the new sort parameters.
   */
  onSortChange: (sorting: SortingState) => void;

  /**
   * Debounce delay in milliseconds. Default 300ms.
   */
  debounceMs?: number;
}

interface UseServerSideSortingReturn {
  sorting: SortingState;
  setSorting: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  isSorting: boolean;
}

export function useServerSideSorting({
  onSortChange,
  debounceMs = 300,
}: UseServerSideSortingOptions): UseServerSideSortingReturn {
  const [sorting, setSortingState] = useState<SortingState>([]);
  const [isSorting, setIsSorting] = useState(false);

  // Ref to hold the debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Wrapper for setSorting that handles the debounce logic
  const setSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSortingState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;

        // Clear any existing timer
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        // Set loading state immediately for UI feedback
        setIsSorting(true);

        // Debounce the actual API call
        debounceTimer.current = setTimeout(() => {
          onSortChange(next);
          // Reset loading state after a short delay to allow API to respond
          setTimeout(() => setIsSorting(false), 200);
        }, debounceMs);

        return next;
      });
    },
    [onSortChange, debounceMs],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  /**
   * Helper to convert TanStack SortingState into a backend-friendly format.
   * e.g., [{ id: 'role', desc: false }, { id: 'createdAt', desc: true }]
   * -> "role:asc,createdAt:desc"
   */
  const getSortQueryString = useCallback(() => {
    if (sorting.length === 0) return "";

    return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
  }, [sorting]);

  return {
    sorting,
    setSorting,
    isSorting,
    // getSortQueryString // Expose if needed by the parent component
  } as UseServerSideSortingReturn;
}
