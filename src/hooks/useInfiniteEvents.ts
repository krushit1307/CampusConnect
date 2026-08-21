// =============================================================================
// Hook: useInfiniteEvents (TanStack Query + Keyset Pagination)
// Issue: #2734 - Implement Data Pagination using Keyset Pagination (Cursor-based)
// Description: Integrates the keyset query builder with TanStack Query's
// useInfiniteQuery hook.Manages the infinite scrolling state, prefetching,
// and automatic cursor extraction.
// =============================================================================

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  fetchEventsKeyset,
  CursorParams,
  FilterParams,
  extractCursorFromPage,
} from "../lib/supabase/keysetQueries";

interface UseInfiniteEventsOptions {
  filters?: FilterParams;
  pageSize?: number;
  orderDirection?: "asc" | "desc";
  enabled?: boolean;
}

export function useInfiniteEvents({
  filters = {},
  pageSize = 12,
  orderDirection = "desc",
  enabled = true,
}: UseInfiniteEventsOptions = {}) {
  return useInfiniteQuery({
    queryKey: ["infinite-events", filters, pageSize, orderDirection],

    queryFn: async ({ pageParam = {} }) => {
      // pageParam is the cursor from the previous page
      return fetchEventsKeyset({ ...pageParam, limit: pageSize, orderDirection }, filters);
    },

    // CRITICAL: Tell TanStack Query how to get the cursor for the NEXT page
    // It extracts the nextCursor object we returned from fetchEventsKeyset
    getNextPageParam: (lastPage) => {
      return lastPage.nextCursor || undefined; // undefined means no more pages
    },

    // Initial page has no cursor
    initialPageParam: {} as CursorParams,

    enabled,

    // Performance optimizations
    staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes

    // Prevent refetching on window focus for feeds
    refetchOnWindowFocus: false,
  });
}

/**
 * Helper hook to flatten the paginated data into a single array for rendering
 */
export function useFlattenedEvents(options: UseInfiniteEventsOptions = {}) {
  const query = useInfiniteEvents(options);

  const flattenedData = query.data?.pages.flatMap((page) => page.data) || [];

  return {
    ...query,
    data: flattenedData,
    estimatedTotal: query.data?.pages[0]?.estimatedTotal || 0,
  };
}
