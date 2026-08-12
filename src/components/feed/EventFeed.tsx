// =============================================================================
// Component: EventFeed (Infinite Scroll with Keyset Pagination)
// Issue: #2734 - Implement Data Pagination using Keyset Pagination (Cursor-based)
// Description: Renders the infinite scrolling event feed. Uses IntersectionObserver
// to trigger the fetching of the next page when the user scrolls to the bottom.
// Guarantees no duplicate items even when new events are inserted in real - time.
// =============================================================================

import React, { useRef, useEffect, useCallback } from "react";
import { useFlattenedEvents } from "../../hooks/useInfiniteEvents";
import { EventCard } from "./EventCard"; // Assumed existing component

interface EventFeedProps {
  clubId?: string;
  status?: string;
  searchQuery?: string;
}

export const EventFeed: React.FC<EventFeedProps> = ({ clubId, status, searchQuery }) => {
  const {
    data: events,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    estimatedTotal,
  } = useFlattenedEvents({
    filters: { clubId, status, searchQuery },
    pageSize: 20,
  });

  // IntersectionObserver for infinite scroll trigger
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        {
          rootMargin: "200px", // Start fetching 200px before the user reaches the bottom
        },
      );

      if (node) observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden animate-pulse"
          >
            <div className="h-48 bg-gray-200 dark:bg-gray-700"></div>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <svg
          className="w-16 h-16 text-red-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Failed to Load Feed
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          {(error as Error).message || "An unexpected error occurred while fetching events."}
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <svg
          className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Events Found</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          {searchQuery
            ? `No events match your search for "${searchQuery}".`
            : "There are no events to display right now. Check back later!"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Feed Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {clubId ? "Club Events" : "All Events"}
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ~{estimatedTotal.toLocaleString()} total events
        </span>
      </div>

      {/* Event Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Infinite Scroll Trigger & Loading State */}
      <div ref={loadMoreRef} className="flex items-center justify-center py-12">
        {isFetchingNextPage && (
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="font-medium">Loading older events...</span>
          </div>
        )}

        {!hasNextPage && events.length > 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            You've reached the end of the feed! 🎉
          </p>
        )}
      </div>
    </div>
  );
};
