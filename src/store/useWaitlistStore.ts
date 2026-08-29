/**
 * Waitlist Store
 *
 * Zustand store for managing waitlist state across the application.
 * Handles caching, optimistic updates, and real-time synchronization.
 */

import { create } from "zustand";
import type {
  WaitlistConfig,
  WaitlistEntry,
  WaitlistNotificationPayload,
  WaitlistStats,
} from "@/types/waitlist";
import { DEFAULT_WAITLIST_CONFIG } from "@/types/waitlist";
import { calculateWaitlistStats, getNextWaitlistPosition, sortByPosition } from "@/lib/waitlist-utils";

export type WaitlistLoadingState = "idle" | "loading" | "error";

export interface WaitlistState {
  /** Map of event IDs to their waitlist entries */
  entries: Record<string, WaitlistEntry[]>;
  /** Map of event IDs to their waitlist config */
  configs: Record<string, WaitlistConfig>;
  /** Map of event IDs to their stats */
  stats: Record<string, WaitlistStats>;
  /** Map of event IDs to loading state */
  loadingStates: Record<string, WaitlistLoadingState>;
  /** Error messages per event */
  errors: Record<string, string | null>;
  /** Pending notifications */
  pendingNotifications: WaitlistNotificationPayload[];
  /** User's own waitlist entries mapped by event ID */
  userEntries: Record<string, WaitlistEntry | null>;
  /** Currently selected event for admin view */
  selectedEventId: string | null;
}

export interface WaitlistActions {
  /** Set entries for an event */
  setEntries: (eventId: string, entries: WaitlistEntry[]) => void;
  /** Add a new entry optimistically */
  addEntry: (eventId: string, entry: WaitlistEntry) => void;
  /** Remove an entry optimistically */
  removeEntry: (eventId: string, entryId: string) => void;
  /** Update an entry */
  updateEntry: (eventId: string, entryId: string, updates: Partial<WaitlistEntry>) => void;
  /** Set the user's own entry for an event */
  setUserEntry: (eventId: string, entry: WaitlistEntry | null) => void;
  /** Set config for an event */
  setConfig: (eventId: string, config: WaitlistConfig) => void;
  /** Set loading state for an event */
  setLoading: (eventId: string, state: WaitlistLoadingState) => void;
  /** Set error for an event */
  setError: (eventId: string, error: string | null) => void;
  /** Add a pending notification */
  addNotification: (notification: WaitlistNotificationPayload) => void;
  /** Remove a pending notification */
  removeNotification: (index: number) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Set the selected event for admin view */
  setSelectedEvent: (eventId: string | null) => void;
  /** Recalculate stats for an event */
  recalculateStats: (eventId: string) => void;
  /** Clear all data for an event */
  clearEvent: (eventId: string) => void;
  /** Reset the entire store */
  reset: () => void;
}

const initialState: WaitlistState = {
  entries: {},
  configs: {},
  stats: {},
  loadingStates: {},
  errors: {},
  pendingNotifications: [],
  userEntries: {},
  selectedEventId: null,
};

