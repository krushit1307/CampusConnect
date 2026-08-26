import { create } from "zustand";
import type { StudyGroupFilters } from "@/types/studyGroups";

export type StudyGroupBoardStatus = "idle" | "loading" | "success" | "error";

interface StudyGroupBoardState {
  status: StudyGroupBoardStatus;
  error: string | null;
  filters: StudyGroupFilters;
  selectedGroupId: string | null;
  isDetailOpen: boolean;
  isFormOpen: boolean;
  isSessionFormOpen: boolean;

  setStatus: (status: StudyGroupBoardStatus) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof StudyGroupFilters>(key: K, value: StudyGroupFilters[K]) => void;
  resetFilters: () => void;
  setSelectedGroup: (id: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setFormOpen: (open: boolean) => void;
  setSessionFormOpen: (open: boolean) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: StudyGroupFilters = {
  privacy: "all",
  search: "",
  sort: "newest",
  has_my_groups: false,
};

export const useStudyGroupStore = create<StudyGroupBoardState>((set) => ({
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  selectedGroupId: null,
  isDetailOpen: false,
  isFormOpen: false,
  isSessionFormOpen: false,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setSelectedGroup: (id) => set({ selectedGroupId: id }),
  setDetailOpen: (open) => set({ isDetailOpen: open }),
  setFormOpen: (open) => set({ isFormOpen: open }),
  setSessionFormOpen: (open) => set({ isSessionFormOpen: open }),

  reset: () =>
    set({
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      selectedGroupId: null,
      isDetailOpen: false,
      isFormOpen: false,
      isSessionFormOpen: false,
    }),
}));
