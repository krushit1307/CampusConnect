import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import type { EventSuggestion, SuggestionFilters, SuggestionCategory } from "@/types/suggestions";

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockSuggestion: EventSuggestion = {
  id: "sug-001",
  title: "Annual Campus Hackathon",
  description: "A 48-hour hackathon bringing together students from all disciplines.",
  proposed_date: "2026-10-15T09:00:00Z",
  proposed_location: "Engineering Building",
  category: "hackathon",
  status: "open",
  suggested_by: "user-001",
  suggested_by_name: "Jane Doe",
  suggested_by_avatar: null,
  club_id: null,
  club_name: null,
  vote_count: 42,
  comment_count: 5,
  has_user_voted: false,
  estimated_budget: 5000,
  expected_attendees: 200,
  admin_notes: null,
  created_at: "2026-08-20T10:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
};

const mockSuggestionVoted: EventSuggestion = {
  ...mockSuggestion,
  id: "sug-002",
  has_user_voted: true,
  vote_count: 15,
};

// ─── Store tests ─────────────────────────────────────────────────────────────

describe("useSuggestionStore", () => {
  beforeEach(() => {
    useSuggestionStore.getState().reset();
  });

  it("should initialize with default state", () => {
    const state = useSuggestionStore.getState();

    expect(state.suggestions).toEqual([]);
    expect(state.selectedSuggestion).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(state.isFormOpen).toBe(false);
    expect(state.isDetailOpen).toBe(false);
    expect(state.pendingVoteIds.size).toBe(0);
  });

  it("should set suggestions", () => {
    const { setSuggestions } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions).toHaveLength(1);
    expect(state.suggestions[0].id).toBe("sug-001");
    expect(state.status).toBe("success");
  });

  it("should add a suggestion to the beginning of the list", () => {
    const { setSuggestions, addSuggestion } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      addSuggestion({ ...mockSuggestion, id: "sug-new", title: "New Event" });
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions).toHaveLength(2);
    expect(state.suggestions[0].id).toBe("sug-new");
  });

  it("should update a suggestion by id", () => {
    const { setSuggestions, updateSuggestion } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      updateSuggestion("sug-001", { vote_count: 50, status: "approved" });
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions[0].vote_count).toBe(50);
    expect(state.suggestions[0].status).toBe("approved");
  });

  it("should remove a suggestion by id", () => {
    const { setSuggestions, removeSuggestion } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      removeSuggestion("sug-001");
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions).toHaveLength(0);
  });

  it("should toggle vote optimistically (add vote)", () => {
    const { setSuggestions, toggleVoteOptimistic } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      toggleVoteOptimistic("sug-001", false);
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions[0].has_user_voted).toBe(true);
    expect(state.suggestions[0].vote_count).toBe(43);
  });

  it("should toggle vote optimistically (remove vote)", () => {
    const { setSuggestions, toggleVoteOptimistic } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestionVoted]);
      toggleVoteOptimistic("sug-002", true);
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions[0].has_user_voted).toBe(false);
    expect(state.suggestions[0].vote_count).toBe(14);
  });

  it("should revert vote optimistic update", () => {
    const { setSuggestions, toggleVoteOptimistic, revertVoteOptimistic } =
      useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      toggleVoteOptimistic("sug-001", false);
      revertVoteOptimistic("sug-001", false);
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions[0].has_user_voted).toBe(false);
    expect(state.suggestions[0].vote_count).toBe(42);
  });

  it("should manage pending vote IDs", () => {
    const { addPendingVote, removePendingVote } = useSuggestionStore.getState();

    act(() => {
      addPendingVote("sug-001");
    });
    expect(useSuggestionStore.getState().pendingVoteIds.has("sug-001")).toBe(true);

    act(() => {
      removePendingVote("sug-001");
    });
    expect(useSuggestionStore.getState().pendingVoteIds.has("sug-001")).toBe(false);
  });

  it("should increment and decrement comment count", () => {
    const { setSuggestions, incrementCommentCount, decrementCommentCount } =
      useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      incrementCommentCount("sug-001");
      incrementCommentCount("sug-001");
    });

    expect(useSuggestionStore.getState().suggestions[0].comment_count).toBe(7);

    act(() => {
      decrementCommentCount("sug-001");
    });

    expect(useSuggestionStore.getState().suggestions[0].comment_count).toBe(6);
  });

  it("should not decrement comment count below 0", () => {
    const { setSuggestions, decrementCommentCount } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([{ ...mockSuggestion, comment_count: 0 }]);
      decrementCommentCount("sug-001");
    });

    expect(useSuggestionStore.getState().suggestions[0].comment_count).toBe(0);
  });

  it("should set and reset filters", () => {
    const { setFilter, resetFilters } = useSuggestionStore.getState();

    act(() => {
      setFilter("category", "hackathon");
      setFilter("sort", "most_voted");
      setFilter("search", "tech");
    });

    let state = useSuggestionStore.getState();
    expect(state.filters.category).toBe("hackathon");
    expect(state.filters.sort).toBe("most_voted");
    expect(state.filters.search).toBe("tech");

    act(() => {
      resetFilters();
    });

    state = useSuggestionStore.getState();
    expect(state.filters.category).toBe("all");
    expect(state.filters.sort).toBe("newest");
    expect(state.filters.search).toBe("");
  });

  it("should toggle form open", () => {
    const { toggleFormOpen } = useSuggestionStore.getState();

    expect(useSuggestionStore.getState().isFormOpen).toBe(false);

    act(() => toggleFormOpen());
    expect(useSuggestionStore.getState().isFormOpen).toBe(true);

    act(() => toggleFormOpen());
    expect(useSuggestionStore.getState().isFormOpen).toBe(false);
  });

  it("should toggle detail open", () => {
    const { toggleDetailOpen } = useSuggestionStore.getState();

    expect(useSuggestionStore.getState().isDetailOpen).toBe(false);

    act(() => toggleDetailOpen());
    expect(useSuggestionStore.getState().isDetailOpen).toBe(true);
  });

  it("should fully reset state", () => {
    const { setSuggestions, setFormOpen, setFilter } = useSuggestionStore.getState();

    act(() => {
      setSuggestions([mockSuggestion]);
      setFormOpen(true);
      setFilter("search", "test");
    });

    act(() => {
      useSuggestionStore.getState().reset();
    });

    const state = useSuggestionStore.getState();
    expect(state.suggestions).toEqual([]);
    expect(state.isFormOpen).toBe(false);
    expect(state.filters.search).toBe("");
    expect(state.status).toBe("idle");
  });
});

// ─── Category/Status meta tests ──────────────────────────────────────────────

describe("Suggestion meta constants", () => {
  it("should have metadata for all categories", async () => {
    const { CATEGORY_META } = await import("@/types/suggestions");
    const categories: SuggestionCategory[] = [
      "social",
      "academic",
      "sports",
      "cultural",
      "workshop",
      "hackathon",
      "volunteer",
      "other",
    ];

    for (const cat of categories) {
      expect(CATEGORY_META[cat]).toBeDefined();
      expect(CATEGORY_META[cat].label).toBeTruthy();
      expect(CATEGORY_META[cat].icon).toBeTruthy();
      expect(CATEGORY_META[cat].bgClass).toBeTruthy();
    }
  });
});
