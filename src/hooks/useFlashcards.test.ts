// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useFlashcards } from "./useFlashcards";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-10-15T12:00:00"));
});

describe("useFlashcards", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useFlashcards());
    expect(result.current.decks).toHaveLength(0);
    expect(result.current.cards).toHaveLength(0);
    expect(result.current.selectedDeckId).toBeNull();
  });

  it("creates a deck", () => {
    const { result } = renderHook(() => useFlashcards());
    act(() => { result.current.addDeck("Biology 101", "Cell biology"); });
    expect(result.current.decks).toHaveLength(1);
    expect(result.current.decks[0].name).toBe("Biology 101");
  });

  it("adds cards to a deck", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("CS Terms", ""); });
    act(() => { result.current.addCard(deckId, "Q1", "A1"); });
    act(() => { result.current.addCard(deckId, "Q2", "A2"); });
    expect(result.current.cards).toHaveLength(2);
    expect(result.current.cards[0].deckId).toBe(deckId);
  });

  it("removes a card", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q", "A"); });
    const cardId = result.current.cards[0].id;
    act(() => { result.current.removeCard(cardId); });
    expect(result.current.cards).toHaveLength(0);
  });

  it("removes a deck and its cards", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q1", "A1"); });
    act(() => { result.current.addCard(deckId, "Q2", "A2"); });
    act(() => { result.current.removeDeck(deckId); });
    expect(result.current.decks).toHaveLength(0);
    expect(result.current.cards).toHaveLength(0);
  });

  it("gets due cards", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q1", "A1"); });
    act(() => { result.current.addCard(deckId, "Q2", "A2"); });
    expect(result.current.getDueCards(deckId)).toHaveLength(2);
  });

  it("reviews a card with SM-2", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q1", "A1"); });
    const cardId = result.current.cards[0].id;
    act(() => { result.current.reviewCard(cardId, 5); });
    const c = result.current.cards.find((x) => x.id === cardId)!;
    expect(c.lastReviewed).not.toBeNull();
    expect(c.repetitions).toBe(1);
    expect(c.interval).toBe(1);
  });

  it("resets repetitions on failure", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q", "A"); });
    const cardId = result.current.cards[0].id;
    act(() => { result.current.reviewCard(cardId, 4); });
    act(() => { result.current.reviewCard(cardId, 4); });
    expect(result.current.cards.find((c) => c.id === cardId)!.repetitions).toBe(2);
    act(() => { result.current.reviewCard(cardId, 1); });
    expect(result.current.cards.find((c) => c.id === cardId)!.repetitions).toBe(0);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Saved", ""); });
    act(() => { result.current.addCard(deckId, "Front", "Back"); });
    expect(JSON.parse(localStorage.getItem("cc-flashcards-decks") ?? "[]")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("cc-flashcards-cards") ?? "[]")).toHaveLength(1);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q", "A"); });
    act(() => { result.current.clearAllData(); });
    expect(result.current.decks).toHaveLength(0);
    expect(result.current.cards).toHaveLength(0);
  });

  it("getDeckStats computes correctly", () => {
    const { result } = renderHook(() => useFlashcards());
    let deckId = "";
    act(() => { deckId = result.current.addDeck("Test", ""); });
    act(() => { result.current.addCard(deckId, "Q1", "A1"); });
    act(() => { result.current.addCard(deckId, "Q2", "A2"); });
    act(() => { result.current.addCard(deckId, "Q3", "A3"); });
    const cardId = result.current.cards[0].id;
    act(() => { result.current.reviewCard(cardId, 4); });
    act(() => { result.current.reviewCard(cardId, 4); });
    act(() => { result.current.reviewCard(cardId, 4); });
    const stats = result.current.getDeckStats(deckId);
    expect(stats.totalCards).toBe(3);
    expect(stats.masteryPercent).toBeCloseTo(33.33, 0);
  });
});
