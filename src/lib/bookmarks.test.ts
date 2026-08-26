import { describe, expect, it } from "vitest";
import { normalizeSavedEvent, normalizeSavedEvents } from "./bookmarks";

describe("bookmark utilities", () => {
  it("normalizes an object event relation", () => {
    expect(
      normalizeSavedEvent({
        id: "bookmark-1",
        user_id: "user-1",
        event: { id: "event-1", title: "Hackathon" },
      }),
    ).toEqual({
      id: "event-1",
      title: "Hackathon",
      saved_events: [{ id: "bookmark-1", user_id: "user-1" }],
    });
  });

  it("normalizes an array event relation", () => {
    expect(
      normalizeSavedEvent({
        id: "bookmark-2",
        user_id: "user-2",
        event: [{ id: "event-2", title: "Workshop" }],
      }),
    ).toEqual({
      id: "event-2",
      title: "Workshop",
      saved_events: [{ id: "bookmark-2", user_id: "user-2" }],
    });
  });

  it("removes missing event relations", () => {
    expect(
      normalizeSavedEvents([
        {
          id: "bookmark-1",
          user_id: "user-1",
          event: null,
        },
        {
          id: "bookmark-2",
          user_id: "user-1",
          event: { id: "event-2", title: "Valid" },
        },
      ]),
    ).toHaveLength(1);
  });
});
