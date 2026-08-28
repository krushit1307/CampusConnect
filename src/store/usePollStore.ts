import { create } from "zustand";
import type { Poll, PollFilters } from "@/types/polls";

export type PollBoardStatus = "idle" | "loading" | "success" | "error";

interface PollBoardState {
  polls: Poll[];
  selectedPoll: Poll | null;
  status: PollBoardStatus;
  error: string | null;
  filters: PollFilters;
  isFormOpen: boolean;
  isDetailOpen: boolean;
  pendingVotePollIds: Set<string>;

  setPolls: (polls: Poll[]) => void;
  setSelectedPoll: (poll: Poll | null) => void;
  setStatus: (status: PollBoardStatus) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof PollFilters>(key: K, value: PollFilters[K]) => void;
  resetFilters: () => void;
  setFormOpen: (open: boolean) => void;
  setDetailOpen: (open: boolean) => void;
  addPoll: (poll: Poll) => void;
  updatePoll: (id: string, updates: Partial<Poll>) => void;
  removePoll: (id: string) => void;
  addPendingVote: (id: string) => void;
  removePendingVote: (id: string) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: PollFilters = {
  status: "active",
  target: "all",
  search: "",
  sort: "newest",
};

export const usePollStore = create<PollBoardState>((set) => ({
  polls: [],
  selectedPoll: null,
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  isFormOpen: false,
  isDetailOpen: false,
  pendingVotePollIds: new Set(),

  setPolls: (polls) => set({ polls, status: "success" }),
  setSelectedPoll: (poll) => set({ selectedPoll: poll }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setFormOpen: (open) => set({ isFormOpen: open }),
  setDetailOpen: (open) => set({ isDetailOpen: open }),

  addPoll: (poll) => set((state) => ({ polls: [poll, ...state.polls] })),
  updatePoll: (id, updates) =>
    set((state) => ({
      polls: state.polls.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      selectedPoll:
        state.selectedPoll?.id === id ? { ...state.selectedPoll, ...updates } : state.selectedPoll,
    })),
  removePoll: (id) =>
    set((state) => ({
      polls: state.polls.filter((p) => p.id !== id),
      selectedPoll: state.selectedPoll?.id === id ? null : state.selectedPoll,
    })),

  addPendingVote: (id) =>
    set((state) => {
      const next = new Set(state.pendingVotePollIds);
      next.add(id);
      return { pendingVotePollIds: next };
    }),
  removePendingVote: (id) =>
    set((state) => {
      const next = new Set(state.pendingVotePollIds);
      next.delete(id);
      return { pendingVotePollIds: next };
    }),

  reset: () =>
    set({
      polls: [],
      selectedPoll: null,
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      isFormOpen: false,
      isDetailOpen: false,
      pendingVotePollIds: new Set(),
    }),
}));
