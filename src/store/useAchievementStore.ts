import { create } from "zustand";
import type { AchievementFilters } from "@/types/achievements";

export type AchievementBoardStatus = "idle" | "loading" | "success" | "error";

interface AchievementBoardState {
  status: AchievementBoardStatus;
  error: string | null;
  filters: AchievementFilters;
  selectedBadgeId: string | null;
  isDetailOpen: boolean;
  isLeaderboardOpen: boolean;

  setStatus: (status: AchievementBoardStatus) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof AchievementFilters>(key: K, value: AchievementFilters[K]) => void;
  resetFilters: () => void;
  setSelectedBadge: (id: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setLeaderboardOpen: (open: boolean) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: AchievementFilters = {
  category: "all",
  status: "all",
  tier: "all",
  search: "",
};

export const useAchievementStore = create<AchievementBoardState>((set) => ({
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  selectedBadgeId: null,
  isDetailOpen: false,
  isLeaderboardOpen: false,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setSelectedBadge: (id) => set({ selectedBadgeId: id }),
  setDetailOpen: (open) => set({ isDetailOpen: open }),
  setLeaderboardOpen: (open) => set({ isLeaderboardOpen: open }),

  reset: () =>
    set({
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      selectedBadgeId: null,
      isDetailOpen: false,
      isLeaderboardOpen: false,
    }),
}));
