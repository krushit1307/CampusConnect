import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { useEventStore } from "./useEventStore";
import { mockEvents } from "@/mocks/handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  useEventStore.getState().reset();
});
afterAll(() => server.close());

describe("useEventStore with MSW", () => {
  it("starts in idle state with empty events list", () => {
    const state = useEventStore.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toEqual([]);
    expect(state.selectedEvent).toBeNull();
    expect(state.error).toBeNull();
  });

  describe("fetchEvents action", () => {
    it("fetches event list and transitions state: idle -> loading -> success", async () => {
      const store = useEventStore.getState();
      const fetchPromise = store.fetchEvents();

      expect(useEventStore.getState().status).toBe("loading");

      await fetchPromise;

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      expect(state.events).toEqual(mockEvents);
      expect(state.error).toBeNull();
    });

    it("filters events by search query", async () => {
      useEventStore.getState().setFilters({ search: "Hackathon" });
      await useEventStore.getState().fetchEvents();

      const state = useEventStore.getState();
      expect(state.events.length).toBe(1);
      expect(state.events[0].title).toBe("Web3 & AI Hackathon");
    });

    it("handles fetch failure gracefully", async () => {
      server.use(
        http.get("/api/events", () => {
          return HttpResponse.json({ error: "Database failure" }, { status: 500 });
        }),
      );

      await useEventStore.getState().fetchEvents();

      const state = useEventStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Database failure");
    });
  });

  describe("fetchEventById action", () => {
    it("fetches single event detail successfully", async () => {
      await useEventStore.getState().fetchEventById("event-1");

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      expect(state.selectedEvent).toEqual(mockEvents[0]);
    });

    it("handles 404 event not found", async () => {
      await useEventStore.getState().fetchEventById("non-existent-id");

      const state = useEventStore.getState();
      expect(state.status).toBe("error");
      expect(state.selectedEvent).toBeNull();
      expect(state.error).toBe("Event not found");
    });
  });

  describe("createEvent action", () => {
    it("creates a new event and prepends to store events list", async () => {
      // First populate list
      await useEventStore.getState().fetchEvents();
      const initialCount = useEventStore.getState().events.length;

      const newEventData = {
        title: "Autonomous AI Hackathon",
        description: "Build autonomous multi-agent systems.",
        event_date: "2026-10-01T09:00:00Z",
        location: "Engineering Quad Hall B",
      };

      await useEventStore.getState().createEvent(newEventData);

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      expect(state.events.length).toBe(initialCount + 1);
      expect(state.events[0].title).toBe("Autonomous AI Hackathon");
    });

    it("handles validation error on event creation", async () => {
      await useEventStore.getState().createEvent({
        title: "",
        description: "Invalid",
        event_date: "2026-10-01T09:00:00Z",
        location: "Hall A",
      });

      const state = useEventStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Title is required");
    });
  });

  describe("updateEvent action", () => {
    it("updates existing event in state list", async () => {
      await useEventStore.getState().fetchEvents();

      await useEventStore.getState().updateEvent("event-1", {
        title: "Updated AI Hackathon",
      });

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      const updated = state.events.find((e) => e.id === "event-1");
      expect(updated?.title).toBe("Updated AI Hackathon");
    });
  });

  describe("deleteEvent action", () => {
    it("removes deleted event from state events list", async () => {
      await useEventStore.getState().fetchEvents();
      const initialCount = useEventStore.getState().events.length;

      await useEventStore.getState().deleteEvent("event-1");

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      expect(state.events.length).toBe(initialCount - 1);
      expect(state.events.some((e) => e.id === "event-1")).toBe(false);
    });
  });

  describe("rsvpEvent action", () => {
    it("toggles RSVP status and updates attendee count", async () => {
      await useEventStore.getState().fetchEvents();
      const event1Before = useEventStore.getState().events.find((e) => e.id === "event-1");
      const countBefore = event1Before?.attendeesCount ?? 0;

      await useEventStore.getState().rsvpEvent("event-1");

      const state = useEventStore.getState();
      expect(state.status).toBe("success");
      const event1After = state.events.find((e) => e.id === "event-1");
      expect(event1After?.userRsvped).toBe(true);
      expect(event1After?.attendeesCount).toBe(countBefore + 1);
    });
  });
});
