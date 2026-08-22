export interface FeedStateOptions<T> {
  isLoading: boolean;
  isError: boolean;
  items: T[];
  errorMessage?: string;
  loadingMessage?: string;
  emptyMessage?: string;
}

export interface RenderedFeedState<T> {
  status: "LOADING" | "ERROR" | "EMPTY" | "SUCCESS";
  displayText?: string;
  itemsToRender: T[];
}

export const DEFAULT_LOADING_MESSAGE = "Loading Events...";
export const DEFAULT_EMPTY_MESSAGE = "No events found matching your criteria.";

/**
 * Resolves the display state for the EventFeed component based on async query flags.
 */
export function resolveEventFeedState<T>(options: FeedStateOptions<T>): RenderedFeedState<T> {
  const loadingMessage = options.loadingMessage || DEFAULT_LOADING_MESSAGE;
  const emptyMessage = options.emptyMessage || DEFAULT_EMPTY_MESSAGE;

  if (options.isLoading) {
    return {
      status: "LOADING",
      displayText: loadingMessage,
      itemsToRender: [],
    };
  }

  if (options.isError) {
    return {
      status: "ERROR",
      displayText: options.errorMessage || "Failed to load events.",
      itemsToRender: [],
    };
  }

  if (!options.items || options.items.length === 0) {
    return {
      status: "EMPTY",
      displayText: emptyMessage,
      itemsToRender: [],
    };
  }

  return {
    status: "SUCCESS",
    itemsToRender: options.items,
  };
}
