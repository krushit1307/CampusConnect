import { describe, it, expect } from "vitest";
import {
  resolveEventFeedState,
  DEFAULT_LOADING_MESSAGE,
  DEFAULT_EMPTY_MESSAGE,
} from "./eventFeedLoadingState";

describe("Add Loading Events Message to Main Feed Suite (#3823)", () => {
  it("returns LOADING status and 'Loading Events...' message when isLoading is true", () => {
    const state = resolveEventFeedState({
      isLoading: true,
      isError: false,
      items: [],
    });

    expect(state.status).toBe("LOADING");
    expect(state.displayText).toBe(DEFAULT_LOADING_MESSAGE);
    expect(state.itemsToRender.length).toBe(0);
  });

  it("returns EMPTY status when fetch finishes with zero events", () => {
    const state = resolveEventFeedState({
      isLoading: false,
      isError: false,
      items: [],
    });

    expect(state.status).toBe("EMPTY");
    expect(state.displayText).toBe(DEFAULT_EMPTY_MESSAGE);
  });

  it("returns SUCCESS status with item list when items exist and isLoading is false", () => {
    const mockEvents = [{ id: "e1", title: "Tech Talk" }];

    const state = resolveEventFeedState({
      isLoading: false,
      isError: false,
      items: mockEvents,
    });

    expect(state.status).toBe("SUCCESS");
    expect(state.itemsToRender).toEqual(mockEvents);
  });
});
