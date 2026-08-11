import { create } from "zustand";
import type { MockEvent } from "@/mocks/handlers";

export type EventStatus = "idle" | "loading" | "success" | "error";

export interface EventFilters {
  search: string;
}

export interface EventState {
  events: MockEvent[];
  selectedEvent: MockEvent | null;
  status: EventStatus;
  error: string | null;
  filters: EventFilters;

  // Asynchronous actions
  fetchEvents: () => Promise<void>;
  fetchEventById: (id: string) => Promise<void>;
  createEvent: (eventData: Omit<MockEvent, "id" | "attendeesCount">) => Promise<void>;
  updateEvent: (id: string, updates: Partial<MockEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  rsvpEvent: (id: string) => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
  reset: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedEvent: null,
  status: "idle",
  error: null,
  filters: { search: "" },

  fetchEvents: async () => {
    set({ status: "loading", error: null });
    try {
      const { search } = get().filters;
      const url = search ? `/api/events?search=${encodeURIComponent(search)}` : "/api/events";

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch events");
      }

      set({
        events: data.events || [],
        status: "success",
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error fetching events";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  fetchEventById: async (id: string) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch(`/api/events/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Event not found");
      }

      set({
        selectedEvent: data.event,
        status: "success",
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error fetching event";
      set({
        selectedEvent: null,
        status: "error",
        error: errorMessage,
      });
    }
  },

  createEvent: async (eventData) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      set((state) => ({
        events: [data.event, ...state.events],
        status: "success",
        error: null,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error creating event";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  updateEvent: async (id, updates) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update event");
      }

      set((state) => ({
        events: state.events.map((e) => (e.id === id ? data.event : e)),
        selectedEvent: state.selectedEvent?.id === id ? data.event : state.selectedEvent,
        status: "success",
        error: null,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error updating event";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  deleteEvent: async (id) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete event");
      }

      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
        status: "success",
        error: null,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error deleting event";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  rsvpEvent: async (id) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch(`/api/events/${id}/rsvp`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle RSVP");
      }

      set((state) => ({
        events: state.events.map((e) => (e.id === id ? data.event : e)),
        selectedEvent: state.selectedEvent?.id === id ? data.event : state.selectedEvent,
        status: "success",
        error: null,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error handling RSVP";
      set({
        status: "error",
        error: errorMessage,
      });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  reset: () => {
    set({
      events: [],
      selectedEvent: null,
      status: "idle",
      error: null,
      filters: { search: "" },
    });
  },
}));