export const useWaitlistStore = create<WaitlistState & WaitlistActions>((set, get) => ({
  ...initialState,

  setEntries: (eventId, entries) => {
    const sorted = sortByPosition(entries);
    set((state) => ({
      entries: { ...state.entries, [eventId]: sorted },
    }));
    get().recalculateStats(eventId);
  },

  addEntry: (eventId, entry) => {
    set((state) => {
      const existing = state.entries[eventId] || [];
      const updated = sortByPosition([...existing, entry]);
      return {
        entries: { ...state.entries, [eventId]: updated },
        userEntries: {
          ...state.userEntries,
          [eventId]: entry.user_id === entry.user_id ? entry : state.userEntries[eventId],
        },
      };
    });
    get().recalculateStats(eventId);
  },

  removeEntry: (eventId, entryId) => {
    set((state) => {
      const existing = state.entries[eventId] || [];
      const updated = existing.filter((e) => e.id !== entryId);
      const userEntry = state.userEntries[eventId];
      return {
        entries: { ...state.entries, [eventId]: updated },
        userEntries: {
          ...state.userEntries,
          [eventId]: userEntry?.id === entryId ? null : userEntry,
        },
      };
    });
    get().recalculateStats(eventId);
  },

  updateEntry: (eventId, entryId, updates) => {
    set((state) => {
      const existing = state.entries[eventId] || [];
      const updated = existing.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
      const userEntry = state.userEntries[eventId];
      return {
        entries: { ...state.entries, [eventId]: sortByPosition(updated) },
        userEntries: {
          ...state.userEntries,
          [eventId]: userEntry?.id === entryId ? { ...userEntry, ...updates } : userEntry,
        },
      };
    });
    get().recalculateStats(eventId);
  },

  setUserEntry: (eventId, entry) => {
    set((state) => ({
      userEntries: { ...state.userEntries, [eventId]: entry },
    }));
  },

  setConfig: (eventId, config) => {
    set((state) => ({
      configs: { ...state.configs, [eventId]: config },
    }));
  },

  setLoading: (eventId, state_) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, [eventId]: state_ },
    }));
  },

  setError: (eventId, error) => {
    set((state) => ({
      errors: { ...state.errors, [eventId]: error },
      loadingStates: {
        ...state.loadingStates,
        [eventId]: error ? "error" : state.loadingStates[eventId],
      },
    }));
  },

  addNotification: (notification) => {
    set((state) => ({
      pendingNotifications: [...state.pendingNotifications, notification],
    }));
  },

  removeNotification: (index) => {
    set((state) => ({
      pendingNotifications: state.pendingNotifications.filter((_, i) => i !== index),
    }));
  },

  clearNotifications: () => {
    set({ pendingNotifications: [] });
  },

  setSelectedEvent: (eventId) => {
    set({ selectedEventId: eventId });
  },

  recalculateStats: (eventId) => {
    const state = get();
    const entries = state.entries[eventId] || [];
    const stats = calculateWaitlistStats(entries);
    set((s) => ({
      stats: { ...s.stats, [eventId]: stats },
    }));
  },

  clearEvent: (eventId) => {
    set((state) => {
      const { [eventId]: _entries, ...restEntries } = state.entries;
      const { [eventId]: _config, ...restConfigs } = state.configs;
      const { [eventId]: _stats, ...restStats } = state.stats;
      const { [eventId]: _loading, ...restLoading } = state.loadingStates;
      const { [eventId]: _error, ...restErrors } = state.errors;
      const { [eventId]: _userEntry, ...restUserEntries } = state.userEntries;
      return {
        entries: restEntries,
        configs: restConfigs,
        stats: restStats,
        loadingStates: restLoading,
        errors: restErrors,
        userEntries: restUserEntries,
      };
    });
  },

  reset: () => {
    set(initialState);
  },
}));

/** Selectors for convenience */
export const selectWaitlistEntries = (eventId: string) => (state: WaitlistState) =>
  state.entries[eventId] || [];

export const selectUserEntry = (eventId: string) => (state: WaitlistState) =>
  state.userEntries[eventId] || null;

export const selectWaitlistStats = (eventId: string) => (state: WaitlistState) =>
  state.stats[eventId] || null;

export const selectWaitlistConfig = (eventId: string) => (state: WaitlistState) =>
  state.configs[eventId] || DEFAULT_WAITLIST_CONFIG;

export const selectIsLoading = (eventId: string) => (state: WaitlistState) =>
  state.loadingStates[eventId] === "loading";

export const selectWaitlistError = (eventId: string) => (state: WaitlistState) =>
  state.errors[eventId] || null;

export const selectNotificationCount = (state: WaitlistState) =>
  state.pendingNotifications.length;
