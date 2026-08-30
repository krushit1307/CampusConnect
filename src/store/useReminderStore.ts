import { create } from "zustand";
import type { ReminderFilters } from "@/types/reminders";

export type ReminderBoardStatus = "idle" | "loading" | "success" | "error";

interface ReminderBoardState {
  status: ReminderBoardStatus;
  error: string | null;
  filters: ReminderFilters;
  isFormOpen: boolean;
  isDetailOpen: boolean;
  selectedReminderId: string | null;

  setStatus: (s: ReminderBoardStatus) => void;
  setError: (e: string | null) => void;
  setFilter: <K extends keyof ReminderFilters>(key: K, value: ReminderFilters[K]) => void;
  resetFilters: () => void;
  setFormOpen: (open: boolean) => void;
  setDetailOpen: (open: boolean) => void;
  setSelectedReminder: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: ReminderFilters = {
  status: "all",
  frequency: "all",
  search: "",
  sort: "soonest",
};

export const useReminderStore = create<ReminderBoardState>((set) => ({
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  isFormOpen: false,
  isDetailOpen: false,
  selectedReminderId: null,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setFormOpen: (open) => set({ isFormOpen: open }),
  setDetailOpen: (open) => set({ isDetailOpen: open }),
  setSelectedReminder: (id) => set({ selectedReminderId: id }),

  reset: () =>
    set({
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      isFormOpen: false,
      isDetailOpen: false,
      selectedReminderId: null,
    }),
}));
