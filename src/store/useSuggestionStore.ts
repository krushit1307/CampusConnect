import { create } from "zustand";
import type {
  EventSuggestion,
  SuggestionFilters,
  SuggestionCategory,
  SuggestionStatus,
  SortOption,
} from "@/types/suggestions";

export type SuggestionBoardStatus = "idle" | "loading" | "success" | "error";

interface SuggestionBoardState {
  /** All fetched suggestions */
  suggestions: EventSuggestion[];
  /** Currently selected suggestion (for detail view) */
  selectedSuggestion: EventSuggestion | null;
  /** Fetch/board status */
  status: SuggestionBoardStatus;
  /** Error message if status is error */
  error: string | null;
  /** Active filters */
  filters: SuggestionFilters;
  /** Whether the suggestion form dialog is open */
  isFormOpen: boolean;
  /** Whether the detail/zoom panel is open */
  isDetailOpen: boolean;
  /** IDs of suggestions currently toggling vote */
  pendingVoteIds: Set<string>;

  // Actions
  setSuggestions: (suggestions: EventSuggestion[]) => void;
  setSelectedSuggestion: (suggestion: EventSuggestion | null) => void;
  setStatus: (status: SuggestionBoardStatus) => void;
  setError: (error: string | null) => void;
  setFilter: <K extends keyof SuggestionFilters>(key: K, value: SuggestionFilters[K]) => void;
  resetFilters: () => void;
  toggleFormOpen: () => void;
  setFormOpen: (open: boolean) => void;
  toggleDetailOpen: () => void;
  setDetailOpen: (open: boolean) => void;
  addSuggestion: (suggestion: EventSuggestion) => void;
  updateSuggestion: (id: string, updates: Partial<EventSuggestion>) => void;
  removeSuggestion: (id: string) => void;
  toggleVoteOptimistic: (suggestionId: string, hasVoted: boolean) => void;
  revertVoteOptimistic: (suggestionId: string, hadVoted: boolean) => void;
  addPendingVote: (id: string) => void;
  removePendingVote: (id: string) => void;
  incrementCommentCount: (suggestionId: string) => void;
  decrementCommentCount: (suggestionId: string) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: SuggestionFilters = {
  category: "all",
  status: "open",
  search: "",
  sort: "newest",
  club_id: null,
};

export const useSuggestionStore = create<SuggestionBoardState>((set, get) => ({
  suggestions: [],
  selectedSuggestion: null,
  status: "idle",
  error: null,
  filters: { ...DEFAULT_FILTERS },
  isFormOpen: false,
  isDetailOpen: false,
  pendingVoteIds: new Set<string>(),

  setSuggestions: (suggestions) => set({ suggestions, status: "success" }),
  setSelectedSuggestion: (suggestion) => set({ selectedSuggestion: suggestion }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: "error" }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  toggleFormOpen: () => set((state) => ({ isFormOpen: !state.isFormOpen })),
  setFormOpen: (open) => set({ isFormOpen: open }),

  toggleDetailOpen: () => set((state) => ({ isDetailOpen: !state.isDetailOpen })),
  setDetailOpen: (open) => set({ isDetailOpen: open }),

  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [suggestion, ...state.suggestions],
    })),

  updateSuggestion: (id, updates) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      selectedSuggestion:
        state.selectedSuggestion?.id === id
          ? { ...state.selectedSuggestion, ...updates }
          : state.selectedSuggestion,
    })),

  removeSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
      selectedSuggestion: state.selectedSuggestion?.id === id ? null : state.selectedSuggestion,
    })),

  toggleVoteOptimistic: (suggestionId, hasVoted) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId
          ? {
              ...s,
              has_user_voted: !hasVoted,
              vote_count: s.vote_count + (hasVoted ? -1 : 1),
            }
          : s,
      ),
      selectedSuggestion:
        state.selectedSuggestion?.id === suggestionId
          ? {
              ...state.selectedSuggestion,
              has_user_voted: !hasVoted,
              vote_count: state.selectedSuggestion.vote_count + (hasVoted ? -1 : 1),
            }
          : state.selectedSuggestion,
    })),

  revertVoteOptimistic: (suggestionId, hadVoted) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId
          ? {
              ...s,
              has_user_voted: hadVoted,
              vote_count: s.vote_count + (hadVoted ? 1 : -1),
            }
          : s,
      ),
      selectedSuggestion:
        state.selectedSuggestion?.id === suggestionId
          ? {
              ...state.selectedSuggestion,
              has_user_voted: hadVoted,
              vote_count: state.selectedSuggestion.vote_count + (hadVoted ? 1 : -1),
            }
          : state.selectedSuggestion,
    })),

  addPendingVote: (id) =>
    set((state) => {
      const next = new Set(state.pendingVoteIds);
      next.add(id);
      return { pendingVoteIds: next };
    }),

  removePendingVote: (id) =>
    set((state) => {
      const next = new Set(state.pendingVoteIds);
      next.delete(id);
      return { pendingVoteIds: next };
    }),

  incrementCommentCount: (suggestionId) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId ? { ...s, comment_count: s.comment_count + 1 } : s,
      ),
    })),

  decrementCommentCount: (suggestionId) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === suggestionId ? { ...s, comment_count: Math.max(0, s.comment_count - 1) } : s,
      ),
    })),

  reset: () =>
    set({
      suggestions: [],
      selectedSuggestion: null,
      status: "idle",
      error: null,
      filters: { ...DEFAULT_FILTERS },
      isFormOpen: false,
      isDetailOpen: false,
      pendingVoteIds: new Set(),
    }),
}));
