import { create } from "zustand";
import type { FeedbackFilters } from "@/types/eventFeedback";

export type FeedbackBoardStatus = "idle" | "loading" | "success" | "error";

interface FeedbackBoardState {
  status: FeedbackBoardStatus;
  error: string | null;
  filters: FeedbackFilters;
  selectedFeedbackId: string | null;
  isFormOpen: boolean;
  isDetailOpen: boolean;
  activeEventId: string | null;

  setStatus: (s: FeedbackBoardStatus) => void;
  setError: (e: string | null) => void;
  setFilter: <K extends keyof FeedbackFilters>(key: K, value: FeedbackFilters[K]) => void;
  resetFilters: () => void;
  setSelectedFeedback: (id: string | null) => void;
  setFormOpen: (open: boolean) => void;
  setDetailOpen: (open: boolean) => void;
  setActiveEvent: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: FeedbackFilters = {
  rating: "all",
  sort: "newest",
  sentiment: "all",
  search: "",
};

export const useEventFeedbackStore = create<FeedbackBoardState>((set) => ({
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  selectedFeedbackId: null,
  isFormOpen: false,
  isDetailOpen: false,
  activeEventId: null,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setSelectedFeedback: (id) => set({ selectedFeedbackId: id }),
  setFormOpen: (open) => set({ isFormOpen: open }),
  setDetailOpen: (open) => set({ isDetailOpen: open }),
  setActiveEvent: (id) => set({ activeEventId: id }),

  reset: () =>
    set({
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      selectedFeedbackId: null,
      isFormOpen: false,
      isDetailOpen: false,
      activeEventId: null,
    }),
}));
